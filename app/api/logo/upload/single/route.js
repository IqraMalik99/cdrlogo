import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";
import {
  buildCategoryTreeFromText,
  validateMainSubAgainstTree,
} from "../../../../lib/categoryMatch";
import { CATEGORY_TAXONOMY_TEXT } from "../../../../lib/Categorytaxonomytext";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── mime helpers ──────────────────────────────────────────────────────────────
const MIME = {
  svg: "image/svg+xml",
  ai: "application/postscript",
  cdr: "application/cdr",
  png: "image/png",
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};

function ext(filename) {
  return filename.split(".").pop().toLowerCase();
}

function mime(filename) {
  return MIME[ext(filename)] || "application/octet-stream";
}

function sanitizeFilename(filename) {
  const lastDot = filename.lastIndexOf(".");
  const name = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  const extension = lastDot !== -1 ? filename.slice(lastDot) : "";

  const cleanName = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");

  return `${cleanName}${extension.toLowerCase()}`;
}

function stripTrailingSlash(url) {
  return url.replace(/\/+$/, "");
}


function stripSpecialChars(name) {
  if (!name) return name;
  return name
    .normalize("NFD")                  // decomposes é → e + ́ (combining accent mark)
    .replace(/[\u0300-\u036f]/g, "")    // removes just the accent marks, keeps the base letter
    .replace(/[^a-zA-Z0-9\s]/g, "")     // now safe to strip everything except plain letters/numbers/spaces
    .replace(/\s+/g, " ")
    .trim();
}

// Preserves apostrophes/ampersands (needed for real-brand matching like
// "Moody's", "McDonald's", "Levi's", "AT&T") and strips the auto-appended
// " V2"/" V3" version suffix, so brand lookup and Tavily research see the
// REAL name instead of a mangled, versioned string. Used ONLY for brand
// identification and research — never for slugs/filenames (those still use
// stripSpecialChars, unchanged).
function cleanNameForResearch(name) {
  if (!name) return name;
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+V\d+$/i, "")            // strip trailing " V2", " V3", etc.
    .replace(/[^a-zA-Z0-9\s'&.-]/g, "")  // keep apostrophes, &, ., -
    .replace(/\s+/g, " ")
    .trim();
}

// ── XML escape ────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Arial Bold width table ────────────────────────────────────────────────────
const ARIAL_BOLD_W = {
  " ": 0.278, "!": 0.333, '"': 0.474, "#": 0.556, "$": 0.556, "%": 0.889,
  "&": 0.722, "'": 0.278, "(": 0.333, ")": 0.333, "*": 0.389, "+": 0.584,
  ",": 0.278, "-": 0.333, ".": 0.278, "/": 0.278, "0": 0.556, "1": 0.556,
  "2": 0.556, "3": 0.556, "4": 0.556, "5": 0.556, "6": 0.556, "7": 0.556,
  "8": 0.556, "9": 0.556, ":": 0.333, ";": 0.333, "<": 0.584, "=": 0.584,
  ">": 0.584, "?": 0.611, "@": 0.975, "A": 0.722, "B": 0.722, "C": 0.667,
  "D": 0.722, "E": 0.667, "F": 0.611, "G": 0.778, "H": 0.722, "I": 0.278,
  "J": 0.556, "K": 0.722, "L": 0.611, "M": 0.833, "N": 0.722, "O": 0.778,
  "P": 0.667, "Q": 0.778, "R": 0.722, "S": 0.667, "T": 0.611, "U": 0.722,
  "V": 0.667, "W": 0.944, "X": 0.667, "Y": 0.667, "Z": 0.611, "[": 0.333,
  "\\": 0.278, "]": 0.333, "^": 0.584, "_": 0.556, "`": 0.278, "a": 0.556,
  "b": 0.611, "c": 0.556, "d": 0.611, "e": 0.556, "f": 0.333, "g": 0.611,
  "h": 0.611, "i": 0.278, "j": 0.278, "k": 0.556, "l": 0.278, "m": 0.889,
  "n": 0.611, "o": 0.611, "p": 0.611, "q": 0.611, "r": 0.389, "s": 0.556,
  "t": 0.333, "u": 0.611, "v": 0.556, "w": 0.778, "x": 0.556, "y": 0.556,
  "z": 0.500, "{": 0.389, "|": 0.280, "}": 0.389, "~": 0.584,
};
const FALLBACK_W = 0.62;

function measureText(text, fontSize) {
  let w = 0;
  for (const ch of text) w += (ARIAL_BOLD_W[ch] ?? FALLBACK_W) * fontSize;
  return Math.ceil(w);
}

// ── Watermark ─────────────────────────────────────────────────────────────────
async function applyWatermark(buffer, wm) {
  if (!wm?.enabled || !wm?.text?.trim()) return buffer;

  const meta = await sharp(buffer).metadata();
  const W = meta.width;
  const H = meta.height;

  const fontSize = Math.max(1, wm.fontSize ?? Math.floor(W * 0.04));
  const opacity = Math.min(1, Math.max(0, (wm.opacity ?? 30) / 100));
  const color = wm.color || "#ffffff";
  const position = wm.position || "center";

  const textW = measureText(wm.text, fontSize);
  const textH = Math.ceil(fontSize * 1.15);
  const pad = Math.max(8, Math.floor(Math.min(W, H) * 0.015));

  let tx, ty;
  switch (position) {
    case "top-left": tx = pad; ty = pad; break;
    case "top-right": tx = W - pad - textW; ty = pad; break;
    case "top-center": tx = Math.round((W - textW) / 2); ty = pad; break;
    case "bottom-left": tx = pad; ty = H - pad - textH; break;
    case "bottom-right": tx = W - pad - textW; ty = H - pad - textH; break;
    case "bottom-center": tx = Math.round((W - textW) / 2); ty = H - pad - textH; break;
    case "center":
    default: tx = Math.round((W - textW) / 2); ty = Math.round((H - textH) / 2); break;
  }

  tx = Math.max(0, Math.min(tx, W - textW));
  ty = Math.max(0, Math.min(ty, H - textH));

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <text x="${tx}" y="${ty}" text-anchor="start" dominant-baseline="hanging"
    font-size="${fontSize}" font-weight="bold" font-family="Arial, sans-serif"
    fill="${color}" opacity="${opacity.toFixed(4)}" letter-spacing="0"
  >${escapeXml(wm.text)}</text>
</svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toBuffer();
}

// ── Preview generator: logo ko white canvas ke center mein rakhta hai ────────
// fit:"inside" → na stretch, na crop. Canvas exact width×height hi banta hai.
const PREVIEW_PADDING = 0.12; // default (OG image ke liye)

async function buildPreviewWebp(pngBuffer, width, height, watermark, padding = PREVIEW_PADDING) {
  // Transparent margin hata do taaki padding sahi ginti ho (fail ho to original use hoga)
  let source = pngBuffer;
  try {
    source = await sharp(pngBuffer).trim().toBuffer();
  } catch { source = pngBuffer; }

  const innerW = Math.round(width * (1 - padding * 2));
  const innerH = Math.round(height * (1 - padding * 2));

  const resizedLogo = await sharp(source)
    .resize(innerW, innerH, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  // Clean white canvas + logo center mein
  const canvasPng = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: resizedLogo, gravity: "center" }])
    .png()
    .toBuffer();

  // Watermark final canvas par (agar enabled ho)
  const finalPng = await applyWatermark(canvasPng, watermark);

  return sharp(finalPng).webp({ quality: 90 }).toBuffer();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function logoNameFromFolderName(folderName) {
  return folderName
    .replace(/^\d+\s+/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

function generateSlugFromName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\bversion\s*\d+\b/g, "")
    .replace(/\bv\.?\s*\d+\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function getSignificantWords(name) {
  const stop = new Set(["logo", "version", "the", "and", "of", "new", "old"]);
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !stop.has(w) && !/^v\.?\d+$/.test(w) && !/^\d+$/.test(w));
}



// ── Banned phrases & educational phrases ─────────────────────────────────────
const BANNED_PHRASES = [
  "free download",
  "free",
  "download",
  "get it now",
  "perfect for",
  "great for",
  "ideal for",
  "best for",
  "business use",
  "commercial project",
  "branding need",
  "marketing material",
  "premium quality",
  "high quality asset",
  "suitable for project",
  "useful for creator",
  "design asset",
  "creative work",
  "elevate your brand",
  "industry leader",
  "trusted worldwide",
  "modern branding",
  "cutting-edge",
  "cutting edge",
  "innovative",
  "stunning",
  "for your project",
  "for your brand",
];



function containsBannedPhrase(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function hasEducationalPhrase(text) {
  if (!text) return false;
  const lower = String(text).toLowerCase();
  return EDUCATIONAL_PHRASES.some((p) => lower.includes(p));
}

// Standalone literal "brand"/"company" word check — only relevant for
// TEMPLATE logos, where there is no real brand and the model must never
// fall back to using the word "brand" as a placeholder subject (e.g.
// "by brand", "this brand", "the company") since that reads as spam/thin
// content to Google. Uses \b so it doesn't flag "branded"/"brandable" etc.
// mid-word — those are still awkward but the exact placeholder phrases are
// the actual issue, so we match the literal standalone tokens.
const PLACEHOLDER_BRAND_PATTERN = /\b(by brand|the brand|this brand|a brand|brand's|the company)\b/i;



// ── RELAXED LLM-BASED FALLBACK ────────────────────────────────────────────
// Runs when the strict 3-attempt gate in generateMainDescription rejects
// every attempt. Unlike the static template, this still calls the LLM with
// the same facts/research/visual data — just with looser, faster
// validation — so output stays natural and fact-grounded instead of
// collapsing into a hardcoded sentence.
//
async function generateFallbackDescriptionViaLLM({
  logoName, brand, website, country, industry, contextText, hasResults,
  canonicalUrl, relatedDescriptions = [], visualFacts = null,
}) {
  const subject = brand || logoName;

  const siblingBlock = relatedDescriptions.length
    ? `\n\nPREVIOUSLY PUBLISHED DESCRIPTIONS FOR RELATED VERSIONS OF THIS SAME LOGO (write something that reads clearly differently from ALL of these — different opening, different structure, different sentence order; reuse an already-established fact like HQ or founding year if relevant, but never reuse sentence phrasing):\n${relatedDescriptions
      .map((d, i) => `v${i + 1}: ${d}`)
      .join("\n\n")}`
    : "";

  const visualBlock = visualFacts?.hasVisualFacts
    ? `\n\nVISUAL FACTS (from actually looking at the uploaded logo file — the ONLY allowed source for any color/shape claim):\n${visualFacts.visualFactsText}\n\nIf multiple colors are listed above, you may mention them together as a group (e.g. "a multicolor icon in yellow, orange, red, pink, purple, and blue") rather than describing each one separately.`
    : `\n\nVISUAL FACTS: none available — do not state any color or shape claim.`;

  const factsBlock = `Brand    : ${subject}
Country  : ${country || "(unknown)"}
Industry : ${industry || "(unknown)"}
Website  : ${website || "(unknown — do not mention a website)"}`;

  const researchBlock = hasResults
    ? `\n\nRESEARCH NOTES (web search — use ONLY for what the company actually does/products/services, founding date, or HQ — never for color/shape, that's VISUAL FACTS only):\n${contextText.slice(0, 4000)}`
    : `\n\nRESEARCH NOTES: none found.`;

  const basePrompt = `Write a short, factual "About this logo" paragraph for a logo reference page. Around 70-110 words. Plain, natural human English — not corporate marketing copy, not a Wikipedia-style opening sentence.

HARD RULES:
- Never open with "[Name] is the brand associated with this logo," "[Name] is the company behind this logo," "This logo represents [Name]," or any similarly generic identity-restating sentence. Open with a concrete fact instead: what the company actually does, where it's based, when it was founded, or what's visible in the logo.
- Use ONLY the facts given below — brand, country, industry, website — plus, if present, what RESEARCH NOTES say about what the company actually makes/sells/does. Never invent a founding date, designer, or history not present in the notes.
- Any color or shape claim must come only from VISUAL FACTS, never elsewhere. If several colors are listed, you can group them into one natural clause instead of listing every one individually.
- Do NOT mention file formats or educational/reference wording. The last sentence must be a real fact, not a closing line.
- Never mention "${canonicalUrl}" or cdrlogo.com anywhere.
- Vary sentence length — don't make every sentence the same length.
- Never use: Free, Download, Perfect for, Great for, Ideal for, Best for, business use, commercial project, branding needs, marketing material, premium quality, elevate your brand, industry leader, cutting-edge, innovative, stunning.
- Never write "this page archives/provides..." or "visitors can review/compare..." — describe the logo/brand, never the page.

FACTS:
${factsBlock}${researchBlock}${visualBlock}${siblingBlock}

Return ONLY JSON: { "description": "..." }`;

  async function run(extraNote = "") {
    const messages = [
      {
        role: "system",
        content: "You write short, factual, natural-sounding descriptions for a logo reference archive. You never invent facts and never sound like a template. Return only JSON.",
      },
      { role: "user", content: basePrompt },
    ];
    if (extraNote) messages.push({ role: "user", content: extraNote });

    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0.6,
      messages,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }
    return fixMissingSpaceAfterPeriod(
      stripMarkdownLinks((parsed.description && String(parsed.description).trim()) || "")
    );
  }

  const GENERIC_OPENING = /^\s*["'’]?[\w'’.-]+(?:\s[\w'’.-]+){0,4}\s+is the (brand|company) (associated with|behind) this logo/i;

  const MAX_FALLBACK_ATTEMPTS = 3;
  let lastReason = "";

  for (let attempt = 0; attempt < MAX_FALLBACK_ATTEMPTS; attempt++) {
    const note =
      attempt === 0
        ? ""
        : `Your previous attempt was rejected because ${lastReason}. Rewrite it fully, fixing that issue.`;

    let description = "";
    try {
      description = await run(note);
    } catch (err) {
      console.warn(`  [description:fallback-llm] Attempt ${attempt + 1}/${MAX_FALLBACK_ATTEMPTS} threw: ${err.message}`);
      lastReason = `the generation call itself failed (${err.message})`;
      continue;
    }

    const bannedHit = containsBannedPhrase(description);
    const aiArtifactHit = containsAIArtifactPhrase(description);
    const leakedInternalUrl =
      description && (description.includes(canonicalUrl) || /cdrlogo\.com/i.test(description));
    const genericOpening = GENERIC_OPENING.test(description || "");
    const pageFillerHit = containsPageFillerPhrase(description);
    const closingFillerHit = containsClosingFiller(description);

    const nearDup = description ? findNearDuplicate(description, relatedDescriptions) : null;
    const colorIssues = checkColorsAgainstVisualFacts(description, visualFacts);

    const hardBad =
      !description || bannedHit || aiArtifactHit || leakedInternalUrl ||
      genericOpening || pageFillerHit || closingFillerHit;

    const softBad = attempt === 0 && (nearDup || colorIssues.length > 0);

    if (colorIssues.length) console.log(`  [description:fallback-llm] Color note (attempt ${attempt + 1}): ${colorIssues.join("; ")}`);
    if (nearDup) console.log(`  [description:fallback-llm] Near-dup note (attempt ${attempt + 1}): ${(nearDup.score * 100).toFixed(0)}% overlap`);

    if (!hardBad && !softBad) {
      console.log(`  [description:fallback-llm] Succeeded on attempt ${attempt + 1}/${MAX_FALLBACK_ATTEMPTS}.`);
      return description;
    }

    const reasons = [];
    if (!description) reasons.push("it returned empty");
    if (bannedHit) reasons.push(`it used the banned phrase "${bannedHit}"`);
    if (aiArtifactHit) reasons.push(`it used the AI-artifact phrase "${aiArtifactHit}"`);
    if (leakedInternalUrl) reasons.push("it mentioned the internal archive URL/domain");
    if (genericOpening) reasons.push('it opened with the generic "is the brand associated with this logo" pattern');
    if (pageFillerHit) reasons.push(`it used "about the archive page" language ("${pageFillerHit}")`);
    if (closingFillerHit) reasons.push(`it contains "${closingFillerHit}" — no file-format/reference sentence allowed`);
    if (softBad && nearDup) reasons.push(`it is too similar (${(nearDup.score * 100).toFixed(0)}%) to a sibling description`);
    if (softBad && colorIssues.length) reasons.push(colorIssues.join("; "));

    lastReason = reasons.join("; and ") || "it failed validation";
    console.warn(`  [description:fallback-llm] Attempt ${attempt + 1}/${MAX_FALLBACK_ATTEMPTS} rejected — ${lastReason}`);
  }

  console.warn(`  [description:fallback-llm] All ${MAX_FALLBACK_ATTEMPTS} attempts exhausted — falling through to static template.`);
  return null;
}


function containsPlaceholderBrandWord(text) {
  if (!text) return false;
  return PLACEHOLDER_BRAND_PATTERN.test(String(text));
}

function scanTemplateFieldsForPlaceholderBrand(parsed) {
  const hits = [];
  const fields = {
    meta_title: parsed.meta_title,
    meta_description: parsed.meta_description,
    main_description: parsed.main_description,
    alt_text: parsed.alt_text,
    og_title: parsed.og_title,
    og_description: parsed.og_description,
    twitter_title: parsed.twitter_title,
    twitter_description: parsed.twitter_description,
    image_object_description: parsed.image_object_description,
  };
  for (const [field, value] of Object.entries(fields)) {
    if (containsPlaceholderBrandWord(value)) hits.push(field);
  }
  if (Array.isArray(parsed.faq)) {
    parsed.faq.forEach((qa, i) => {
      if (containsPlaceholderBrandWord(qa?.answer) || containsPlaceholderBrandWord(qa?.question)) {
        hits.push(`faq[${i}]`);
      }
    });
  }
  return hits;
}

// ── Validate AI response against hard rules ───────────────────────────────────
// NOTE: main_description is now generated by a dedicated research-based
// pipeline (see generateMainDescription) and is intentionally NOT checked
// here for banned/educational phrases or duplicate openers — those rules
// belonged to the old style-based generator. It is still scanned for the
// TEMPLATE placeholder-brand-word guard since a blank description trivially
// passes that check anyway.
function validateAIContent(parsed, { usedTitles = [], usedFaqQuestions = [], isTemplate = false } = {}) {
  const violations = [];

  const fieldsToScan = {
    meta_title: parsed.meta_title,
    meta_description: parsed.meta_description,
    alt_text: parsed.alt_text,
    og_title: parsed.og_title,
    og_description: parsed.og_description,
    twitter_title: parsed.twitter_title,
    twitter_description: parsed.twitter_description,
    image_object_description: parsed.image_object_description,
  };

  for (const [field, value] of Object.entries(fieldsToScan)) {
    const hit = containsBannedPhrase(value);
    if (hit) violations.push(`${field} contains banned phrase: "${hit}"`);
  }

  if (Array.isArray(parsed.faq)) {
    parsed.faq.forEach((qa, i) => {
      const hit = containsBannedPhrase(qa?.answer);
      if (hit) violations.push(`faq[${i}].answer contains banned phrase: "${hit}"`);
      if (
        qa?.question &&
        usedFaqQuestions.some(
          (q) => q && q.trim().toLowerCase() === String(qa.question).trim().toLowerCase()
        )
      ) {
        violations.push(`faq[${i}].question duplicates a previous page's FAQ question`);
      }
    });
  }

  if (!hasEducationalPhrase(parsed.meta_description))
    violations.push("meta_description missing required educational/reference/research phrase");
  if (!hasEducationalPhrase(parsed.og_description))
    violations.push("og_description missing required educational/reference phrase");
  if (!hasEducationalPhrase(parsed.twitter_description))
    violations.push("twitter_description missing required educational/reference phrase");

  if (
    parsed.meta_title &&
    usedTitles.some(
      (t) => t && t.trim().toLowerCase() === String(parsed.meta_title).trim().toLowerCase()
    )
  ) {
    violations.push("meta_title is identical to a previous page's meta_title");
  }

  if (isTemplate) {
    const placeholderHits = scanTemplateFieldsForPlaceholderBrand(parsed);
    placeholderHits.forEach((field) =>
      violations.push(`${field} uses placeholder word "brand"/"company" on a TEMPLATE logo (no real brand exists)`)
    );
  }

  return violations;
}

// ── Schema builders ───────────────────────────────────────────────────────────
function buildBreadcrumbSchema({ brand, logoName, canonicalUrl }) {
  const brandLabel = (brand && brand.trim()) ? brand.trim() : "Logos";
  const brandSlug = generateSlugFromName(brandLabel);
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cdrlogo.com" },
      { "@type": "ListItem", "position": 2, "name": "Logos", "item": `https://www.cdrlogo.com/logos` },
      { "@type": "ListItem", "position": 3, "name": logoName, "item": canonicalUrl },
    ],
  };
}

function buildImageObjectSchema({ imageUrl, logoName, brand, canonicalUrl, description }) {
  if (!imageUrl) return {};
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "contentUrl": imageUrl,
    "url": imageUrl,
    "width": 1200,
    "height": 1200,
    "encodingFormat": "image/webp",
    "name": `${logoName}`,
    "description": description || `${logoPhrase(logoName)} image on cdrlogo.com`,
    "representativeOfPage": true,
    ...(brand ? { "creator": { "@type": "Organization", "name": brand } } : {}),
    "mainEntityOfPage": canonicalUrl,
  };
}
function buildFaqSchema(faqPairs) {
  if (!Array.isArray(faqPairs) || !faqPairs.length) return {};  // {} not []
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqPairs.slice(0, 2).map((qa) => ({
      "@type": "Question",
      "name": qa.question || qa.q || "",
      "acceptedAnswer": { "@type": "Answer", "text": qa.answer || qa.a || "" },
    })),
  };
}

// ── DB: find related / exact matches ─────────────────────────────────────────
async function findRelatedLogos(logoName) {
  const words = getSignificantWords(logoName);
  if (!words.length) return { related: [], exactNormalizedMatches: [] };

  const candidates = await prisma.logo.findMany({
    where: {
      OR: words.map((w) => ({ logoName: { contains: w, mode: "insensitive" } })),
    },
    select: {
      logoName: true,
      metaTitle: true,
      metaDescription: true,
      description: true,
      tags: true,
      category: true,
      brand: true,
      website: true,
      country: true,
      industry: true,
      slug: true,
      faqSchema: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const targetNorm = normalizeName(logoName);
  const exactNormalizedMatches = candidates.filter(
    (c) => normalizeName(c.logoName) === targetNorm
  );

  return { related: candidates.slice(0, 10), exactNormalizedMatches };
}
function stripAccents(text) {
  if (!text) return text;
  // stripMarkdownLinks is a function declaration further down the file —
  // hoisted, so calling it here before its textual definition is safe.
  return stripMarkdownLinks(
    text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );
}

// returns the name with exactly one trailing "logo", never two
function logoPhrase(name) {
  const trimmed = String(name || "").trim();
  return /\blogo\b\s*$/i.test(trimmed) ? trimmed : `${trimmed} logo`;
}

// ── Backstop for the missing-space-after-period bug (e.g.
// "reference.Users" → "reference. Users"). Used on main_description output.
function fixMissingSpaceAfterPeriod(text) {
  if (!text) return text;
  return text.replace(/([.!?])([A-Z])/g, "$1 $2");
}

// ── Auto-version name ─────────────────────────────────────────────────────────
function generateVersionedName(logoName, exactNormalizedMatches) {
  const usedVersions = new Set();

  for (const match of exactNormalizedMatches) {
    const m = match.logoName.match(/\bv(?:ersion)?\.?\s*(\d+)\b/i);
    if (m) usedVersions.add(parseInt(m[1], 10));
    else usedVersions.add(1);
  }

  let next = 1;
  while (usedVersions.has(next)) next++;
  if (next === 1 && usedVersions.has(1)) next = 2;

  const cleanBase = logoName
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\bversion\s*\d+\b/gi, "")
    .replace(/\bv\.?\s*\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${cleanBase} V${next}`;
}

// ── OpenAI with 1 retry ───────────────────────────────────────────────────────
async function callOpenAIWithRetry(params, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[OpenAI] Attempt ${attempt + 1} failed, retrying in 1s...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

// ── Tavily web search (real research for main_description) ──────────────────
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
const TAVILY_ENDPOINT = "https://api.tavily.com/search";

async function tavilySearch(query, maxResults = 4) {
  if (!TAVILY_API_KEY) {
    console.warn(`  [tavily] TAVILY_API_KEY not set — skipping search for "${query}"`);
    return [];
  }
  try {
    const res = await fetch(TAVILY_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query,
        search_depth: "advanced",
        max_results: maxResults,
        include_answer: false,
        include_raw_content: false,
      }),
    });
    if (!res.ok) {
      console.warn(`  [tavily] Search failed (${res.status}) for "${query}"`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data?.results) ? data.results : [];
  } catch (err) {
    console.warn(`  [tavily] Error searching "${query}": ${err.message}`);
    return [];
  }
}

// ── Real visual facts from the actual logo file ──────────────────────────
// Text search (Tavily) often describes a DIFFERENT era, sub-brand, or
// unrelated product using the same brand name. This looks at the actual
// uploaded image and reports only what's literally visible — this becomes
// the ONLY allowed source for color/shape/symbol claims.
async function analyzeLogoImageVisually(pngBuffer) {
  if (!pngBuffer) return { hasVisualFacts: false, visualFactsText: "", rawColors: [] };

  try {
    const base64Image = pngBuffer.toString("base64");
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content: `You are a precise visual analyst. Describe ONLY what is literally visible in the image — actual colors present, actual shapes, actual visible text, actual symbols. Never guess brand history or meaning. Never invent anything not visibly present. Return only JSON.`,
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Look at this logo image. Describe ONLY what is literally visible — do not guess what the brand is or what anything "means."

Return ONLY this JSON:
{
  "colors": ["plain color name", "plain color name"],
  "shape": "e.g. circular badge / shield / rectangular wordmark / abstract mark / icon+text combo",
  "text_visible": "exact text visible in the logo, or empty string",
  "symbols": "literal description of any icon/symbol/mascot — what is drawn, not what it might mean",
  "layout": "e.g. icon above text / icon beside text / text only / icon only"
}`,
            },
            { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const colors = Array.isArray(parsed.colors)
      ? parsed.colors.filter(Boolean).map(c => String(c).toLowerCase().trim())
      : [];

    const parts = [];
    if (colors.length) parts.push(`Colors actually visible in the image: ${colors.join(", ")}.`);
    if (parsed.shape) parts.push(`Shape: ${parsed.shape}.`);
    if (parsed.text_visible) parts.push(`Visible text: "${parsed.text_visible}".`);
    if (parsed.symbols) parts.push(`Symbols/icon: ${parsed.symbols}.`);
    if (parsed.layout) parts.push(`Layout: ${parsed.layout}.`);

    const visualFactsText = parts.join(" ");
    console.log(`  [vision] colors=[${colors.join(", ")}] shape="${parsed.shape || ""}"`);

    return {
      hasVisualFacts: !!visualFactsText,
      visualFactsText,
      rawColors: colors,
      textVisible: String(parsed.text_visible || "").trim(),
      symbolsText: String(parsed.symbols || "").trim(),
      shapeText: String(parsed.shape || "").trim(),
    };
  } catch (err) {
    console.warn(`  [vision] Image analysis failed: ${err.message} — colors/shape will not be stated.`);
    return { hasVisualFacts: false, visualFactsText: "", rawColors: [] };
  }
}

async function researchBrandFacts(logoName, brand) {
  const subject = (brand && brand.trim()) || logoName;

  const queries = [
    `${subject} what does the company do products services`,
    `${subject} logo history design meaning`,
    `${subject} official brand colors hex code`,
    `${subject} founded headquarters official website`,
    `${subject} logo redesign year designer typography change`,
  ];

  const resultsArrays = await Promise.all(queries.map((q) => tavilySearch(q, 4)));
  const allResults = resultsArrays.flat();

  const seen = new Set();
  const deduped = allResults.filter((r) => {
    if (!r?.url || seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });

  if (!deduped.length) {
    console.log(`  [research] No usable search results for "${subject}"`);
    return { hasResults: false, contextText: "" };
  }

  const contextText = deduped
    .slice(0, 10)
    .map((r, i) => `Source ${i + 1} (${r.url}):\n${(r.content || "").slice(0, 900)}`)
    .join("\n\n");

  console.log(`  [research] ${deduped.length} source(s) found for "${subject}"`);
  return { hasResults: true, contextText };
}


function buildStaticEmergencyFallback(logoName, { brand, website, country, industry } = {}, relatedDescriptions = [], visualFacts = null) {
  const subject = brand || logoName;
  const siblingIndex = relatedDescriptions.length;

  let visualSentence = "";
  if (visualFacts?.hasVisualFacts) {
    const shapeMatch = visualFacts.visualFactsText.match(/Shape:\s*([^.]+)\./i);
    const shape = shapeMatch ? shapeMatch[1].trim() : null;
    const colors = visualFacts.rawColors?.length ? visualFacts.rawColors.join(" and ") : null;
    if (shape && colors) visualSentence = ` The logo is a ${shape}, rendered in ${colors}.`;
    else if (shape) visualSentence = ` The logo is a ${shape}.`;
    else if (colors) visualSentence = ` The logo appears in ${colors}.`;
  }

  const n = FALLBACK_OPENING_TEMPLATES.length;
  for (let i = 0; i < n; i++) {
    const idx = (siblingIndex + i) % n;
    const candidate =
      FALLBACK_OPENING_TEMPLATES[idx](subject) + visualSentence +
      (country ? ` ${FALLBACK_HQ_TEMPLATES[idx % FALLBACK_HQ_TEMPLATES.length](subject, country)}` : "") +
      (industry ? ` ${FALLBACK_INDUSTRY_CONTEXT_TEMPLATES[idx % FALLBACK_INDUSTRY_CONTEXT_TEMPLATES.length](subject, industry)}` : "") +
      (website ? ` ${FALLBACK_WEBSITE_TEMPLATES[idx % FALLBACK_WEBSITE_TEMPLATES.length](subject, website)}` : "");
    if (!findNearDuplicate(candidate, relatedDescriptions)) return candidate.trim();
  }
  return (FALLBACK_OPENING_TEMPLATES[siblingIndex % n](subject) + visualSentence +
    (country ? ` ${FALLBACK_HQ_TEMPLATES[0](subject, country)}` : "")).trim();
}


// ============================================================================
// PATCH START — generateMainDescription + supporting helpers
// Fixes:
//  #1 Word-count enforcement (was defined in prompt, never checked in code)
//  #2 Case B educational-phrase check
//  #3 Rotating "opening angle" per logo
//  #4 Rotating closing sentence (3 variants)
//  #5 Sibling/variant description awareness (relatedDescriptions param)
//  #6 NEW — up to 3 full generation attempts before accepting a blank
//     description, so a Draft-status fallback (see processOneLogoFolder)
//     is only used when the description GENUINELY has nothing behind it.
// ============================================================================

// stable hash so the same logoName always gets the same rotation
function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

function wordCount(text) {
  return text ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function isWordCountFarOff(caseUsed, wc) {
  if (caseUsed === "A" || caseUsed === "B") return wc < 90 || wc > 130;
  return false;
}

// Tied to the SIBLING COUNT (i.e. which version number this is), not a hash
// of the name — this guarantees V1/V2/V3 of the SAME logo always get a
// different angle in sequence, instead of a hash occasionally assigning
// the same angle to two versions of the same name by chance.
const FOCUS_ANGLES = [
  "Focus on brand identity and what the visual symbol literally depicts — what is drawn, and its documented origin (e.g. family crest, mascot, initials). Do not lead with founding date or colors.",
  "Focus on the official colors and concrete visual design elements (shape, layout, typography style) — name colors and describe what's visually present. Do not lead with the symbol's origin story.",
  "Focus on the logo's history and redesign timeline — when it changed, what changed, and why (if documented). Do not lead with colors or the symbol's origin.",
  "Focus on the company's HQ location, industry, and any documented technical/typography detail — keep the origin story and redesign history to a single short clause at most.",
];

const OPENING_ANGLES = [
  "Open the description with the founding date and origin story, then move to the logo itself.",
  "Open the description by describing what is visually in the logo first — shapes, imagery, colors — before any history or dates.",
  "Open the description with what the brand/club/organization is actually known for or does, then move into the logo's design.",
  "Open the description with the most recent redesign or the current logo's launch date, then work backward to earlier history if relevant.",
];

const EDUCATIONAL_PHRASES = [
  "educational use", "educational reference", "reference use",
  "research purposes", "research use", "design reference",
  "study purposes", "informational reference", "learning reference",
  "reference material", "archival reference",
];



function pickRotation(logoName, arr) {
  const idx = Math.abs(hashString(logoName)) % arr.length;
  return { value: arr[idx], index: idx };
}

function containsClosingFiller(text) {
  if (!text) return null;
  const t = String(text);
  const m =
    t.match(/\b(png|svg|cdr|file formats?|vector files?)\b/i) ||
    t.match(/\bAI\b/) ||
    t.match(/\b(educational (use|reference)|reference (use|purposes|material)|research (purposes|use)|archival (use|reference))\b/i);
  return m ? m[0] : null;
}

const SMALL_WORDS = new Set(["of", "and", "the", "de", "da", "do", "du", "la", "le", "von", "van"]);

function toProperCase(name) {
  if (!name) return name;
  return String(name).trim().split(/(\s+|-)/).map((part, i) => {
    if (!part || /^\s+$/.test(part) || part === "-") return part;
    if (/\d/.test(part)) return part.toUpperCase();
    const lower = part.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lower)) return lower;
    if (/^[A-Z]{2,3}$/.test(part)) return part;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  }).join("");
}

// ── Rotation helpers — collision-resistant even with zero sibling data ─────
// FIX: previously indexed purely off relatedDescriptions (a DB snapshot).
// If two "first version" uploads run close together, both see zero
// siblings and BOTH picked index 0 — the opposite of variety. Mixing in a
// hash of the logo name guarantees variation even when sibling data is
// empty or stale (e.g. concurrent uploads, DB write not yet committed).
function pickFocusAngle(siblingCount, arr, logoName = "") {
  const base = siblingCount + Math.abs(hashString(logoName));
  const idx = base % arr.length;
  return { value: arr[idx], index: idx };
}


// ── Color-consistency helper ─────────────────────────────────────────────
// Extracts known color words mentioned in a text so a new version's
// description can be forced to match (or explicitly justify diverging
// from) what prior sibling versions already stated as the official colors.
const KNOWN_COLOR_WORDS = [
  "red", "blue", "green", "yellow", "orange", "purple", "pink", "black",
  "white", "gray", "grey", "brown", "gold", "golden", "silver", "navy",
  "teal", "maroon", "cyan", "magenta", "beige", "tan", "cream", "burgundy",
  "turquoise", "violet", "indigo", "crimson", "amber", "charcoal",
];

function extractColorWords(text) {
  if (!text) return [];
  const lower = String(text).toLowerCase();
  const found = new Set();
  for (const color of KNOWN_COLOR_WORDS) {
    if (new RegExp(`\\b${color}\\b`).test(lower)) found.add(color);
  }
  return [...found];
}

// ── Generalized fact-consistency extractors ──────────────────────────────
// Same principle as extractColorWords: pull a specific, checkable fact out
// of a sibling description so it can be carried forward as a hard
// constraint, instead of leaving consistency entirely up to the model
// re-reading full sibling text. Covers the two contradiction types seen in
// practice: HQ location drifting (Vevey, Switzerland → Arlington, Virginia)
// and a historical date drifting (shield removed "1938" → "1868").
function extractHQLocation(text) {
  if (!text) return null;
  const m = String(text).match(
    /headquarter(?:ed|s)\s+(?:are|is\s+)?(?:located\s+)?in\s+([^.,;]+)/i
  );
  return m ? m[1].trim() : null;
}

function extractFoundingYear(text) {
  if (!text) return null;
  const m = String(text).match(/founded\s+(?:in\s+)?(\d{4})/i);
  return m ? m[1] : null;
}

// Strips markdown link syntax that occasionally leaks into model output
// (e.g. "[www.nestle.com](https://www.nestle.com)") down to plain text —
// these fields render as plain prose, not markdown, so a raw [text](url)
// pair shows up as broken syntax to a reader.
function stripMarkdownLinks(text) {
  if (!text) return text;
  return String(text).replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$2");
}

// ── Fluff / mission-narrative filler check ───────────────────────────────
// These are the phrases that turn a factual description into a marketing
// mission statement — technically not in BANNED_PHRASES (not promotional),
// but they're interpretive filler rather than fact and are what makes a
// short factual brief balloon into a big vague paragraph.
const FLUFF_PHRASES = [
  "long-standing connection",
  "heritage and mission",
  "closely linked to",
  "closely tied to",
  "reflects the company's",
  "reflects the brand's",
  "timeless",
  "beloved",
  "cherished",
  "iconic status",
  "enduring legacy",
  "rich history",
  "commitment to",
];

function containsFluffPhrase(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const phrase of FLUFF_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}
// ── ABOUT-THE-PAGE FILLER (never allowed) — the description must be about
// the LOGO, never about the website/archive page itself. This is exactly
// the boilerplate the client flagged: "this page archives...", "visitors
// can review/compare...", "alongside related versions...". Catching these
// closes the loop whether the boilerplate comes from the LLM OR a fallback.
const PAGE_FILLER_PHRASES = [
  "this page archives",
  "this page provides",
  "visitors can review",
  "visitors can compare",
  "alongside related versions",
  "compare resolution, transparency",
  "available on this page",
  "review the available",
];

function containsPageFillerPhrase(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const phrase of PAGE_FILLER_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

// detects a stray hex/RGB/Pantone code slipping into the description
function containsColorCode(text) {
  if (!text) return false;
  if (/#[0-9a-f]{3,8}\b/i.test(text)) return true;
  if (/\brgb\s*\(/i.test(text)) return true;
  if (/\bpantone\s*\d/i.test(text)) return true;
  return false;
}

// ── FACTS MUST MATCH REAL WEB SEARCH RESULTS ─────────────────────────────
// Sibling-consistency checks above only verify a fact is CONSISTENT across
// versions — never that it's actually TRUE per the Tavily research. This
// closes that gap: any year or HQ token stated in the description must
// actually appear in contextText, or it's flagged as hallucinated.
//
// FIX: color checking was REMOVED from this function. Colors are sourced
// exclusively from VISUAL FACTS (the actual image, via
// analyzeLogoImageVisually) and are validated exclusively by
// checkColorsAgainstVisualFacts. Text research (Tavily) frequently
// describes an outdated, wrong, or unrelated version of a logo's colors —
// checking colors against it produced false "hallucinated" rejections on
// real, image-verified colors (e.g. TCS: vision correctly found 6 colors,
// but Tavily text called the logo "monochromatic," and this function was
// rejecting the CORRECT colors as fake, which then caused the model to
// "fix" it by inventing a false "monochromatic" claim instead). Running
// two different authorities (text vs image) over the same field is a
// contradiction, not a safety net — the image is authoritative for what's
// visually in the logo, full stop.
function checkDescriptionAgainstSource(description, contextText) {
  const reasons = [];
  if (!description) return reasons;
  if (!contextText || !contextText.trim()) {
    if (/\b(19|20)\d{2}\b/.test(description)) {
      reasons.push("description states a specific year but no research source text exists to verify it against");
    }
    return reasons;
  }
  const sourceLower = contextText.toLowerCase();

  const yearsInDescription = [...new Set((description.match(/\b(19|20)\d{2}\b/g) || []))];
  yearsInDescription.forEach((year) => {
    if (!sourceLower.includes(year)) {
      reasons.push(`description states the year ${year}, which does not appear in the research source — likely hallucinated`);
    }
  });

  const hqInDescription = extractHQLocation(description);
  if (hqInDescription) {
    const firstToken = hqInDescription.split(/[\s,]+/)[0]?.toLowerCase();
    if (firstToken && firstToken.length > 2 && !sourceLower.includes(firstToken)) {
      reasons.push(`description states headquarters as "${hqInDescription}", but "${firstToken}" does not appear in the research source — likely hallucinated`);
    }
  }

  return reasons;
}

function checkColorsAgainstVisualFacts(description, visualFacts) {
  const reasons = [];
  const colorsInDescription = extractColorWords(description);
  if (!colorsInDescription.length) return reasons;

  if (!visualFacts?.hasVisualFacts) {
    reasons.push(`description states color(s) [${colorsInDescription.join(", ")}] but no image analysis exists to verify them — remove them`);
    return reasons;
  }
  const visibleSet = new Set(visualFacts.rawColors);
  colorsInDescription.forEach((c) => {
    if (!visibleSet.has(c)) {
      reasons.push(`description states color "${c}", which is not among the colors actually visible in the image ([${visualFacts.rawColors.join(", ")}]) — likely hallucinated`);
    }
  });
  return reasons;
}

// ── LLM SEMANTIC FACT VERIFICATION ────────────────────────────────────────
// Regex/proximity checks (above) catch the cheap cases fast and for free.
// This catches what they can't: overclaiming (source supports 2 colors,
// description states 5), conflating a different entity's fact with this
// logo's fact, or subtly misstating a documented detail. Runs ONLY for
// Case A descriptions (the ones with enough claims to be worth the call) —
// Case B is too short to matter, Case C has no claims to check.
async function llmVerifyDescriptionFacts(description, contextText) {
  if (!description || !contextText || !contextText.trim()) return [];

  const prompt = `You are a strict fact-checker. Below is SOURCE TEXT (raw web research, may include unrelated tangents) and a DESCRIPTION that claims to be based only on it.

Your ONLY job: list every specific factual claim in the DESCRIPTION (a date, a color, a location, a count of something, a designer name, a redesign reason) that is NOT clearly and directly supported by the SOURCE TEXT when read in its actual context — including claims that use a real word from the source but apply it to the wrong subject (e.g. source says a sub-brand's packaging is blue, description claims the logo itself is blue).

Do not flag generic non-factual statements (e.g. "the logo is available in PNG and SVG format").

SOURCE TEXT:
${contextText.slice(0, 6000)}

DESCRIPTION TO CHECK:
${description}

Return ONLY JSON:
{ "unsupportedClaims": [ { "claim": "the exact claim", "reason": "why it isn't actually supported" } ] }
If every claim is properly supported, return { "unsupportedClaims": [] }.`;

  try {
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a strict, conservative fact-checker. You flag overclaiming, conflation, and misattribution — not just missing keywords. Return only JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed.unsupportedClaims) ? parsed.unsupportedClaims : [])
      .map((c) => `LLM fact-check: "${c.claim}" — ${c.reason}`);
  } catch (err) {
    console.warn(`  [description:factcheck] LLM verification failed: ${err.message} — falling back to regex-only checks.`);
    return [];
  }
}
// ── LLM SEMANTIC CHECK: FAQ ANSWERS vs DESCRIPTION ────────────────────────
// checkFaqAgainstDescription (below) only catches years/colors via regex.
// This catches everything else a FAQ answer might state that the
// description doesn't support: a symbol, shape, mascot, letter, designer
// name, HQ city, or redesign reason. Mirrors llmVerifyDescriptionFacts but
// compares FAQ answers against the description as ground truth, not the
// raw research text.
async function llmVerifyFaqAgainstDescription(faqPairs, description) {
  if (!description || !Array.isArray(faqPairs) || !faqPairs.length) return [];

  const prompt = `DESCRIPTION (this is the ONLY source of truth):
${description}

FAQ ANSWERS TO CHECK:
${faqPairs.map((qa, i) => `${i + 1}. Q: ${qa?.question || ""}\nA: ${qa?.answer || ""}`).join("\n\n")}

List every FAQ answer above that states a specific factual claim — a color, symbol, shape, letter, mascot, date, designer name, HQ location, or redesign reason — that is NOT stated in or directly supported by the DESCRIPTION. Do not flag generic statements about file formats, availability, or readability.

Return ONLY JSON:
{ "conflicts": [ { "index": 1, "claim": "the exact claim", "reason": "why the description doesn't support it" } ] }
If every FAQ answer is fully supported by the description, return { "conflicts": [] }.`;

  try {
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0,
      messages: [
        { role: "system", content: "You are a strict, conservative fact-checker comparing FAQ answers against a description. Flag any claim not clearly supported by the description, including conflation or overclaiming. Return only JSON." },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    const parsed = JSON.parse(raw);
    return (Array.isArray(parsed.conflicts) ? parsed.conflicts : [])
      .map((c) => `faq[${(c.index ?? 1) - 1}] fact-check: "${c.claim}" — ${c.reason}`);
  } catch (err) {
    console.warn(`  [faq:factcheck] LLM verification failed: ${err.message} — falling back to regex-only checks.`);
    return [];
  }
}

function checkFaqAgainstDescription(faqPairs, description) {
  const reasons = [];
  if (!Array.isArray(faqPairs) || !faqPairs.length) return reasons;
  const descLower = (description || "").toLowerCase();

  faqPairs.forEach((qa, i) => {
    const answer = qa?.answer || "";
    if (!answer) return;

    const yearsInAnswer = [...new Set((answer.match(/\b(19|20)\d{2}\b/g) || []))];
    const colorsInAnswer = extractColorWords(answer);

    if (!description) {
      if (yearsInAnswer.length || colorsInAnswer.length) {
        reasons.push(`faq[${i}].answer states specific facts (${[...yearsInAnswer, ...colorsInAnswer].join(", ")}) but no description/VERIFIED FACTS exists to support them`);
      }
      return;
    }

    yearsInAnswer.forEach((year) => {
      if (!descLower.includes(year)) {
        reasons.push(`faq[${i}].answer states the year ${year}, which is not mentioned in the description — FAQ and description must agree`);
      }
    });
    colorsInAnswer.forEach((color) => {
      if (!descLower.includes(color)) {
        reasons.push(`faq[${i}].answer states the color "${color}", which is not mentioned in the description — FAQ and description must agree`);
      }
    });
  });

  return reasons;
}

// ============================================================================
// PUBLISH-VALIDATION GATE — implements the "LOGO PAGE CONTENT VERIFICATION
// SYSTEM" spec (near-duplicate detection, AI-artifact language, empty/
// placeholder content, internal link validation, final SEO gate, and the
// retry-limit / Needs Review fallback that wraps all of it).
// ============================================================================

// ── #1 Duplicate / near-duplicate content check ─────────────────────────────
// Cheap trigram/Jaccard similarity — good enough to catch "same content,
// swapped brand name" cases. For true semantic near-duplicates (heavily
// paraphrased but same meaning) swap this for an embeddings + cosine-
// similarity check using OpenAI's text-embedding-3-small.
function trigramSet(text) {
  const s = String(text || "").toLowerCase().replace(/[^a-z0-9\s]/g, "");
  const words = s.split(/\s+/).filter(Boolean);
  const set = new Set();
  for (let i = 0; i < words.length - 2; i++) set.add(words.slice(i, i + 3).join(" "));
  return set;
}

function jaccardSimilarity(a, b) {
  const A = trigramSet(a);
  const B = trigramSet(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

// Returns the highest-similarity match at/above threshold, or null.
function findNearDuplicate(candidateText, priorTexts, threshold = 0.35) {
  let best = null;
  for (const prior of priorTexts) {
    if (!prior) continue;
    const score = jaccardSimilarity(candidateText, prior);
    if (score >= threshold && (!best || score > best.score)) best = { score, prior };
  }
  return best;
}

// ── #3/#4 Remove AI-artifact language ────────────────────────────────────────
const AI_ARTIFACT_PHRASES = [
  "based on available information",
  "the research confirms",
  "according to the information gathered",
  "as an ai",
  "as an ai language model",
  "i don't have access to",
  "i do not have access to",
  "based on the provided",
  "according to the sources",
  "the notes indicate",
  "research notes show",
  "based on my knowledge",
  "as of my last update",
  "i cannot provide",
];

function containsAIArtifactPhrase(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const phrase of AI_ARTIFACT_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

const AI_STIFF_VOCAB = [
  "showcases", "underscores", "facilitates", "embodies", "boasts",
  "leverages", "encompasses", "signifies", "epitomizes", "exemplifies",
  "serves as a testament", "stands as a", "plays a crucial role",
  "in the realm of", "when it comes to", "it is worth noting",
  "furthermore,", "moreover,", "in conclusion,", "overall,",
];


// ── Sentence-cadence check ────────────────────────────────────────────────
// AI writing tends to produce sentences of near-identical length — a
// uniform rhythm real human writing rarely has. Flags descriptions where
// sentence-length variance is suspiciously low.
function checkSentenceLengthVariance(text) {
  if (!text) return null;
  const sentences = text.match(/[^.!?]+[.!?]/g) || [];
  if (sentences.length < 4) return null; // too short to judge reliably

  const lengths = sentences.map((s) => s.trim().split(/\s+/).filter(Boolean).length);
  const mean = lengths.reduce((a, b) => a + b, 0) / lengths.length;
  const variance = lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / lengths.length;
  const stdDev = Math.sqrt(variance);

  if (stdDev < 2.5) {
    return `sentence lengths are too uniform (stdDev ${stdDev.toFixed(1)} words across ${sentences.length} sentences) — reads as machine-generated cadence, vary short and long sentences more`;
  }
  return null;
}

function containsAIStiffVocab(text) {
  if (!text) return null;
  const lower = String(text).toLowerCase();
  for (const phrase of AI_STIFF_VOCAB) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

// ── #7 Empty / placeholder / incomplete content block ───────────────────────
function isPlaceholderOrIncomplete(text) {
  if (!text) return false; // blank is allowed for Case C descriptions — checked separately
  const trimmed = String(text).trim();
  if (/lorem ipsum/i.test(trimmed)) return true;
  if (/\.\.\.$/.test(trimmed)) return true;      // trailing ellipsis = truncated
  if (!/[.!?"')\]]$/.test(trimmed)) return true; // no terminal punctuation = likely cut off
  return false;
}

// ── #9 Internal link validation ──────────────────────────────────────────────
function extractInternalLinks(text) {
  if (!text) return [];
  return text.match(/https?:\/\/(www\.)?cdrlogo\.com\/[^\s")]+/gi) || [];
}

async function validateInternalLinks(...texts) {
  const allLinks = texts.flatMap((t) => extractInternalLinks(t));
  if (!allLinks.length) return [];
  const broken = [];
  for (const link of allLinks) {
    const slugFromLink = link.split("/").filter(Boolean).pop();
    try {
      const exists = await prisma.logo.findFirst({
        where: { slug: slugFromLink },
        select: { id: true },
      });
      if (!exists) broken.push(link);
    } catch (err) {
      console.warn(`  [links] Could not verify "${link}": ${err.message}`);
      broken.push(link);
    }
  }
  return broken;
}

// ── #10 Final SEO validation before publishing ───────────────────────────────
function finalSeoGate(aiContent, faqSchema) {
  const reasons = [];

  if (!aiContent.metaTitle || aiContent.metaTitle.trim().length < 10)
    reasons.push("meta_title missing or too short");
  if (!aiContent.metaDescription || aiContent.metaDescription.trim().length < 40)
    reasons.push("meta_description missing or too short");
  if (!aiContent.canonicalUrl) reasons.push("missing canonical URL");
  if (!aiContent.altText) reasons.push("missing alt_text");

  // Visible FAQ must exactly match FAQ schema (same questions, same order).
  const schemaQuestions = Array.isArray(faqSchema?.mainEntity)
    ? faqSchema.mainEntity.map((q) => q.name)
    : [];
  const visibleQuestions = (aiContent.faqPairs || []).map((q) => q.question);
  if (JSON.stringify(schemaQuestions) !== JSON.stringify(visibleQuestions)) {
    reasons.push("visible FAQ does not match FAQ schema");
  }

  return reasons;
}

async function validateBeforePublish({ aiContent, canonicalUrl, relatedLogos, faqSchema }) {
  const reasons = [];

  const artifactFields = {
    meta_title: aiContent.metaTitle,
    meta_description: aiContent.metaDescription,
    alt_text: aiContent.altText,
    og_title: aiContent.ogTitle,
    og_description: aiContent.ogDescription,
    twitter_title: aiContent.twitterTitle,
    twitter_description: aiContent.twitterDescription,
    image_object_description: aiContent.imageObjectDescription,
  };
  for (const [field, value] of Object.entries(artifactFields)) {
    const hit = containsAIArtifactPhrase(value);
    if (hit) reasons.push(`${field} contains unnatural AI phrase: "${hit}" — must read as natural human-written content`);
    const stiffHit = containsAIStiffVocab(value);
    if (stiffHit) reasons.push(`${field} contains stiff AI vocabulary: "${stiffHit}" — must read as natural human-written content`);
  }

  if (!Array.isArray(aiContent.faqPairs) || aiContent.faqPairs.length !== 2) {
    reasons.push(`faq must contain exactly 2 items, found ${aiContent.faqPairs?.length ?? 0}`);
  } else {
    aiContent.faqPairs.forEach((qa, i) => {
      if (!qa?.question || !qa?.answer) reasons.push(`faq[${i}] has an empty question or answer`);
      if (isPlaceholderOrIncomplete(qa?.answer)) reasons.push(`faq[${i}].answer looks incomplete or placeholder text`);
      const artifact = containsAIArtifactPhrase(qa?.answer);
      if (artifact) reasons.push(`faq[${i}].answer contains AI-artifact phrase: "${artifact}"`);
      const stiff = containsAIStiffVocab(qa?.answer);
      if (stiff) reasons.push(`faq[${i}].answer contains stiff AI vocabulary: "${stiff}"`);
    });
  }

  if (aiContent.description && isPlaceholderOrIncomplete(aiContent.description)) {
    reasons.push("description looks incomplete or placeholder text");
  }
  const descArtifact = containsAIArtifactPhrase(aiContent.description);
  if (descArtifact) reasons.push(`description contains AI-artifact phrase: "${descArtifact}"`);
  if (aiContent.description) {
    const priorDescriptions = (relatedLogos || []).map((r) => r.description).filter(Boolean);
    const dup = findNearDuplicate(aiContent.description, priorDescriptions);
    if (dup) {
      reasons.push(`description is a near-duplicate (${(dup.score * 100).toFixed(0)}% similar) of an existing related page's description`);
    }
  }

  if (Array.isArray(aiContent.faqPairs)) {
    const priorAnswers = (relatedLogos || [])
      .flatMap((r) => (Array.isArray(r?.faqSchema?.mainEntity) ? r.faqSchema.mainEntity.map((q) => q?.acceptedAnswer?.text) : []))
      .filter(Boolean);
    aiContent.faqPairs.forEach((qa, i) => {
      const dup = findNearDuplicate(qa?.answer, priorAnswers);
      if (dup) reasons.push(`faq[${i}].answer is a near-duplicate (${(dup.score * 100).toFixed(0)}% similar) of an existing related page's FAQ answer`);
    });
  }

  if (!aiContent.description) {
    const FACT_CLAIM_WORDS = /\b(founded|redesigned|headquartered|designer|colou?r|shield|star|mascot|typeface|font)\b/i;
    (aiContent.faqPairs || []).forEach((qa, i) => {
      if (FACT_CLAIM_WORDS.test(qa?.answer || "")) {
        reasons.push(`faq[${i}].answer states a specific fact but no VERIFIED FACTS/description exists to support it`);
      }
    });
  }

  reasons.push(...checkFaqAgainstDescription(aiContent.faqPairs, aiContent.description));

  if (aiContent.description) {
    const faqLlmIssues = await llmVerifyFaqAgainstDescription(aiContent.faqPairs, aiContent.description);
    reasons.push(...faqLlmIssues);
  }

  const brokenLinks = await validateInternalLinks(
    aiContent.description,
    ...(aiContent.faqPairs || []).map((q) => q.answer)
  );
  brokenLinks.forEach((link) => reasons.push(`internal link does not resolve to an existing page: ${link}`));

  reasons.push(...finalSeoGate({ ...aiContent, canonicalUrl }, faqSchema));

  return { passed: reasons.length === 0, reasons };
}
// ── generateMainDescription ───────────────────────────────────────────────
// Returns { description, attemptsExhausted, attemptsUsed }.
//   - attemptsExhausted === true means: description came back blank/invalid
//     even after MAX_DESCRIPTION_ATTEMPTS full regenerations (NOT the
//     TEMPLATE case, where blank is expected and correct). The caller
//     (generateAIContent → processOneLogoFolder) uses this flag to force
//     publishStatus: "Draft" instead of silently shipping a logo with no
//     description, while brand/website/country/industry — resolved by a
//     completely separate call — remain correct and populated regardless.

// Multiple ways to phrase the SAME verified facts (brand/country/industry/
// website — never invented) so that sibling versions of the same logo,
// which all fall back to this function if the LLM path fails 3 times
// each, don't end up with byte-identical descriptions. Selected in
// rotation by sibling index, same mechanism as FOCUS_ANGLES above.
const FALLBACK_OPENING_TEMPLATES = [
  (subject) => `${subject} is the brand associated with this logo.`,
  (subject) => `This logo represents ${subject}.`,
  (subject) => `${subject} is the company behind this logo.`,
  (subject) => `The name behind this logo is ${subject}.`,
];

// Additional real-world facts to draw on when brand/country/industry alone
// aren't enough to reach a reasonable length — these are still FACTS about
// the brand/logo (never about "this page" or "visitors"), just phrased in
// varying ways so repeated fallbacks don't collide.
const FALLBACK_INDUSTRY_CONTEXT_TEMPLATES = [
  (subject, industry) => `${subject} operates in the ${industry} sector.`,
  (subject, industry) => `As a company in ${industry}, ${subject} is recognized under this name and mark.`,
  (subject, industry) => `${subject}'s primary business falls under ${industry}.`,
];

const FALLBACK_HQ_TEMPLATES = [
  (subject, country) => `${subject} is headquartered in ${country}.`,
  (subject, country) => `The company's headquarters are located in ${country}.`,
  (subject, country) => `${subject} originates from and is based in ${country}.`,
];

const FALLBACK_WEBSITE_TEMPLATES = [
  (subject, website) => `${subject}'s official website is ${website}.`,
  (subject, website) => `The brand can be found online at ${website}.`,
  (subject, website) => `Its official web presence is hosted at ${website}.`,
];

function levenshtein(a, b) {
  a = String(a || "").toLowerCase();
  b = String(b || "").toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Replaces reviewLogoName(). No image-text requirement — templates are
// skipped outright, and a non-template name is only ever CORRECTED, never
// flagged. If no brand was identified, or the name is too different from
// the brand to be a plausible typo, the name is simply left untouched.
function correctLogoNameSpelling({ logoName, brand, isTemplate }) {
  if (isTemplate || !brand) {
    return { correctedName: logoName, wasCorrected: false };
  }

  const versionSuffix = logoName.match(/\s+V\d+$/i)?.[0] || "";
  const baseName = logoName.replace(/\s+V\d+$/i, "").trim();

  const normBase = normalizeName(baseName);
  const normBrand = normalizeName(brand);

  if (!normBase || !normBrand || normBase === normBrand) {
    return { correctedName: logoName, wasCorrected: false };
  }

  const dist = levenshtein(normBase, normBrand);
  const maxLen = Math.max(normBase.length, normBrand.length) || 1;
  const similarity = 1 - dist / maxLen;
  const SPELLING_SIMILARITY_THRESHOLD = 0.72;

  if (similarity >= SPELLING_SIMILARITY_THRESHOLD) {
    const corrected = `${toProperCase(brand)}${versionSuffix}`;
    console.log(
      `  [name:spelling] "${baseName}" looks like a misspelling of "${brand}" ` +
      `(similarity ${(similarity * 100).toFixed(0)}%) — auto-corrected to "${corrected}".`
    );
    return { correctedName: corrected, wasCorrected: true };
  }

  return { correctedName: logoName, wasCorrected: false };
}

async function generateTemplateDescription({ logoName, visualFacts }) {
  const name = toProperCase(String(logoName).replace(/\s+V\d+$/i, "").trim());
  const visualBlock = visualFacts?.hasVisualFacts
    ? visualFacts.visualFactsText
    : "(image analysis unavailable — describe only what the name itself clearly refers to)";

  const prompt = `Write ONE very short description of a logo, EXACTLY 20 to 30 words, in one or two sentences.

LOGO NAME: ${name}
VISUAL FACTS (from the actual image — only allowed source for color/shape/symbol claims):
${visualBlock}

COVER THESE THREE THINGS, VERY BRIEFLY:
1. Meaning of the name: what "${name}" refers to (e.g. a football club, an animal, a food item, a city, a generic emblem). Base this only on the NAME and the IMAGE. If it is unclear, just say what is drawn.
2. Where a logo like this fits: the kind of place or setting connected to that name (e.g. a sports club, a restaurant menu, a tech startup, a school). Write it as a neutral fact about the name. Do not write it as a recommendation.
3. One visible detail from VISUAL FACTS (a color, shape or symbol).

RULES:
- 20–30 words total.
- Use the logo name exactly as written above (same capitalization).
- Do NOT claim a real company, founding date, HQ, designer or history.
- Never use "brand" or "company" as a stand-in subject.
- No file formats (PNG, SVG, AI, CDR, vector). No "educational", "reference", "research".
- Never use: perfect for, great for, ideal for, best for, for your project, for your brand, business use, free, download.
- Colors/symbols ONLY from VISUAL FACTS.

Return ONLY JSON: { "description": "..." }`;

  let lastReason = "";
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const messages = [
        { role: "system", content: "You write very short, factual, natural-sounding logo descriptions. You never invent facts. Return only JSON." },
        { role: "user", content: prompt },
      ];
      if (lastReason) messages.push({ role: "user", content: `Previous attempt rejected because ${lastReason}. Rewrite it fixing that.` });

      const completion = await callOpenAIWithRetry({
        model: "gpt-4.1-mini", temperature: 0.5, messages,
        response_format: { type: "json_object" },
      });
      let parsed = {};
      try { parsed = JSON.parse(completion.choices[0]?.message?.content || "{}"); } catch { }
      const description = fixMissingSpaceAfterPeriod(stripMarkdownLinks(String(parsed.description || "").trim()));

      const wc = wordCount(description);
      const reasons = [];
      if (!description) reasons.push("it was empty");
      if (description && (wc < 20 || wc > 30)) reasons.push(`it was ${wc} words (must be 20-30)`);
      const banned = containsBannedPhrase(description);
      if (banned) reasons.push(`it used banned phrase "${banned}"`);
      const filler = containsClosingFiller(description);
      if (filler) reasons.push(`it mentioned "${filler}"`);
      if (containsPlaceholderBrandWord(description)) reasons.push(`it used "brand"/"company" as a subject`);
      reasons.push(...checkColorsAgainstVisualFacts(description, visualFacts));

      if (!reasons.length) return description;
      lastReason = reasons.join("; ");
      console.warn(`  [description:template] Attempt ${attempt + 1} rejected — ${lastReason}`);
    } catch (err) {
      lastReason = `the call failed (${err.message})`;
    }
  }

  const what = visualFacts?.symbolsText || visualFacts?.shapeText || "an emblem";
  const colors = visualFacts?.rawColors?.length ? ` in ${visualFacts.rawColors.slice(0, 3).join(", ")}` : "";
  return `${name} is a logo design showing ${what}${colors}, suited to themes connected with the name ${name}.`;
}

async function generateMainDescription({
  logoName, brand, website, country, industry, isTemplate,
  canonicalUrl, relatedDescriptions = [], visualFacts = null,
}) {
  if (isTemplate) {
    const description = await generateTemplateDescription({ logoName, visualFacts });
    return { description, attemptsExhausted: false, attemptsUsed: 1, isEmergencyFallback: false };
  }

  const { hasResults, contextText } = await researchBrandFacts(logoName, brand);

  const focus = pickFocusAngle(relatedDescriptions.length, FOCUS_ANGLES, logoName);

  const priorColorSets = relatedDescriptions.map(extractColorWords).filter((c) => c.length);
  const allPriorColors = [...new Set(priorColorSets.flat())];
  const colorConsistencyNote = allPriorColors.length
    ? `\n\nPREVIOUSLY STATED OFFICIAL COLORS for this same logo/brand (from sibling versions): ${allPriorColors.join(", ")}.
COLOR RULE: Unless the research notes explicitly state the colors changed for THIS version, use this exact same color list — do not add a color that isn't in this list, and do not drop one that is, just for variety. Color facts must stay consistent across all versions of the same logo unless a documented change justifies a difference.
Also: state the color list ONCE. Do not describe colors twice with different framing in the same description.`
    : "";

  const priorHQCandidates = relatedDescriptions.map(extractHQLocation).filter(Boolean);
  const priorHQ = priorHQCandidates[0] || null;
  const hqConsistencyNote = priorHQ
    ? `\n\nPREVIOUSLY STATED HEADQUARTERS LOCATION for this same logo/brand: "${priorHQ}".
HQ RULE: Unless the research notes explicitly document the company relocating its global headquarters, you must state this exact same location — never a different city, region, or country.`
    : "";

  const priorFoundingYearCandidates = relatedDescriptions.map(extractFoundingYear).filter(Boolean);
  const priorFoundingYear = priorFoundingYearCandidates[0] || null;
  const foundingYearConsistencyNote = priorFoundingYear
    ? `\n\nPREVIOUSLY STATED FOUNDING YEAR for this same logo/brand: ${priorFoundingYear}. Use this exact year if you mention founding — never state a different year.`
    : "";

  const visualFactsBlock = visualFacts?.hasVisualFacts
    ? `\n\nVISUAL FACTS — FROM ACTUALLY LOOKING AT THIS LOGO'S FILE (outranks text research for color/shape — text research may describe a different era or sub-brand entirely):
${visualFacts.visualFactsText}

RULE: Any sentence about color, shape, or what's visually in the logo must be based on VISUAL FACTS above, never the text research notes. Text research is only for history, founding date, redesign timeline, HQ, website.`
    : `\n\nVISUAL FACTS: Image analysis unavailable. Do not state any color or shape claim — omit visual description or state only what text research explicitly documents as a historical fact (not current appearance).`;

  const variantNote = relatedDescriptions.length
    ? `\n\nPREVIOUS VERSION DESCRIPTIONS ALREADY PUBLISHED ON THIS SITE FOR RELATED PAGES OF THE SAME LOGO/BRAND (${relatedDescriptions.length} total — read ALL of them before writing):\n${relatedDescriptions
      .map((d, i) => `v${i + 1}: ${String(d)}`)
      .join("\n\n")}

MANDATORY DIFFERENTIATION RULE (read carefully):
1. First, identify which specific real facts (founding date, redesign date, designer, HQ location, specific colors named, typography style, symbolism described, etc.) each version above ALREADY covers.
2. Your description must NOT just reword or re-report the same facts in different sentences. If the research notes support additional genuine facts that the versions above did NOT mention, prioritize and lead with THOSE facts instead.
3. If the research notes genuinely contain no additional facts beyond what's already covered above, it is acceptable to cover the same facts, but you MUST still write with a completely different structure, opening, and emphasis. Never invent a new fact just to appear different.
4. Do NOT copy or closely mirror any previous version's sentence structure, opening line, or phrasing.
5. SYNONYM-SWAP IS NOT DIFFERENTIATION. Combine a repeated fact into a different sentence alongside a different neighboring fact, or change which clause is main vs subordinate — not a word-for-word template with synonyms swapped in.
6. NEVER DRIFT ON A FACT ALREADY ESTABLISHED. Any specific factual detail already stated by a sibling version above must be reused exactly, unless YOUR research notes explicitly document a verified correction.${colorConsistencyNote}${hqConsistencyNote}${foundingYearConsistencyNote}`
    : "";

  const systemPrompt = `You are a careful research writer producing the "About This Logo" description for a logo reference page. You never invent facts. You only use what is explicitly supported by the research notes given to you. If the notes don't support a fact, you leave it out rather than guessing. Return ONLY valid JSON, no markdown, no commentary.`;

  function buildUserPrompt() {
    return `LOGO NAME: ${logoName}
BRAND (if identified): ${brand || "(not confidently identified)"}
COUNTRY (fixed fact): ${country || "(unknown)"}
INDUSTRY (fixed fact): ${industry || "(unknown)"}
OFFICIAL WEBSITE (fixed fact): ${website || "(unknown — do not mention a website)"}

INTERNAL PAGE URL (for your reference only — do NOT use this as, or confuse this with, the brand's official website. Never mention it, or any similar-looking address, in the description you write): ${canonicalUrl}

RESEARCH NOTES (from web search — may be incomplete or empty):
${hasResults ? contextText : "(no usable search results were found for this name)"}
${variantNote}
${visualFactsBlock}

==================================================
TASK
==================================================

Write the "About This Logo" description following these exact rules.

STEP 1 — JUDGE THE RESEARCH NOTES
Read the research notes above. Decide honestly which case applies:

CASE A — SUBSTANTIAL VERIFIABLE HISTORY:
The notes contain genuine, verifiable facts about founding date, logo history/redesign dates, designer, symbolism, official colors, typography, HQ location, official website, or what the company actually does.
→ Write a SHORT, FACTS-ONLY description around 100–120 words (aim for this range, but it's fine to be a little shorter or longer if the facts genuinely call for it — never pad with filler just to hit a number). Every sentence should state one distinct fact. Cover only as many of the following as the research notes support, prioritized by the FOCUS INSTRUCTION below:
  * What the company actually does — its real products or services in plain
    language (e.g. "issues credit ratings on debt and government bonds",
    not just the label "Credit Rating Agency"). Pull this from RESEARCH
    NOTES only — never invent it.
  * Founding date (exact date if available)
  * Logo history — when the current logo launched, and change dates if it changed
  * Reason for redesign if publicly documented
  * Visual elements — shapes, imagery, colors, factually (from VISUAL FACTS only)
  * Official colors — name them only, never hex/RGB/Pantone, and ONLY from VISUAL FACTS
  * Typography/font style if known
  * HQ city and country
  * Official website link — ONLY if RESEARCH NOTES confirm a real domain
  * State the logo is official/original ONLY if the notes support it

CASE B — BRAND IS REAL/IDENTIFIABLE BUT NOTES ARE THIN:
→ Write a FACTS-ONLY description around 100–120 words (soft target — don't pad with filler if you run out of real facts sooner). Use ONLY the fixed facts above (country, industry, website) and what RESEARCH NOTES support. NEVER invent history, dates, a designer, or colors. Include:
  * Brand/logo name
  * What the company does, ONLY if RESEARCH NOTES support it
  * Country and industry, ONLY if given as fixed facts above
  * Official website, ONLY if given above — never guess
  * For the country, write "based in X" or "from X". Do not write "headquartered in X". That phrase is checked against the research text, and a country taken from the fixed facts may not appear there.
CASE C HAS BEEN REMOVED — every non-template logo must receive at least a Case B description. Never return an empty string "" under any circumstance.

STEP 2 — WRITING STYLE (applies to CASE A and CASE B only)
WRITE LIKE A HUMAN, NOT A MODEL:
* Vary your sentence lengths noticeably — mix one short sentence (5-8 words) with longer ones (15-20 words). Do not make every sentence roughly the same length.
* Do not start consecutive sentences with the same structure.
* Avoid the "triplet" pattern (three parallel adjectives/clauses in a row).
* Occasionally use a contraction where natural.
* Do not open with a scene-setting "X is a Y that..." sentence — start mid-fact instead.
* NEVER open with "[Name] is the brand associated with this logo," "This logo represents [Name]," or "[Name] is the company behind this logo." The reader already knows this is a logo page. Open with a real fact instead — what the company does, where it's based, when it launched, or what's visually in the logo.
* FACTS ONLY — no scene-setting, no narrative framing, no interpretive claims about meaning unless the research notes state it as documented fact.
* Do not use filler like "long-standing connection," "reflects the company's heritage," "timeless," "beloved," "rich history," "commitment to."
* Aim for roughly 100–120 words. Every sentence should carry a distinct fact — don't stretch or pad just to hit the count.
* Natural, simple, human English. Avoid stiff words like "showcases," "underscores," "facilitates," "embodies," "leverages," "encompasses," "boasts."
* Never copy or closely paraphrase source wording.
* Always insert a space after every sentence-ending period, question mark, or exclamation mark.
* FOCUS INSTRUCTION (what to EMPHASIZE and lead with): ${focus.value}
  Do NOT default to "[Name] was founded on [date]..." as the first sentence unless the focus instruction tells you to.

NO UNSOURCED INTERPRETATION:
Never state what a shape, color, or design "symbolizes," "represents," "reflects," "embodies" unless the research notes explicitly say so.
NO SELF-CONTRADICTION:
Do not describe the logo's shape inconsistently within the same description.

DESCRIBE THE LOGO/BRAND, NEVER THE ARCHIVE PAGE:
Never write "this page archives...", "this page provides...", "visitors can review/compare...". If you run out of real facts, write a SHORTER description instead of padding with sentences about the page.

REDUNDANT "LOGO" WORDING:
If LOGO NAME already contains "Logo" (e.g. "Borussia Dortmund Logo V2"), never stack a second "logo" right after it.

NO CLOSING LINE:
Do NOT add any closing sentence. Never mention file formats (PNG, SVG, AI, CDR, vector) and never write "educational use", "reference use" or "research purposes". End on the last real fact about the logo/brand.

STEP 3 — BANNED WORDS (ZERO EXCEPTIONS)
Never use: Free, Download, Get it now, Perfect for, Great for, Ideal for, Best for, Business use, Commercial project(s), Branding need(s), Marketing material(s), Premium quality, High quality, High resolution, Best logo, Suitable for project(s), Useful for creator(s), Design asset(s), Creative work, Elevate your brand, Industry leader, Trusted worldwide, Modern branding, Amazing, Beautiful, Professional design, Click here, 100% free, No copyright, HD logo, World best, Top quality, Cutting-edge, Innovative, Stunning.
Never mention "cdrlogo.com" or any archive domain/URL — the only URL allowed is the brand's own official website, only when confirmed by research.
Never use interpretive/mission-narrative filler: "long-standing connection," "heritage and mission," "closely linked to," "closely tied to," "reflects the company's/brand's," "timeless," "beloved," "cherished," "iconic status," "enduring legacy," "rich history," "commitment to."

STEP 4 — ACCURACY RULE (NON-NEGOTIABLE)
If in doubt between Case A and Case B, choose Case B — but Case B is always the floor.
BANNED STRUCTURES (do not use these, even reworded slightly):
- Banned Opening: "[Brand Name] is a professional club/company based in [Location], known for competing in..."
- Banned Opening: "[Brand Name] is the brand associated with this logo."
- DYNAMIC PATTERN PROHIBITION: Do not substitute the banned list with a third repetitive formula. Every description must have a completely unique syntax layout.

Return ONLY this JSON:
{
 "case": "A" or "B",
  "description": "..."
}`;
  }

  async function runDescriptionCall(extraNote = "") {
    const messages = [
      { role: "system", content: systemPrompt },
      { role: "user", content: buildUserPrompt() },
    ];
    if (extraNote) messages.push({ role: "user", content: extraNote });

    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages,
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const caseUsed = parsed.case || "?";
    const description = fixMissingSpaceAfterPeriod(
      stripMarkdownLinks((parsed.description && String(parsed.description).trim()) || "")
    );
    return { caseUsed, description };
  }

  const GENERIC_OPENING_MAIN = /^\s*["'’]?[\w'’.-]+(?:\s[\w'’.-]+){0,4}\s+is the (brand|company) (associated with|behind) this logo/i;

  try {
    const MAX_DESCRIPTION_ATTEMPTS = 3;
    let caseUsed = "?";
    let description = "";
    let attemptsUsed = 0;
    let lastReason = "";

    for (let attempt = 0; attempt < MAX_DESCRIPTION_ATTEMPTS; attempt++) {
      attemptsUsed = attempt + 1;

      const extraNote = attempt === 0
        ? ""
        : `Your previous JSON response was rejected because ${lastReason}. Regenerate the ENTIRE JSON response,fixing this issue precisely. Pay special attention to:staying roughly in the 100–120 word range, STEP 3 banned words, cutting interpretive filler, colors named only (never hex/RGB/Pantone) and ONLY from VISUAL FACTS, the internal-URL rule, natural human prose with varied sentence lengths and no stiff AI vocabulary, never opening with "[Name] is the brand associated with this logo," and never mentioning file formats or educational/reference/research wording. If a near-duplicate issue was flagged, rewrite with an entirely different sentence structure. If a headquarters or founding-year mismatch was flagged, use EXACTLY the previously established value. If a color was flagged as not visible in the image, remove it — only state colors listed in VISUAL FACTS. If sentence cadence was flagged as too uniform, vary sentence lengths more.`;

      const result = await runDescriptionCall(extraNote);
      caseUsed = result.caseUsed;
      description = result.description;

      const bannedHit = containsBannedPhrase(description);
      const colorCodeHit = containsColorCode(description);
      const leakedInternalUrl =
        description && (description.includes(canonicalUrl) || /cdrlogo\.com/i.test(description));
      const wc = wordCount(description);
      const wordCountBad = !!description && isWordCountFarOff(caseUsed, wc);
      const aiArtifactHit = containsAIArtifactPhrase(description);
      const stiffVocabHit = containsAIStiffVocab(description);
      const fluffHit = containsFluffPhrase(description);
      const nearDupHit = description ? findNearDuplicate(description, relatedDescriptions) : null;
      const newHQ = extractHQLocation(description);
      const hqMismatch = !!(priorHQ && newHQ && newHQ.toLowerCase() !== priorHQ.toLowerCase());
      const newFoundingYear = extractFoundingYear(description);
      const foundingYearMismatch =
        !!(priorFoundingYear && newFoundingYear && newFoundingYear !== priorFoundingYear);
      const sourceGroundingIssues = checkDescriptionAgainstSource(description, hasResults ? contextText : "");
      const visualColorIssues = checkColorsAgainstVisualFacts(description, visualFacts);
      const llmFactIssues = description && hasResults && caseUsed === "A"
        ? await llmVerifyDescriptionFacts(description, contextText)
        : [];
      const allGroundingIssues = [...sourceGroundingIssues, ...visualColorIssues, ...llmFactIssues];
      const pageFillerHit = containsPageFillerPhrase(description);
      const closingFillerHit = containsClosingFiller(description);
      const cadenceIssue = checkSentenceLengthVariance(description);
      const genericOpeningHit = GENERIC_OPENING_MAIN.test(description || "");

      const isBad =
        bannedHit || colorCodeHit || leakedInternalUrl || wordCountBad ||
        aiArtifactHit || fluffHit || nearDupHit ||
        hqMismatch || foundingYearMismatch || allGroundingIssues.length || pageFillerHit ||
        closingFillerHit || !description || genericOpeningHit;

      if (stiffVocabHit) console.log(`  [description] Style note (non-blocking): stiff vocabulary "${stiffVocabHit}"`);
      if (cadenceIssue) console.log(`  [description] Style note (non-blocking): ${cadenceIssue}`);

      if (!isBad) {
        console.log(`  [description] Case ${caseUsed} — ${wordCount(description)} words | attempt ${attemptsUsed}/${MAX_DESCRIPTION_ATTEMPTS} | focus#${focus.index}`);
        return { description, attemptsExhausted: false, attemptsUsed, isEmergencyFallback: false };
      }

      const reasonParts = [];
      if (!description) reasonParts.push(`it returned an empty description — try harder to find at least minimal Case B facts`);
      if (bannedHit) reasonParts.push(`it used the banned phrase "${bannedHit}"`);
      if (colorCodeHit) reasonParts.push(`it included a hex/RGB/Pantone color code — colors must be described by name only`);
      if (leakedInternalUrl) reasonParts.push(`it mentioned the internal archive URL/domain instead of a verified brand website`);
      if (wordCountBad) reasonParts.push(`it was ${wc} words, far outside a reasonable range for Case ${caseUsed}`);
      if (aiArtifactHit) reasonParts.push(`it used the unnatural AI phrase "${aiArtifactHit}"`);
      if (fluffHit) reasonParts.push(`it used the interpretive/filler phrase "${fluffHit}"`);
      if (nearDupHit) reasonParts.push(`it is too similar (${(nearDupHit.score * 100).toFixed(0)}% overlap) to a previously published sibling description`);
      if (hqMismatch) reasonParts.push(`it stated headquarters as "${newHQ}" but a sibling already established "${priorHQ}"`);
      if (foundingYearMismatch) reasonParts.push(`it stated founding year ${newFoundingYear} but a sibling already established ${priorFoundingYear}`);
      if (pageFillerHit) reasonParts.push(`it used "about the archive page" language ("${pageFillerHit}") instead of a fact about the LOGO/BRAND`);
      if (closingFillerHit) reasonParts.push(`it contains "${closingFillerHit}" — no file-format or reference/educational sentence is allowed anywhere in the description`);
      if (genericOpeningHit) reasonParts.push(`it opened with the generic "is the brand associated with this logo" pattern`);
      if (cadenceIssue) reasonParts.push(cadenceIssue);
      allGroundingIssues.forEach((r) => reasonParts.push(r));

      lastReason = reasonParts.join("; and ") || "it failed validation";
      console.warn(`  [description] Attempt ${attemptsUsed}/${MAX_DESCRIPTION_ATTEMPTS} failed — ${lastReason}.`);
    }

    console.warn(`  [description] All ${MAX_DESCRIPTION_ATTEMPTS} attempts still empty/invalid — trying relaxed LLM fallback.`);
    const llmFallback = await generateFallbackDescriptionViaLLM({
      logoName, brand, website, country, industry,
      contextText, hasResults, canonicalUrl, relatedDescriptions, visualFacts,
    });
    if (llmFallback) {
      console.log(`  [description] Relaxed LLM fallback succeeded.`);
      return { description: llmFallback, attemptsExhausted: false, attemptsUsed, isEmergencyFallback: false };
    }

    console.warn(`  [description] Relaxed LLM fallback also failed — using static emergency fallback.`);
    return {
      description: buildStaticEmergencyFallback(
        logoName,
        { brand, website, country, industry },
        relatedDescriptions,
        visualFacts
      ),
      attemptsExhausted: false,
      attemptsUsed,
      isEmergencyFallback: true,
    };
  } catch (err) {
    console.warn(`  [description] Generation failed: ${err.message} — trying relaxed LLM fallback.`);
    try {
      const llmFallback = await generateFallbackDescriptionViaLLM({
        logoName, brand, website, country, industry,
        contextText: "", hasResults: false, canonicalUrl, relatedDescriptions, visualFacts,
      });
      if (llmFallback) {
        return { description: llmFallback, attemptsExhausted: false, attemptsUsed: 0, isEmergencyFallback: false };
      }
    } catch (fallbackErr) {
      console.warn(`  [description] Relaxed LLM fallback also errored: ${fallbackErr.message}`);
    }

    return {
      description: buildStaticEmergencyFallback(
        logoName,
        { brand, website, country, industry },
        relatedDescriptions,
        visualFacts
      ),
      attemptsExhausted: false,
      attemptsUsed: 0,
      isEmergencyFallback: true,
    };
  }
}
// ============================================================================
// PATCH END
// ============================================================================

// ── STEP 1: classify main_category / sub_category from the logo NAME only ───
// Unchanged in spirit from before, but no longer gated on DB availableCategories
// — gating is now purely the manual "template" override from the upload form.
async function classifyCategory({ logoName }) {
  const categoryPrompt = `You are classifying a logo NAME into the closest matching entry in a fixed taxonomy.

You have NO image and NO extra context. You only have the logo name and your own knowledge of real-world brands.

Logo Name: ${logoName}

Main Category → Sub Categories (this is the COMPLETE list — copy values verbatim, never invent):
${CATEGORY_TAXONOMY_TEXT}

STEP 1 — IDENTIFY THE REAL BRAND FIRST (do this before looking at the taxonomy):
Using your own knowledge, recall what "${logoName}" is actually known for in the real world — what does this company/brand MAKE, SELL, or DO? Think about its actual products or services, not what the word sounds like or evokes.

Example of this reasoning pattern (do not copy — just the approach):
- "Dove" → known for soap and skincare products → this is a Beauty & Cosmetics company, NOT a bird.
- "Amazon" → known for online retail and cloud computing → this is E-commerce / Cloud Computing, NOT the river or rainforest.
- "Puma" → known for athletic footwear and apparel → this is Sportswear, NOT the animal.

The word itself is often NOT the industry. Your job in Step 1 is to recall the ACTUAL products/services of the real brand behind this name — the way a person who has actually used or seen this brand in stores/ads would know it.

STEP 2 — MATCH TO TAXONOMY:
Once you know what the brand actually does (from Step 1), scan the full taxonomy above and find the sub_category that matches those REAL products/services — not the sub_category that matches the literal word.

STEP 3 — VERIFY:
Confirm the sub_category you picked is listed under the main_category you picked in the taxonomy. Fix the pairing if not.

RULES:
- main_category and sub_category MUST be copied EXACTLY (verbatim) from the taxonomy — never invented, never outside the list.
- Always return both fields — pick the closest real match even for less-familiar names, but base it on Step 1's real-world identification, not on the word's surface meaning or theme.
- If truly nothing is known about the brand behind the name, fall back to the taxonomy entry matching the literal meaning of the word only as a last resort — and say so explicitly in your reasoning.

Return ONLY valid JSON:

{
  "brand_identity": "what this brand is actually known for making/selling/doing in the real world (Step 1 result)",
  "reasoning": "why this taxonomy entry matches that real-world identity",
  "main_category": "...",
  "sub_category": "..."
}`;

  try {
    const catCompletion = await callOpenAIWithRetry({
      model: "gpt-5.4-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You classify logo names into a fixed taxonomy. Your core skill is knowing what real brands actually make, sell, or do — not guessing from what a word sounds like or evokes.

You ALWAYS perform two separate steps: (1) recall what the real-world brand behind this name is actually known for — its actual products, services, or industry, based on genuine brand knowledge (e.g. Canon = cameras/printers, not artillery; Dove = soap, not bird; Puma = sportswear, not animal) — THEN (2) match that real identity to the closest taxonomy entry.

You never classify based on the literal/surface meaning of the word when you know the real brand behind it. Literal-word matching is only a last resort for names with no identifiable real brand.

main_category and sub_category are copied EXACTLY from the provided taxonomy, never invented. Both fields are always required.

Return ONLY JSON, no markdown, no commentary.`
        },
        { role: "user", content: categoryPrompt },
      ],
      response_format: { type: "json_object" },
    });

    const catRaw = catCompletion.choices[0]?.message?.content || "{}";
    let catParsed = {};
    try { catParsed = JSON.parse(catRaw); } catch { catParsed = {}; }
    const mainCategory = (catParsed.main_category && String(catParsed.main_category).trim()) || "template";
    const subCategory = (catParsed.sub_category && String(catParsed.sub_category).trim()) || "";
    if (catParsed.reasoning) console.log(`  [ai:category] reasoning: ${catParsed.reasoning}`);
    console.log(`  [ai:category] RAW pick from LLM → main_category: "${mainCategory}" | sub_category: "${subCategory}"`);
    return { mainCategory, subCategory };
  } catch (err) {
    console.warn(`  [ai:category] Failed, defaulting to "template": ${err.message}`);
    return { mainCategory: "template", subCategory: "" };
  }
}

// ── URL validity guard ────────────────────────────────────────────────────────
function isPlausibleUrl(value) {
  if (!value || typeof value !== "string") return false;
  try {
    const u = new URL(value.trim());
    return (u.protocol === "http:" || u.protocol === "https:") && u.hostname.includes(".");
  } catch {
    return false;
  }
}

// ── Merged brand + country + industry + website resolution ──────────────────
// Replaces the old DB-sheet candidate matching entirely. Pure LLM, single
// call, using genuine real-world brand knowledge. Only called for NON-
// template logos — template logos skip this entirely (no brand/country/
// industry/website at all).
//
// "100% get brand and website" requirement: the prompt pushes the model to
// commit to an answer whenever the name corresponds to an identifiable real
// brand, and to only return blanks for genuinely fictional/unidentifiable
// names — not out of general caution.
async function resolveBrandCountryIndustryWebsite({ logoName, mainCategory, subCategory }) {
  const prompt = `You are identifying the REAL, official brand behind a logo name, using only your own knowledge.

Logo Name    : ${logoName}
Main Category: ${mainCategory}
Sub Category : ${subCategory}

TASK:
1. Identify the real-world company/brand this logo name refers to.
2. State the country the brand is headquartered / originates from.
3. State the specific industry/sector it operates in (a short phrase, e.g. "Athletic Footwear & Apparel", "Fast Food Restaurants", "Consumer Electronics").
4. Identify the brand's real, official website — the root domain the company itself owns (e.g. "https://nike.com"), NOT a Wikipedia page, news article, social profile, or marketplace listing.

CONFIDENCE RULE:
- If "${logoName}" corresponds to a real, identifiable brand you have genuine knowledge of, you MUST fill in brand, country, industry, and website — do not leave them blank out of general caution. Commit to the answer.
- Only return empty strings for a field (or all fields) if the logo name does NOT correspond to any real, identifiable brand you actually know (e.g. it looks like a generic/made-up/placeholder name). Never fabricate a plausible-looking answer for a brand you don't actually recognize.
- For website specifically: return it only if you are near-certain of the exact domain. If confident about brand/country/industry but unsure of the exact domain, still return brand/country/industry and leave website as "".

Return ONLY valid JSON:
{
  "confident_real_brand": true or false,
  "reasoning": "one short sentence",
  "brand": "...",
  "country": "...",
  "industry": "...",
  "website": "https://example.com" or ""
}`;

  try {
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content:
            "You identify real-world brands, their country, industry, and official website from genuine knowledge only. You commit confidently when you actually know the brand, and you only return blanks when the name truly doesn't correspond to any real brand you recognize. You never fabricate a plausible-looking website domain you aren't sure about. Return only JSON. ",
        },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    });

    const raw = completion.choices[0]?.message?.content || "{}";
    let parsed = {};
    try { parsed = JSON.parse(raw); } catch { parsed = {}; }

    const brand = (parsed.brand && String(parsed.brand).trim()) || "";
    const country = (parsed.country && String(parsed.country).trim()) || "";
    const industry = (parsed.industry && String(parsed.industry).trim()) || "";
    const website = isPlausibleUrl(parsed.website) ? String(parsed.website).trim() : "";

    if (parsed.reasoning) console.log(`  [brand+website:llm] reasoning: ${parsed.reasoning}`);
    console.log(`  [brand+website:llm] brand="${brand || "(none)"}" | country="${country || "(none)"}" | industry="${industry || "(none)"}" | website="${website || "(none)"}"`);

    return { brand, country, industry, website };
  } catch (err) {
    console.warn(`  [brand+website:llm] Failed: ${err.message}`);
    return { brand: "", country: "", industry: "", website: "" };
  }
}

// ── FAQ question bank — client's exact 46 questions, 9 categories ───────────
// Direct implementation of the client-provided question bank (no per-
// vertical topic filtering — every non-restricted logo draws from the same
// full 46-question pool, matching the original instruction doc).
const FAQ_QUESTION_BANK = {
  brand_identity_symbolism: [
    "Which brand or organization does this logo represent?",
    "What is the main symbol in this logo?",
    "What is the possible meaning of this logo's symbol?",
    "Is this logo's symbol inspired by a real object?",
    "Is this logo's symbol directly connected to the brand's name?",
    "Does this logo use a mascot or character?",
    "Does this logo include nature, animal, or human-inspired elements?",
    "Does this logo contain any hidden visual element?",
  ],
  colors: [
    "What are the primary colors used in this logo?",
    "Can this logo be clearly recognized in black and white?",
    "What effect does this logo's color combination have on its overall impression?",
    "Do this logo's colors have any specific role or meaning?",
  ],
  shape_design_concept: [
    "Is this logo's design based on geometric shapes?",
    "Does this logo use abstract elements?",
    "Does this logo use borders, shields, or enclosed shapes?",
    "Is this logo's design flat, or does it use dimensional effects?",
    "Does this logo use a unique pattern or repeated graphic element?",
    "Does this logo give an impression of motion, speed, or energy?",
  ],
  typography_structure: [
    "What style is this logo's typography?",
    "Does this logo use both an icon and text?",
    "What type of logo is this — wordmark, emblem, icon, or combination mark?",
    "Does this logo use initials or letterforms?",
    "Does this logo use uppercase, lowercase, or mixed lettering?",
  ],
  style_personality: [
    "Is this logo's overall visual tone bold or subtle?",
    "Does this logo's design show a professional or playful personality?",
    "Does this logo's design language reflect a theme like luxury, technology, or sports?",
    "Is this logo's visual style modern or traditional?",
    "Does this logo follow a minimalist design approach?",
  ],
  recognizability_practical: [
    "What is this logo's most recognizable feature?",
    "How readable is this logo at small sizes?",
    "Can this logo work effectively across different backgrounds?",
  ],
  history: [
    "Is this logo's current design different from its earlier version?",
    "When or why was this logo redesigned?",
  ],
  country_city_industry_context: [
    "Which country or region is this logo associated with?",
    "Which city is this brand founded or headquartered in?",
    "Does this logo's design visually reflect a specific industry?",
  ],
  // NOTE: original "can this logo be downloaded for free" and "reference
  // for design and branding projects" are reworded below — both would
  // otherwise trip the BANNED_PHRASES list ("free", "download", "branding
  // need") on nearly every generation. Everything else is a direct
  // translation of the client's original 46.
  website_format_technical: [
    "What file formats is this logo available in on this website?",
    "Can this logo's SVG code be copied directly from this page?",
    "Is this logo's vector version suitable for use in design projects?",
    "What software is the CDR file format used for?",
    "Is the PNG format of this logo available with a transparent background?",
    "Can this logo's AI file be edited in Adobe Illustrator?",
    "Which of this logo's available formats is best for print?",
    "Does this logo's file size vary across formats?",
    "Can this logo be resized without losing quality?",
    "Is this logo suitable for use as a reference in design projects?",
  ],
};

// ── TRUE random sampling (not seeded/deterministic) — picks N random items
// from the pool with actual Math.random(), so the same logo re-uploaded or
// similar logo names don't bias toward the same subset. This is what
// actually fixes "always the same 2 questions" — seededShuffle only
// reorders a list the LLM still sees in full; the LLM then gravitates to
// the same "safe, always-answerable" questions (geometric shapes, file
// formats) regardless of order. Restricting what the LLM even SEES to a
// small random slice forces real variety.
function pickRandomSubset(arr, count) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}
// ── Maps each question to its category, needed for answerability checks
// and the "at most 1 technical question" rule.
const FAQ_CATEGORY_OF_QUESTION = new Map();
for (const [category, questions] of Object.entries(FAQ_QUESTION_BANK)) {
  questions.forEach((q) => FAQ_CATEGORY_OF_QUESTION.set(q, category));
}

// ── Rule-based answerability check — this is what actually fixes the
// "always the same safe questions" problem. Instead of asking the LLM to
// judge whether it CAN answer a question honestly (which it does badly —
// it gravitates to universally-safe questions like "icon and text" or
// "which city"), code decides eligibility using cheap, checkable signals
// pulled from the actual verified facts (description text + visualFacts).
function isFaqQuestionAnswerable(question, { description, visualFacts, country, industry }) {
  const category = FAQ_CATEGORY_OF_QUESTION.get(question);
  const descLower = (description || "").toLowerCase();

  switch (category) {
    case "colors":
      // Needs real colors — either in VISUAL FACTS or named in the description.
      return !!(visualFacts?.rawColors?.length || extractColorWords(description).length);

    case "shape_design_concept":
    case "typography_structure":
      // Needs actual visual analysis of the logo file.
      return !!visualFacts?.hasVisualFacts;

    case "brand_identity_symbolism":
      // Needs an actual symbol/mascot/icon described, not just a wordmark
      // with nothing drawn.
      return !!(
        visualFacts?.hasVisualFacts &&
        /symbol|icon|mascot|shield|emblem|crest|animal|star|badge/i.test(visualFacts.visualFactsText || "")
      );

    case "history":
      // Needs a real founding year or an explicit mention of a redesign.
      return !!(extractFoundingYear(description) || /redesign|rebrand|changed in|update(d)? in/i.test(descLower));

    case "country_city_industry_context":
      // Needs a real, confirmed country/industry — not the generic fallback.
      return !!(country && country.trim()) || !!(industry && industry.trim() && industry !== "Logo Design & Graphics");

    case "style_personality":
    case "recognizability_practical":
      // Too subjective/generic to gate — but only allow if there's SOME
      // real basis (a description or visual facts) to draw from, so
      // TEMPLATE/no-fact logos don't get these either.
      return !!(description || visualFacts?.hasVisualFacts);

    case "website_format_technical":
      // Always answerable — this is genuine file metadata.
      return true;

    default:
      return false;
  }
}

// ── Selects exactly 2 questions IN CODE, not via LLM judgment. This is
// the actual fix for "LLM always picks the same 2 safe questions" — by
// removing the LLM's ability to choose at all, its bias toward
// universally-answerable questions (icon+text, HQ city) can no longer
// dominate. Selection uses true randomness among only the questions that
// pass isFaqQuestionAnswerable, and enforces "at most 1 technical".
function selectFaqQuestions({
  isTemplate, noVerifiedFacts, description, visualFacts, country, industry, usedFaqQuestions = [],
}) {
  const isRestricted = isTemplate || noVerifiedFacts;

  if (isRestricted) {
    // No real facts exist — only the technical pool is eligible.
    const pool = FAQ_QUESTION_BANK.website_format_technical.filter(
      (q) => !usedFaqQuestions.some((u) => u.trim().toLowerCase() === q.trim().toLowerCase())
    );
    const source = pool.length >= 2 ? pool : FAQ_QUESTION_BANK.website_format_technical;
    return pickRandomSubset(source, 2);
  }

  const fullPool = [
    ...FAQ_QUESTION_BANK.brand_identity_symbolism,
    ...FAQ_QUESTION_BANK.colors,
    ...FAQ_QUESTION_BANK.shape_design_concept,
    ...FAQ_QUESTION_BANK.typography_structure,
    ...FAQ_QUESTION_BANK.style_personality,
    ...FAQ_QUESTION_BANK.recognizability_practical,
    ...FAQ_QUESTION_BANK.history,
    ...FAQ_QUESTION_BANK.country_city_industry_context,
    ...FAQ_QUESTION_BANK.website_format_technical,
  ];

  const eligible = fullPool.filter(
    (q) =>
      isFaqQuestionAnswerable(q, { description, visualFacts, country, industry }) &&
      !usedFaqQuestions.some((u) => u.trim().toLowerCase() === q.trim().toLowerCase())
  );

  // Split into technical vs non-technical so we can enforce "at most 1 technical".
  const nonTechnical = eligible.filter((q) => FAQ_CATEGORY_OF_QUESTION.get(q) !== "website_format_technical");
  const technical = eligible.filter((q) => FAQ_CATEGORY_OF_QUESTION.get(q) === "website_format_technical");

  const picks = [];

  if (nonTechnical.length >= 2) {
    picks.push(...pickRandomSubset(nonTechnical, 2));
  } else if (nonTechnical.length === 1) {
    picks.push(nonTechnical[0]);
    if (technical.length) picks.push(pickRandomSubset(technical, 1)[0]);
  } else if (technical.length) {
    picks.push(...pickRandomSubset(technical, Math.min(2, technical.length)));
  }

  // Absolute fallback: not enough eligible questions anywhere (extremely
  // sparse facts) — fill remaining slots from technical pool regardless
  // of "used" status, since a repeated technical question is far less
  // harmful than shipping fewer than 2 FAQ items.
  while (picks.length < 2) {
    const filler = pickRandomSubset(FAQ_QUESTION_BANK.website_format_technical, 1)[0];
    if (!picks.includes(filler)) picks.push(filler);
  }

  return picks.slice(0, 2);
}
function seededShuffle(arr, seed) {
  const a = [...arr];
  let s = Math.abs(hashString(seed)) || 1;
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function getFaqPool(isRestricted, seed = "") {
  if (isRestricted) return seededShuffle(FAQ_QUESTION_BANK.website_format_technical, seed);
  const full = [
    ...FAQ_QUESTION_BANK.brand_identity_symbolism,
    ...FAQ_QUESTION_BANK.colors,
    ...FAQ_QUESTION_BANK.shape_design_concept,
    ...FAQ_QUESTION_BANK.typography_structure,
    ...FAQ_QUESTION_BANK.style_personality,
    ...FAQ_QUESTION_BANK.recognizability_practical,
    ...FAQ_QUESTION_BANK.history,
    ...FAQ_QUESTION_BANK.country_city_industry_context,
    ...FAQ_QUESTION_BANK.website_format_technical,
  ];
  return seededShuffle(full, seed);
}

// ── resolveLogoFacts ─────────────────────────────────────────────────────
// Resolves category, brand/country/industry/website, and the main
// description — the "facts" side of the pipeline. This is expensive
// (Tavily research + up to 3 description-generation attempts + 2 LLM
// calls for category/brand), so it now runs EXACTLY ONCE per upload,
// regardless of how many times the meta/FAQ step below needs to retry.
// Previously this whole thing was nested inside the outer validation
// retry loop and could run up to 3 times per upload (9x with the
// description's own internal retries), risking timeout and occasionally
// producing a DIFFERENT brand/category on each pass.
async function resolveLogoFacts({
  logoName, researchName, isManualTemplate, relatedLogos, canonicalUrl, visualFacts,
}) {
  const brandLookupName = researchName || logoName;

  // ── STEP 1: category classification (or manual template override) ───
  let mainCategory = "template";
  let subCategory = "";

  if (!isManualTemplate) {
    const classified = await classifyCategory({ logoName: brandLookupName });
    mainCategory = classified.mainCategory;
    subCategory = classified.subCategory;
  } else {
    console.log(`  [ai:category] Manual override → forced "template"`);
  }

  const categoryTree = buildCategoryTreeFromText(CATEGORY_TAXONOMY_TEXT);
  const mainCategoryFromLLM = mainCategory;
  const subCategoryFromLLM = subCategory;

  ({ mainCategory, subCategory } = validateMainSubAgainstTree(
    categoryTree,
    mainCategoryFromLLM,
    subCategoryFromLLM
  ));

  if (mainCategoryFromLLM !== mainCategory || subCategoryFromLLM !== subCategory) {
    console.log(`  [ai:category] VALIDATION CHANGED IT → main: "${mainCategoryFromLLM}" → "${mainCategory}" | sub: "${subCategoryFromLLM}" → "${subCategory}"`);
  } else {
    console.log(`  [ai:category] VALIDATED pick unchanged → main: "${mainCategory}" | sub: "${subCategory}"`);
  }

  const isTemplate = mainCategory === "template";

  // ── STEP 2: brand + country + industry + website ─────────────────────
  let resolvedBrand = "";
  let resolvedCountry = "";
  let resolvedIndustry = "";
  let resolvedWebsite = "";

  if (!isTemplate) {
    const resolved = await resolveBrandCountryIndustryWebsite({
      logoName: brandLookupName,
      mainCategory,
      subCategory,
    });
    resolvedBrand = resolved.brand;
    resolvedCountry = resolved.country;
    resolvedIndustry = resolved.industry;
    resolvedWebsite = resolved.website;
  } else {
    console.log(`  [brand+website] Skipped — TEMPLATE category, no brand/country/industry/website.`);
  }

  // ── STEP 3: main description ──────────────────────────────────────────
  const brandForDescription = isTemplate ? "" : stripSpecialChars(resolvedBrand);
  const descResult = await generateMainDescription({
    logoName: brandLookupName,
    brand: brandForDescription,
    website: isTemplate ? "" : resolvedWebsite,
    country: isTemplate ? "" : resolvedCountry,
    industry: isTemplate ? "" : resolvedIndustry,
    isTemplate,
    canonicalUrl,
    relatedDescriptions: relatedLogos.map((r) => r.description).filter(Boolean),
    visualFacts,
  });

  return {
    mainCategory,
    subCategory,
    isTemplate,
    brand: isTemplate ? "" : stripSpecialChars(resolvedBrand),
    country: isTemplate ? "" : (resolvedCountry || ""),
    industry: isTemplate ? "" : (resolvedIndustry || "Logo Design & Graphics"),
    website: isTemplate ? "" : (resolvedWebsite || ""),
    description: descResult.description,
    descriptionAttemptsExhausted: descResult.attemptsExhausted,
    descriptionIsWeak: !isTemplate && !!descResult.isEmergencyFallback,
  };
}

// ── generateMetaAndFaqContent ─────────────────────────────────────────────
// Takes the ALREADY-RESOLVED facts (category, brand, description) from
// resolveLogoFacts and generates only meta/OG/Twitter/FAQ content. This is
// the ONLY part that should be retried on validation failure — it's a
// single cheap GPT call, unlike category/brand/description resolution
// which involves Tavily research and multiple LLM calls.
async function generateMetaAndFaqContent({
  logoName, canonicalUrl, isManualTemplate,
  mainCategory, subCategory, isTemplate,
  brand, country, industry, website,
  description, visualFacts,
  relatedLogos,
}) {
  const isVariant = relatedLogos.length > 0;

  const relatedContext = isVariant
    ? relatedLogos
      .slice(0, 5)
      .map(
        (r, i) =>
          `Previous version ${i + 1}:\n- Name: ${r.logoName}\n- Meta Title: ${r.metaTitle || "N/A"}\n- Meta Description: ${r.metaDescription || "N/A"}\n- Description: ${r.description || "N/A"}\n- Tags: ${Array.isArray(r.tags) ? r.tags.join(", ") : "N/A"}`
      )
      .join("\n\n")
    : "";

  const usedFaqQuestions = isVariant
    ? relatedLogos
      .flatMap((r) => {
        const mainEntity = r?.faqSchema?.mainEntity;
        return Array.isArray(mainEntity) ? mainEntity.map((q) => q?.name).filter(Boolean) : [];
      })
    : [];

  const usedFaqAnswers = isVariant
    ? relatedLogos
      .flatMap((r) => {
        const mainEntity = r?.faqSchema?.mainEntity;
        return Array.isArray(mainEntity)
          ? mainEntity.map((q) => q?.acceptedAnswer?.text).filter(Boolean)
          : [];
      })
    : [];

  const brandFactsBlock = isTemplate
    ? `NOTE: This logo has NO confirmed real-world brand, company, country, or industry on record. Do NOT invent one. Refer only to the Logo Name and the file formats — never to "the brand" or "the company" as a stand-in subject.`
    : `1. Brand, country, and industry are FIXED facts supplied to you for every
   logo — never identify, guess, or override them yourself.

2. Website is normally a FIXED fact too. On the rare occasion it is marked
   UNKNOWN, leave it blank — never guess.

3. NEVER invent fake companies, websites, or facts not given to you.`;

  const systemPrompt = `You are a senior SEO specialist generating metadata for cdrlogo.com, a professional logo reference archive website.

Your purpose is to generate SEO content for logo pages while following STRICT compliance rules.

==================================================
CORE WEBSITE IDENTITY
==================================================

cdrlogo.com is NOT a marketplace.

cdrlogo.com is:

- educational archive
- logo reference library
- research resource
- vector/logo repository

Tone must ALWAYS feel like:

- archive
- educational
- informational
- reference resource

NEVER sound like:

- ecommerce website
- commercial product page
- marketing landing page
- advertisement

==================================================
BRAND IDENTIFICATION RULES
==================================================

${brandFactsBlock}

==================================================
GLOBAL ABSOLUTE BANNED WORDS
(ZERO EXCEPTIONS)
==================================================

Never use ANYWHERE in ANY field:

Free
Download
Free Download
Perfect for
Great for
Ideal for
Best for
Business use
Commercial projects
Branding needs
Creative and branding needs
Marketing materials
Premium quality
High quality asset
Suitable for projects
Useful for creators
Design assets
Creative work
Elevate your brand
Industry leader
Trusted worldwide
Modern branding
High Resolution
Free Download
High Quality
High Resolution
Best Logo
Premium
Amazing
Beautiful
Professional Design
Modern red/blue/green (or any color/style description)
Click here
Download now
100% free
No copyright
HD logo
World best
Top quality
Marketing/promotional language of any kind
Cutting-edge
Innovative
Stunning
${isTemplate ? `\nThe standalone words/phrases "brand", "the brand", "by brand", "this brand", "a brand", "brand's", "the company" — used as a stand-in subject in place of a real name — are ALSO absolutely banned in this response, because this logo has no confirmed brand on record. Use the Logo Name instead, every time.` : ""}

==================================================
PRIORITY ORDER
==================================================

Priority 1:
Never violate banned words.

Priority 2:
Maintain educational/reference tone.

Priority 3:
Avoid marketing/commercial language.

Priority 4:
SEO optimization comes AFTER tone.

If conflict happens:
FOLLOW PRIORITY ORDER.

==================================================
CRITICAL SELF VALIDATION
==================================================

Before returning output:

Check ALL fields.

If ANY banned word exists:

REGENERATE internally.

Never return invalid output.

Return ONLY VALID JSON.

No markdown.
No explanations.
No commentary.

Note: this call does NOT generate main_description — that field was already
generated by a separate, dedicated research pipeline BEFORE this call, and
is provided to you below as VERIFIED FACTS. Do not output a
main_description field at all.`;

  const fixedFactsBlock = isTemplate
    ? `Brand   : NONE ON RECORD — this is a TEMPLATE-category logo. Do not mention a brand, company, or industry at all. Refer only to "${logoName}" and the file formats.
Country : NONE ON RECORD — do not mention a country.
Industry: NONE ON RECORD — do not mention an industry or sector.
Website : NONE ON RECORD — do not mention a website.

IMPORTANT: Do not output brand_used / country_used / industry_used / website_used at all for this logo — none of these fields exist for TEMPLATE logos.`
    : `Brand   : ${brand || ""} (FIXED — from real-world brand knowledge, not generated by you here. Use exactly this string, do not alter, translate, or second-guess it.)
Country : ${country || ""} (FIXED — use exactly this string.)
Industry: ${industry || "Logo Design & Graphics"} (FIXED — use exactly this string.)
Website : ${website
      ? `${website} (FIXED — use exactly this string.)`
      : `UNKNOWN — leave website_used as "".`}

IMPORTANT: Do not output brand_used / country_used / industry_used at all —
brand, country, and industry are FIXED facts, never generated by you.
website_used is the only field you may need to leave blank if UNKNOWN above.`;

  const verifiedFactsBlock = description
    ? `VERIFIED FACTS (research — history/dates/HQ only):\n${description}\n\nVISUAL FACTS (from the actual image file — this is the ONLY allowed source for color/shape/symbol claims):\n${visualFacts?.visualFactsText || "(no image analysis available — do not state any color/shape/symbol claim)"}\n\nRULE: Any color, shape, or symbol claim anywhere in this response must come from VISUAL FACTS above — never from VERIFIED FACTS text, never invented.`
    : `VERIFIED FACTS: NONE.\n\nVISUAL FACTS: ${visualFacts?.visualFactsText || "(none available)"}\n\nStick to generic statements about the logo name and file formats; only use VISUAL FACTS for any color/shape claim.`;

  const metaDescriptionFieldRule = isTemplate
    ? `Must contain the Logo Name ("${logoName}") — do NOT mention a brand or company.
Must contain minimum 3 of: PNG, SVG, Vector, AI.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational use" OR "reference use" OR "research purposes"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.

STRICTLY FORBIDDEN: commercial projects, business use, branding needs, marketing language, the words "brand"/"company" used as a placeholder subject`
    : `Must contain brand name.
Must contain minimum 3 of: PNG, SVG, Vector, AI.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational use" OR "reference use" OR "research purposes"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.

STRICTLY FORBIDDEN: commercial projects, business use, branding needs, marketing language`;

  const altTextRule = isTemplate
    ? `Return EXACTLY: "${logoPhrase(logoName)} — PNG SVG vector file on cdrlogo.com"
DO NOT DEVIATE. DO NOT ADD WORDS. DO NOT use the word "brand".`
    : `Return EXACTLY: "${logoPhrase(logoName)} — PNG SVG vector file on cdrlogo.com"
DO NOT DEVIATE. DO NOT ADD WORDS.`;

  const ogDescriptionRule = isTemplate
    ? `Must sound like a DIGITAL ARCHIVE — never an advertisement.
Must contain the Logo Name and minimum 2 of: PNG, SVG, Vector, AI, CDR.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research purposes" OR "reference use"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Perfect for, for your projects, commercial language, marketing language, the words "brand"/"company" used as a placeholder subject`
    : `Must sound like a DIGITAL ARCHIVE — never an advertisement.
Must contain brand name and minimum 2 of: PNG, SVG, Vector, AI, CDR.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research purposes" OR "reference use"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Perfect for, for your projects, commercial language, marketing language`;

  const twitterTitleRule = isTemplate
    ? `Logo Name mandatory. At least one of: PNG, SVG, Vector.
STRICTLY FORBIDDEN: Free, Download, the word "brand" used as placeholder.`
    : `Brand mandatory. At least one of: PNG, SVG, Vector.
STRICTLY FORBIDDEN: Free, Download.`;

  const twitterDescriptionRule = isTemplate
    ? `Must contain the Logo Name and minimum 2 of: PNG, SVG, Vector.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research use" OR "reference use"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Perfect for, for your projects, branding use, commercial wording, the word "brand" used as placeholder`
    : `Must contain brand name and minimum 2 of: PNG, SVG, Vector.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research use" OR "reference use"
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Perfect for, for your projects, branding use, commercial wording`;

  const imageObjectDescriptionRule = isTemplate
    ? `Short, literal description of the image file itself for schema.org/ImageObject.
Must mention: the Logo Name, at least one of: logo / image / file.
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Free, Download, marketing language, the word "brand" used as placeholder.`
    : `Short, literal description of the image file itself for schema.org/ImageObject.
Must mention: brand name, at least one of: logo / image / file.
Any color/symbol/shape claim must match VERIFIED FACTS above — do not introduce a new one.
STRICTLY FORBIDDEN: Free, Download, marketing language.`;

  const websiteRule = isTemplate
    ? `This logo has no confirmed brand — always return "website_used": "".`
    : `- Only return a real, currently-existing official domain.
- Must be the brand's own root domain — not a Wikipedia page, social media profile, marketplace listing, or unrelated site.
- If you are not near-certain, return "".
- Never fabricate a domain that "looks right" (e.g. guessing brandname.com without verifying it's correct).`;
  const noVerifiedFacts = !description;
  const isRestrictedFaq = isTemplate || noVerifiedFacts;

  // FIX: the LLM was asked to choose 2 out of a shortlist, but it kept
  // gravitating to the same "universally safe" questions (icon+text,
  // HQ city) regardless of what shortlist it saw. Selection now happens
  // entirely in code via selectFaqQuestions — the LLM is only asked to
  // WRITE the answers to these 2 fixed questions, never to pick them.
  const selectedFaqQuestions = selectFaqQuestions({
    isTemplate,
    noVerifiedFacts,
    description,
    visualFacts,
    country,
    industry,
    usedFaqQuestions,
  });
  console.log(`  [faq] Selected questions: ${selectedFaqQuestions.map((q) => `"${q}"`).join(" | ")}`);
  const faqSection = `--------------------------------------------------
faq (EXACTLY 2 Q&A PAIRS — QUESTIONS ARE FIXED, DO NOT CHANGE THEM)
--------------------------------------------------

The 2 questions below have already been selected for you based on what
facts are actually available for this logo. Your ONLY job is to write the
answer to each — do not swap them for different questions, do not add
extra questions, do not skip one.

QUESTION 1: ${selectedFaqQuestions[0]}
QUESTION 2: ${selectedFaqQuestions[1]}
${usedFaqAnswers.length ? `\nPREVIOUSLY PUBLISHED FAQ ANSWERS on related pages for this same logo (do not restate the same fact in a new answer just because the question differs — if the underlying fact is already covered below, and VERIFIED FACTS supports a different fact, use that instead):\n${usedFaqAnswers.map((a, i) => `- v${i + 1}: "${String(a)}"`).join("\n")}` : ""}

STEP 1 — WRITING ANSWERS
- Every answer must naturally include the specific brand/logo name.
- Base every color/symbol/shape/letter/mascot/date/designer/history claim
  STRICTLY on sentences that actually appear in the VERIFIED FACTS
  description above — not on the raw research notes, not on general
  knowledge, and never on what you personally think the logo looks like.
  If VERIFIED FACTS genuinely doesn't support the exact claim a question
  implies, answer honestly with what IS supported rather than inventing
  detail — but do not refuse or skip the question.
- For a format/technical question, use this exact logo's real file size and
  format data where available.
- Never reuse the same answer wording across different logos, even for the
  same question — rewrite naturally each time.

STEP 2 — WRITING STYLE
Natural, simple, human English — not stiff AI phrasing. Keep answers
concise (1-2 sentences each).

STEP 3 — ACCURACY RULE
Never fabricate history, symbolism, or meaning that is not explicitly present
in VERIFIED FACTS above. A short, honest answer is always better than a
confident guess.

NEVER use: Free, Download, commercial wording${isTemplate ? `, the word "brand"/"company" as a placeholder subject` : ""}.

Return as array of EXACTLY 2 items, in this exact order — item 1 answers QUESTION 1, item 2 answers QUESTION 2:
[{ "question": "${selectedFaqQuestions[0]}", "answer": "..." }, { "question": "${selectedFaqQuestions[1]}", "answer": "..." }]`;

  const userPrompt = `Generate complete SEO metadata for this logo page.

==================================================
LOGO DETAILS
==================================================

Logo Name     : ${logoName}
Canonical URL : ${canonicalUrl}

Category (already decided — do not change, do not output a category field):
- Main Category : ${mainCategory}
- Sub Category  : ${subCategory}

${fixedFactsBlock}

${verifiedFactsBlock}

${isVariant ? `
==================================================
VARIANT / UNIQUENESS REQUIREMENT
==================================================

This logo name matches ${relatedLogos.length} existing page(s) on the site.

PREVIOUS PAGES (for reference — DO NOT COPY):

${relatedContext}

MANDATORY RULES FOR THIS VARIANT:

1. meta_title MUST be textually different from every previous Meta Title listed above.
2. meta_description MUST use different sentence structure and different educational/reference phrasing.
3. og_title, og_description, twitter_title, twitter_description must each differ in wording from previous fields.
4. faq: choose a different combination of questions than previous pages where possible (see FAQ pool below).
` : ""}

==================================================
FIELD RULES
==================================================

--------------------------------------------------
meta_title (50–60 chars HARD LIMIT)
--------------------------------------------------

Format: "{Logo Name} Logo PNG SVG Vector | cdrlogo.com"

MANDATORY RULES:
1. Use the EXACT FULL Logo Name as given — every distinguishing word (color, style, variant, version) MUST appear.
2. Must be textually different from every meta_title in PREVIOUS PAGES above.
3. Must include minimum TWO of: PNG, SVG, Vector.
4. If the generated title would be identical or near-identical to a previous page's meta_title, add a distinguishing qualifier (color, file variant, edition).

STRICTLY FORBIDDEN: Free, Download, Free Download,PNG ,SVG, Vector, cdrlogo.com , cdrlogo

--------------------------------------------------
meta_description (140–155 chars HARD LIMIT)
--------------------------------------------------

${metaDescriptionFieldRule}

--------------------------------------------------
alt_text (LOCKED FORMAT)
--------------------------------------------------
${altTextRule}

--------------------------------------------------
og_title (50–60 chars)
--------------------------------------------------

Format: "{Logo Name} — PNG SVG vector file on cdrlogo.com"
Use the EXACT FULL Logo Name — every distinguishing word MUST appear. No "| cdrlogo.com" suffix.
STRICTLY FORBIDDEN: Free, Download, marketing phrases${isTemplate ? `, the word "brand" used as placeholder` : ""}.

--------------------------------------------------
og_description (120–160 chars)
--------------------------------------------------

${ogDescriptionRule}

--------------------------------------------------
twitter_title (50–60 chars)
--------------------------------------------------

${twitterTitleRule}

--------------------------------------------------
twitter_description (100–140 chars)
--------------------------------------------------

${twitterDescriptionRule}

--------------------------------------------------
image_object_description (15–25 words)
--------------------------------------------------

${imageObjectDescriptionRule}

--------------------------------------------------
website_used — STRICT RULE
--------------------------------------------------

${websiteRule}

${faqSection}

--------------------------------------------------
FINAL OUTPUT FIELDS
--------------------------------------------------

website_used only.
(brand, industry, and country are FIXED FACTS given to you above — never
include brand_used / country_used / industry_used in your JSON output. This
section no longer decides main_category/sub_category either — that was
already decided in a separate step before this prompt. Do NOT include a
main_description field — that was already generated separately and is
provided to you above as VERIFIED FACTS.)
===========================================
==================================================
FINAL SELF VALIDATION
==================================================

BEFORE RETURNING: Scan ALL fields. If ANY banned word found OR
educational phrase missing from meta_description / og_description /
twitter_description${isTemplate ? ` OR the word "brand"/"company" was used as a placeholder subject` : ""} OR any color/symbol/letter/shape/mascot claim
appears anywhere that is not explicitly present in VERIFIED FACTS above —
REGENERATE internally.

Return ONLY VALID JSON (no "category", "brand_used", "country_used",
"industry_used", or "main_description" fields — main_description was
already generated by a separate pipeline and is provided above as
VERIFIED FACTS):

{
  "website_used": "...",
  "meta_title": "...",
  "meta_description": "...",
  "alt_text": "...",
  "og_title": "...",
  "og_description": "...",
  "twitter_title": "...",
  "twitter_description": "...",
  "image_object_description": "...",
 "faq": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
    // exactly 2 items, always
  ]
}`;

  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  async function runContentCall(extraNote = "") {
    const finalMessages = extraNote
      ? [...messages, { role: "user", content: extraNote }]
      : messages;
    const completion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0.7,
      messages: finalMessages,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    try { return JSON.parse(raw); } catch { return {}; }
  }

  let parsed = await runContentCall();

  if (isTemplate) {
    const placeholderHits = scanTemplateFieldsForPlaceholderBrand(parsed);
    if (placeholderHits.length) {
      console.warn(`  [ai:template-guard] Placeholder "brand"/"company" word found in: ${placeholderHits.join(", ")} — regenerating once.`);
      parsed = await runContentCall(
        `Your previous JSON response used the word "brand" or "company" as a placeholder subject in these fields: ${placeholderHits.join(", ")}. This logo has NO confirmed real brand — regenerate the ENTIRE JSON response, replacing every instance where "brand"/"company" was used as a stand-in subject with the actual Logo Name ("${logoName}") instead. Return the full corrected JSON object.`
      );
    }
  }

  const metaTitle = stripAccents(parsed.meta_title) ||
    `${logoName} — PNG SVG vector file on cdrlogo.com`;
  const metaDescription = stripAccents(parsed.meta_description) ||
    `${logoName}  available in PNG, SVG and vector format for educational use and research purposes. Reference archive on cdrlogo.com.`;
  const altText = stripAccents(parsed.alt_text) ||
    `${logoPhrase(logoName)} — PNG SVG vector file on cdrlogo.com`;

  const ogTitle = stripAccents((parsed.og_title && String(parsed.og_title).trim())) ||
    `${logoName} — PNG & SVG Vector`;
  const ogDescription = stripAccents(parsed.og_description) ||
    `${logoName} available in PNG and SVG vector format for educational reference and research purposes.`;
  const twitterTitle = stripAccents((parsed.twitter_title && String(parsed.twitter_title).trim())) ||
    `${logoName} — PNG SVG Vector`;
  const twitterDescription = stripAccents((parsed.twitter_description && String(parsed.twitter_description).trim())) ||
    `${logoName} in PNG and SVG vector format for educational reference and research use.`;
  const imageObjectDescription = stripAccents(parsed.image_object_description) ||
    `${logoName} image on cdrlogo.com`;
  // Lock the question text to exactly what was selected in code — the LLM
  // sometimes lightly rewords a question even when told not to. The answer
  // is still the LLM's own text; only the question label is pinned.
  const rawFaqPairs = (Array.isArray(parsed.faq) ? parsed.faq : []).slice(0, 2);
  const faqPairs = selectedFaqQuestions.map((q, i) => ({
    question: q,
    answer: (rawFaqPairs[i]?.answer && String(rawFaqPairs[i].answer).trim()) || "",
  }));

  const violations = validateAIContent(
    { ...parsed, meta_title: metaTitle, meta_description: metaDescription, alt_text: altText, og_title: ogTitle, og_description: ogDescription, twitter_title: twitterTitle, twitter_description: twitterDescription, image_object_description: imageObjectDescription, faq: faqPairs },
    { usedTitles: relatedLogos.map((r) => r.metaTitle), usedFaqQuestions, isTemplate }
  );
  if (violations.length) {
    console.warn(`  [ai:validate] ${violations.length} issue(s) found:\n    - ${violations.join("\n    - ")}`);
  }

  return {
    metaTitle,
    metaDescription,
    altText,
    ogTitle,
    ogDescription,
    twitterTitle,
    twitterDescription,
    imageObjectDescription,
    faqPairs,
  };
}


const MIN_TAGS = 4;
const MAX_TAGS = 6;

const FORBIDDEN_TAG_EXACT = new Set([
  "logo", "logos", "png", "svg", "vector", "ai", "cdr",
  "cdrlogo", "website", "free", "download", "brand", "company",
]);

function normalizeTag(t) {
  return stripAccents(String(t || ""))
    .toLowerCase()
    .replace(/\s+v\d+$/i, "")
    .replace(/\blogos?\b/g, "")            // "lion logo" → "lion"
    .replace(/[^a-z0-9\s&'-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isValidTag(t) {
  return (
    !!t &&
    t.length >= 2 &&
    t.length <= 40 &&
    !FORBIDDEN_TAG_EXACT.has(t) &&          // sirf poora tag match hone par reject
    !/cdrlogo|\b(png|svg|download|free)\b/.test(t)
  );
}
// Key = taxonomy ka EXACT sub_category string (CATEGORY_TAXONOMY_TEXT wala).
// Yahan apne keyword tool (GSC / Ahrefs / Keyword Planner) ke high-volume
// terms bharo. Khaali rehne par tags sirf brand + taxonomy + DB se banenge.
const CURATED_TAGS_BY_SUBCATEGORY = {
  // "Sportswear": ["sportswear", "athletic apparel", "sports brand"],
  // "Football Clubs": ["football club", "soccer club", "premier league"],
  // "Fast Food Restaurants": ["fast food", "restaurant chain", "food brand"],
};

// DB frequency = "high volume" ka proxy. Brand-specific tags (nike, adidas)
// exclude hote hain taaki ek brand ka tag doosre brand ke page par na chale jaye.
async function fetchPopularTags(categoryKey, limit = 8) {
  if (!categoryKey) return [];
  try {
    const rows = await prisma.logo.findMany({
      where: { category: { has: categoryKey } },
      select: { tags: true, brand: true, logoName: true },
      orderBy: { createdAt: "desc" },
      take: 500,
    });

    const brandSet = new Set(
      rows
        .flatMap((r) => [normalizeTag(r.brand), normalizeTag(r.logoName)])
        .filter(Boolean)
    );

    const freq = new Map();
    for (const r of rows) {
      for (const raw of r.tags || []) {
        const t = normalizeTag(raw);
        if (!isValidTag(t) || brandSet.has(t)) continue;
        freq.set(t, (freq.get(t) || 0) + 1);
      }
    }

    return [...freq.entries()]
      .filter(([, count]) => count >= 3) // one-off junk tags filter
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([t]) => t);
  } catch (err) {
    console.warn(`  [tags] Popular tag lookup failed: ${err.message}`);
    return [];
  }
}

async function buildTags({
  isTemplate, brand, logoName, mainCategory, subCategory, industry, country,
}) {
  const categoryKey = isTemplate ? "template" : subCategory;

  const candidates = [
    brand || logoName,
    isTemplate ? "template" : subCategory,
    isTemplate ? "" : mainCategory,
    ...(CURATED_TAGS_BY_SUBCATEGORY[categoryKey] || []),
    ...(await fetchPopularTags(categoryKey)),
    isTemplate ? "" : country,
    isTemplate ? "" : industry,
  ];

  const seen = new Set();
  const tags = [];
  for (const c of candidates) {
    const t = normalizeTag(c);
    if (!isValidTag(t) || seen.has(t)) continue;
    seen.add(t);
    tags.push(t);
    if (tags.length >= MAX_TAGS) break;
  }

  if (tags.length < MIN_TAGS) {
    console.warn(
      `  [tags] Only ${tags.length} tag(s) for "${logoName}" (category: ${categoryKey}) — curated list / DB data thin hai.`
    );
  }
  return tags;
}
async function processOneLogoFolder({ folderName, folderFiles, sharedFields, watermark }) {
  const rawLogoName = stripSpecialChars(logoNameFromFolderName(folderName));
  console.log(`\n  ── Processing folder: "${folderName}" → "${rawLogoName}"`);

  const researchName = cleanNameForResearch(logoNameFromFolderName(folderName));
  console.log(`  [name] research-safe name for brand lookup: "${researchName}"`);

  try {
    const { related, exactNormalizedMatches } = await findRelatedLogos(rawLogoName);

    let finalLogoName = stripSpecialChars(rawLogoName);
    let versioned = false;

    if (exactNormalizedMatches.length > 0) {
      finalLogoName = generateVersionedName(rawLogoName, exactNormalizedMatches);
      versioned = true;
      console.log(`  [name] Auto-versioned: "${rawLogoName}" → "${finalLogoName}"`);
    }

    const finalSlug = generateSlugFromName(finalLogoName);
    const canonicalUrl = stripTrailingSlash(`https://www.cdrlogo.com/logo/${finalSlug}`);
    console.log(`  [slug] ${finalSlug}`);

    const pngFile = folderFiles.find((f) => ext(f.filename) === "png");
    const visualFacts = pngFile
      ? await analyzeLogoImageVisually(pngFile.buffer)
      : { hasVisualFacts: false, visualFactsText: "", rawColors: [] };

    const isManualTemplate =
      sharedFields.category.toLowerCase().trim() === "template" ||
      /\btemplate\b/i.test(finalLogoName);

    const facts = await resolveLogoFacts({
      logoName: stripSpecialChars(finalLogoName),
      researchName,
      isManualTemplate,
      relatedLogos: related,
      canonicalUrl,
      visualFacts,
    });

    const nameCorrection = correctLogoNameSpelling({
      logoName: finalLogoName,
      brand: facts.brand,
      isTemplate: facts.isTemplate,
    });

    const displayLogoName =
      facts.isTemplate || isManualTemplate
        ? toProperCase(nameCorrection.correctedName)
        : nameCorrection.correctedName;

    const tags = await buildTags({
      isTemplate: facts.isTemplate,
      brand: facts.brand,
      logoName: displayLogoName,
      mainCategory: facts.mainCategory,
      subCategory: facts.subCategory,
      industry: facts.industry,
      country: facts.country,
    });
    console.log(`  [tags] ${tags.length} → ${tags.join(", ")}`);

    const MAX_VALIDATION_RETRIES = 2;
    let metaContent = null;
    let aiContent = null;
    let faqSchemaForValidation = {};
    let validation = { passed: false, reasons: ["not yet generated"] };

    for (let attempt = 0; attempt <= MAX_VALIDATION_RETRIES; attempt++) {
      metaContent = await generateMetaAndFaqContent({
        logoName: stripSpecialChars(displayLogoName),
        canonicalUrl,
        isManualTemplate,
        mainCategory: facts.mainCategory,
        subCategory: facts.subCategory,
        isTemplate: facts.isTemplate,
        brand: facts.brand,
        country: facts.country,
        industry: facts.industry,
        website: facts.website,
        description: facts.description,
        visualFacts,
        relatedLogos: related,
      });

      aiContent = {
        category: [facts.isTemplate ? "template" : facts.subCategory],
        mainCategory: facts.mainCategory,
        subCategory: facts.isTemplate ? "template" : facts.subCategory,
        brand: facts.brand,
        website: facts.website,
        country: facts.country,
        industry: facts.industry,
        description: facts.description,
        descriptionAttemptsExhausted: facts.descriptionAttemptsExhausted,
        isTemplate: facts.isTemplate,
        isVariant: related.length > 0,
        relatedSlugs: related.map((r) => r.slug).filter(Boolean),
        ...metaContent,
        tags,
      };

      faqSchemaForValidation = buildFaqSchema(aiContent.faqPairs);

      validation = await validateBeforePublish({
        aiContent,
        canonicalUrl,
        relatedLogos: related,
        faqSchema: faqSchemaForValidation,
      });

      if (validation.passed) {
        console.log(`  [publish-validate] ✓ Passed on attempt ${attempt + 1}/${MAX_VALIDATION_RETRIES + 1}`);
        break;
      }
      console.warn(`  [publish-validate] ✗ Attempt ${attempt + 1}/${MAX_VALIDATION_RETRIES + 1} failed:\n    - ${validation.reasons.join("\n    - ")}`);
    }

    if (!validation.passed) {
      console.warn(
        `  [publish-validate] Still imperfect after ${MAX_VALIDATION_RETRIES + 1} attempts — ` +
        `publishing anyway, issues logged for visibility (not sent to review for this alone).`
      );
    }

    const needsReview = !facts.isTemplate && !!facts.descriptionIsWeak;

    if (needsReview) {
      console.warn(`  [review] "${displayLogoName}" flagged for review — description fell back to the static emergency template after all retries.`);
    }

    const allReasons = [
      ...(validation.reasons.length
        ? [`Non-blocking content notes (did not block publishing): ${validation.reasons.join(" | ")}`]
        : []),
      ...(nameCorrection.wasCorrected
        ? [`Logo name auto-corrected from "${finalLogoName}" to "${displayLogoName}" to match identified brand "${facts.brand}".`]
        : []),
      ...(needsReview
        ? [`Description for "${displayLogoName}" could not be reliably generated even after retries and the relaxed fallback — needs manual review.`]
        : []),
    ];

    console.log(`  [ai] main: "${aiContent.mainCategory}" | sub: "${aiContent.subCategory}" | brand: "${aiContent.brand || "(none — template)"}" | website: "${aiContent.website || "(none)"}" | country: "${aiContent.country || "(none)"}" | industry: "${aiContent.industry || "(none)"}"`);
    console.log(`  [ai] metaTitle (${aiContent.metaTitle.length} chars): "${aiContent.metaTitle.substring(0, 60)}"`);
    console.log(`  [ai] ogTitle: "${aiContent.ogTitle}" | twitterTitle: "${aiContent.twitterTitle}"`);
    console.log(`  [ai] tags: ${aiContent.tags.length} | faq pairs: ${aiContent.faqPairs.length}`);

    // ── Step C: classify & process files ──────────────────────────────────
    const publicFiles = [];
    const separateFiles = [];
    let svgContent = null;
    const fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };
    let previewsDone = false; // sirf pehle PNG se previews banenge

    for (const { filename, buffer: fileBuffer } of folderFiles) {
      const safeFilename = sanitizeFilename(filename);
      const fileExt = ext(safeFilename);

      if (fileExt === "html" || fileExt === "htm") {
        console.log(`  [skip] Ignoring HTML file: ${safeFilename}`);
        continue;
      }

      const fileSize = (fileBuffer.length / 1024).toFixed(2);
      console.log(`  [file] ${filename} → ${safeFilename} (${fileSize} KB)`);

      if (fileExt === "svg") {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.svg = fileBuffer.length;
        if (!svgContent) svgContent = fileBuffer.toString("utf-8");

      } else if (fileExt === "png") {
        // Original PNG bilkul untouched upload hota hai
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.png = fileBuffer.length;

        // 2 preview images (square + og)
        if (!previewsDone) {
          previewsDone = true;
          const baseName = safeFilename.replace(/\.png$/i, "");

          // 1) Square 1200×1200 → webpUrl  (5% white space on all sides)
          const squareWebp = await buildPreviewWebp(fileBuffer, 1200, 1200, watermark, 0.05);
          publicFiles.push({ key: `public/${finalSlug}/${baseName}.webp`, buffer: squareWebp, contentType: "image/webp" });

          // 2) OG 1200×630 → ogImageUrl  (unchanged, still 12%)
          const ogWebp = await buildPreviewWebp(fileBuffer, 1200, 630, watermark);
          publicFiles.push({ key: `public/${finalSlug}/${baseName}-og.webp`, buffer: ogWebp, contentType: "image/webp" });
        }

      } else if (fileExt === "ai") {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.ai = fileBuffer.length;

      } else if (fileExt === "cdr") {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.cdr = fileBuffer.length;

      } else {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
      }
    }

    // ── Step D: upload to R2 ────────────────────────────────────────────────
    const allUploads = [...publicFiles, ...separateFiles];
    const uploadResults = await Promise.all(
      allUploads.map(async ({ key, buffer, contentType }) => {
        try {
          return await uploadToR2({ fileBuffer: buffer, fileName: key, mimeType: contentType });
        } catch (err) {
          console.error(`  [r2] ❌ Failed: ${key} — ${err.message}`);
          return null;
        }
      })
    );

    const urlMap = {};
    allUploads.forEach(({ key }, i) => { urlMap[key] = uploadResults[i]; });

    const findUrl = (pred) => {
      const match = allUploads.find(pred);
      return match ? urlMap[match.key] : null;
    };

    const svgUrl = findUrl((f) => f.key.endsWith(".svg"));
    const pngUrl = findUrl((f) => f.key.endsWith(".png"));
    const aiUrl = findUrl((f) => f.key.endsWith(".ai"));
    const cdrUrl = findUrl((f) => f.key.endsWith(".cdr"));

    // square = webpUrl, OG = ogImageUrl (alag-alag files)
    const webpUrl = findUrl((f) => f.key.endsWith(".webp") && !f.key.endsWith("-og.webp"));
    const ogImageUrl = findUrl((f) => f.key.endsWith("-og.webp")) || null;
    console.log(`  [urls] webp(square): ${webpUrl || "null"} | ogImageUrl(1200x630): ${ogImageUrl || "null"}`);

    // ── Step E: build schema JSON-LD ────────────────────────────────────────
    const imageObjectSchema = buildImageObjectSchema({
      imageUrl: webpUrl, // square 1200×1200 URL
      logoName: displayLogoName,
      brand: aiContent.brand,
      canonicalUrl,
      description: aiContent.imageObjectDescription,
    });

    const breadcrumbSchema = buildBreadcrumbSchema({
      brand: aiContent.brand,
      logoName: displayLogoName,
      canonicalUrl,
    });

    const faqSchema = faqSchemaForValidation;

    console.log(`  [schema] imageObject: ${Object.keys(imageObjectSchema).length ? "built" : "empty"} | breadcrumb: built | faq: ${Object.keys(faqSchema).length ? "built" : "empty"}`);

    // ── Step F: save to DB ───────────────────────────────────────────────────
    const logo = await prisma.logo.create({
      data: {
        owner: "admin",
        logoName: displayLogoName,
        slug: finalSlug,
        brand: aiContent.brand,
        website: aiContent.website,
        category: isManualTemplate ? ["template"] : aiContent.category,
        industry: aiContent.industry,
        country: aiContent.country,
        license: sharedFields.license,
        description: aiContent.description,
        tags: aiContent.tags,
        brandColors: sharedFields.brandColors,
        publishStatus: needsReview ? "Needs Review" : sharedFields.publishStatus,
        validationStatus: needsReview ? "needs_review" : "published",
        validationReasons: allReasons,
        downloadCount: sharedFields.downloadCount,
        svgUrl,
        pngUrl,
        webpUrl,          // square 1200×1200
        aiUrl,
        cdrUrl,
        svgContent,
        metaTitle: aiContent.metaTitle,
        metaDescription: aiContent.metaDescription,
        altText: aiContent.altText,
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),
        canonicalUrl,
        ogTitle: aiContent.ogTitle,
        ogDescription: aiContent.ogDescription,
        ogImageUrl,       // OG 1200×630
        ogType: "website",
        twitterTitle: aiContent.twitterTitle,
        twitterDescription: aiContent.twitterDescription,
        twitterImage: ogImageUrl,
        twitterCardType: "summary_large_image",
        imageObjectSchema,
        breadcrumbSchema,
        faqSchema,
      },
    });

    console.log(`  [db] ✓ Saved ID: ${logo.id}`);

    return {
      success: true,
      logoName: displayLogoName,
      slug: finalSlug,
      versioned,
      originalName: rawLogoName,
      category: aiContent.category,
      brand: aiContent.brand,
      website: aiContent.website,
      country: aiContent.country,
      industry: aiContent.industry,
      canonicalUrl,
      webpUrl,
      ogImageUrl,
      id: logo.id,
      needsReview,
      nameAutoCorrected: nameCorrection.wasCorrected,
      validationReasons: allReasons,
    };

  } catch (err) {
    console.error(`  [error] ❌ "${rawLogoName}": ${err.message}`);
    return {
      success: false,
      logoName: rawLogoName,
      slug: generateSlugFromName(rawLogoName),
      error: err.message,
    };
  }
}

export const maxDuration = 60;

// ══════════════════════════════════════════════════════════════════════════
// REQUEST / RESPONSE HANDLING — SINGLE UPLOAD (multipart/form-data with
// logoName + files[]). Frontend ko koi change nahi chahiye. Andar ki saari
// generation logic ab bulk route jaisi hi hai.
// ══════════════════════════════════════════════════════════════════════════
export async function POST(req) {
  console.log("\n========== SINGLE-FOLDER UPLOAD START ==========");
  const startTime = Date.now();

  try {
    // ── Parse multipart/form-data ───────────────────────────────────────────
    const formData = await req.formData();

    const folderName = (formData.get("logoName") || "").toString().trim();

    // category is always "" here — the classifier decides main/sub category
    const category = "";

    const license = (formData.get("license") || "Educational").toString();
    const publishStatus = (formData.get("publishStatus") || "Draft").toString();
    const downloadCount = (formData.get("downloadCount") || "unlimited").toString();

    let brandColors = [];
    try {
      const rawColors = formData.get("brandColors");
      if (rawColors) brandColors = JSON.parse(rawColors);
    } catch {
      brandColors = [];
    }

    if (!folderName) {
      return NextResponse.json({ error: "logoName is required." }, { status: 400 });
    }

    const uploadedFiles = formData.getAll("files");
    if (!uploadedFiles || uploadedFiles.length === 0) {
      return NextResponse.json({ error: "Please upload at least one ZIP file." }, { status: 400 });
    }

    console.log(`[1] Received ${uploadedFiles.length} zip file(s) for logoName: "${folderName}"`);

    // ── Extract entries from each uploaded ZIP ───────────────────────────────
    const folderFiles = [];
    for (const uploaded of uploadedFiles) {
      if (!uploaded || typeof uploaded === "string") continue;

      const arrayBuffer = await uploaded.arrayBuffer();
      const zipBuffer = Buffer.from(arrayBuffer);
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();

      for (const entry of entries) {
        if (entry.isDirectory) continue;
        const parts = entry.entryName.split("/").filter(Boolean);
        const filename = parts[parts.length - 1];
        if (!filename || filename.startsWith(".")) continue;
        folderFiles.push({ filename, buffer: entry.getData() });
      }
    }

    if (folderFiles.length === 0) {
      return NextResponse.json({ error: `No files found in uploaded ZIP(s) for "${folderName}".` }, { status: 400 });
    }

    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;

    const sharedFields = { category, license, publishStatus, downloadCount, brandColors };

    const result = await processOneLogoFolder({ folderName, folderFiles, sharedFields, watermark });

    await prisma.log.create({
      data: {
        who: "api:single-upload-logo",
        content: result.success
          ? `Single upload ✓ "${result.logoName}" (slug: ${result.slug})`
          : `Single upload ❌ "${result.logoName}": ${result.error}`,
      },
    });

    console.log(`Duration: ${Date.now() - startTime}ms`);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}