import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../../../lib/r2";
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

const EDUCATIONAL_PHRASES = [
  "educational use",
  "educational reference",
  "reference use",
  "research purposes",
  "research use",
  "design reference",
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
    "name": `${logoName}`,
    "description": description || `${logoName} logo image on cdrlogo.com`,
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
    "mainEntity": faqPairs.slice(0, 3).map((qa) => ({
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
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
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

// Runs a small batch of targeted queries about the brand/logo and returns
// deduplicated, truncated source snippets to hand to the writer prompt.
// Returns hasResults: false when nothing usable came back (drives Case C
// in generateMainDescription — leave description blank).
async function researchBrandFacts(logoName, brand) {
  const subject = (brand && brand.trim()) || logoName;

  const queries = [
    `${subject} logo history design meaning`,
    `${subject} official brand colors hex code`,
    `${subject} founded headquarters official website`,
  ];

  const allResults = [];
  for (const q of queries) {
    const results = await tavilySearch(q, 4);
    allResults.push(...results);
  }

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

async function generateMainDescription({ logoName, brand, isTemplate, canonicalUrl }) {
  if (isTemplate) {
    console.log(`  [description] Skipped — TEMPLATE category, description left blank.`);
    return "";
  }

  const { hasResults, contextText } = await researchBrandFacts(logoName, brand);

  const systemPrompt = `You are a careful research writer producing the "About This Logo" description for a logo reference page. You never invent facts. You only use what is explicitly supported by the research notes given to you. If the notes don't support a fact, you leave it out rather than guessing. Return ONLY valid JSON, no markdown, no commentary.`;

  function buildUserPrompt() {
    return `LOGO NAME: ${logoName}
BRAND (if identified): ${brand || "(not confidently identified)"}

INTERNAL PAGE URL (for your reference only — do NOT use this as, or confuse this with, the brand's official website. It is this archive's own internal page address, never a fact about the brand itself. Never mention it, or any similar-looking address, in the description you write): ${canonicalUrl}

RESEARCH NOTES (from web search — may be incomplete or empty):
${hasResults ? contextText : "(no usable search results were found for this name)"}

==================================================
TASK
==================================================

Write the "About This Logo" description following these exact rules.

STEP 1 — JUDGE THE RESEARCH NOTES
Read the research notes above. Decide honestly which case applies:

CASE A — SUBSTANTIAL VERIFIABLE HISTORY:
The notes contain genuine, verifiable facts about founding date, logo history/redesign dates, designer, symbolism, official colors, typography, HQ location, or official website.
→ Write a description between 150 and 250 words. Include as much of the verified facts as you can, but never pad with invented detail:
  * Founding date (exact date if available)
  * Logo history — when the current logo launched, and change dates if it changed
  * Reason for redesign if publicly documented (rebrand, merger, sponsorship change)
  * Visual elements — describe shapes, imagery, and colors factually (what is literally in the logo)
  * Official colors — name them only (e.g. "black and yellow", "navy blue and white"). NEVER include hex codes, RGB values, or Pantone codes anywhere in the description, even if the research notes contain them.
  * Typography/font style if known
  * HQ city and country
  * Official website link — ONLY if the RESEARCH NOTES themselves state or confirm a real domain belonging to ${brand || logoName}. Never state a website you were not given evidence for in the notes, and never substitute the INTERNAL PAGE URL above for this.
  * State the logo is official/original ONLY if the notes support it — never assume
  * If a full legal name appears in brackets alongside a short name, naturally use both once
  * If the original name is in a non-English script, use only the official English-transliterated form exactly as given in the notes — never translate or invent your own spelling
  * End with exactly one closing sentence about file formats (see STEP 2, "CLOSING SENTENCE" rule) — do not mention file formats anywhere else in the description

CASE B — BRAND IS REAL/IDENTIFIABLE BUT NOTES ARE THIN:
The notes only confirm the brand/logo name is real (or barely touch on it) but do not support real history, dates, designer, or colors.
→ Write a SHORT description between 30 and 80 words, including only:
  * Brand/logo name
  * Official website, ONLY if the RESEARCH NOTES themselves confirm one — never guess, and never use the INTERNAL PAGE URL
  * State it's official/original ONLY if verifiable — otherwise omit that claim entirely
  * A line noting the logo is provided for educational and reference use
  * End with exactly one closing sentence about file formats (see STEP 2, "CLOSING SENTENCE" rule)
  Leave out history, dates, designer, and redesign info entirely.

CASE C — NO RELIABLE INFORMATION:
The notes are empty, irrelevant, or the logo appears to be a custom, local, template-like, or otherwise unverifiable name with no real public information.
→ Return an empty string "" for description. Do not write generic filler. Do not guess.

STEP 2 — WRITING STYLE (applies to CASE A and CASE B only)
* Natural, simple, human English — not stiff AI phrasing. Avoid words like "showcases," "underscores," "facilitates," "embodies."
* Mix short and long sentences.
* Never copy or closely paraphrase source wording — rewrite completely in your own words.
* This description must not follow a generic templated skeleton — write it the way a person would actually write it for this specific logo.
* Always insert a space after every sentence-ending period, question mark, or exclamation mark.

NO UNSOURCED INTERPRETATION:
Never state what a shape, color, or design "symbolizes," "represents," "reflects," "highlights," or "embodies" unless the research notes explicitly say so. Do not invent meaning about strength, leadership, ambition, tradition, or heritage. If the notes don't explain what something means, just describe what is literally visible (e.g. "the emblem includes two cherries inside a shield outline") without interpreting it.

NO SELF-CONTRADICTION:
Do not describe the logo's shape or form inconsistently within the same description (e.g. calling it a "circular badge" in one sentence and a "shield" in another), unless you are clearly describing two distinct historical versions, each with its own stated date.

REDUNDANT "LOGO" WORDING:
If LOGO NAME already contains the word "Logo" (e.g. "Borussia Dortmund Logo V2"), never stack a second "logo" right after it (never write "Borussia Dortmund Logo V2 logo is available..."). Rephrase naturally instead, e.g. "Borussia Dortmund's V2 logo is available..." or start the sentence with "This logo...".

CLOSING SENTENCE (formats — mention ONCE, only here):
End the description with exactly one sentence, close to this pattern, adapted naturally to the sentence flow:
"The [Logo Name] logo is available on this page in PNG, SVG, AI, and CDR formats for reference and design purposes."
Do not use variants scattered elsewhere like "logo PNG", "logo vector", "versions of the logo exist", "the logo exists in various formats", or "making it accessible for different uses." File formats must appear exactly once in the whole description, in this closing sentence only.

STEP 3 — BANNED WORDS (ZERO EXCEPTIONS, applies to CASE A and CASE B)
Never use, in any form or tense, anywhere in the description:
Free, Download (or "downloads"/"downloading"), Get it now, Perfect for, Great for, Ideal for, Best for,
Business use, Commercial project(s), Branding need(s), Marketing material(s), Premium quality,
High quality, High resolution, Best logo, Suitable for project(s), Useful for creator(s), Design asset(s),
Creative work, Elevate your brand, Industry leader, Trusted worldwide, Modern branding, Amazing,
Beautiful, Professional design, Click here, 100% free, No copyright, HD logo, World best, Top quality,
Cutting-edge, Innovative, Stunning, or any other marketing/promotional/advertising phrasing.
This page is an educational reference archive, never a download page or marketplace — do not write as if
inviting the reader to obtain, get, or download anything.
Also never mention "cdrlogo.com," any other website domain of this archive, or any URL — the only URL
that may appear is the brand's own official website, and only when the research notes confirm it.

STEP 4 — ACCURACY RULE (NON-NEGOTIABLE)
Never state a fact not supported by the research notes above. If you are unsure, leave it out. A short, honest description is always better than a longer one with invented facts. If in doubt between Case A/B/C, choose the more conservative case.

Return ONLY this JSON:
{
  "case": "A" or "B" or "C",
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
      (parsed.description && String(parsed.description).trim()) || ""
    );
    return { caseUsed, description };
  }

  // ── detects a stray hex/RGB/Pantone code slipping into the description ──
  function containsColorCode(text) {
    if (!text) return false;
    if (/#[0-9a-f]{3,8}\b/i.test(text)) return true;                     // #FFCC00
    if (/\brgb\s*\(/i.test(text)) return true;                            // rgb(...)
    if (/\bpantone\s*\d/i.test(text)) return true;                        // Pantone 123
    return false;
  }

  try {
    let { caseUsed, description } = await runDescriptionCall();

    // Safety net: banned word slipped through, hex/RGB/Pantone code leaked
    // in despite instructions, or the model echoed the internal page URL /
    // cdrlogo.com as if it were the brand's website. Do ONE regeneration
    // pass with an explicit correction note before falling back to blank.
    const bannedHit = containsBannedPhrase(description);
    const colorCodeHit = containsColorCode(description);
    const leakedInternalUrl =
      description && (description.includes(canonicalUrl) || /cdrlogo\.com/i.test(description));

    if (description && (bannedHit || colorCodeHit || leakedInternalUrl)) {
      const reason = bannedHit
        ? `it used the banned phrase "${bannedHit}"`
        : colorCodeHit
        ? `it included a hex/RGB/Pantone color code, which is not allowed — colors must be described by name only`
        : `it incorrectly mentioned the internal archive URL/domain instead of a verified brand website (or none at all)`;
      console.warn(`  [description] Regenerating once — ${reason}.`);
      const retry = await runDescriptionCall(
        `Your previous JSON response was rejected because ${reason}. Regenerate the ENTIRE JSON response, fixing this issue. Follow the STEP 3 banned-words list, the "Official colors — name them only, never hex/RGB/Pantone" rule, and the internal-URL rule exactly.`
      );
      caseUsed = retry.caseUsed;
      description = retry.description;

      // If it still fails after one retry, don't publish bad content —
      // fall back to blank rather than risk a banned word, a color code, or a wrong URL.
      if (
        description &&
        (containsBannedPhrase(description) ||
          containsColorCode(description) ||
          description.includes(canonicalUrl) ||
          /cdrlogo\.com/i.test(description))
      ) {
        console.warn(`  [description] Still failing validation after retry — leaving blank.`);
        description = "";
      }
    }

    console.log(
      `  [description] Case ${caseUsed} — ${description ? `${description.split(/\s+/).length} words` : "BLANK"}`
    );

    return description;
  } catch (err) {
    console.warn(`  [description] Generation failed: ${err.message} — leaving blank.`);
    return "";
  }
}

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
      temperature: 0,
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
      temperature: 0,
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

// ── FAQ topic pool (expanded so every logo doesn't get the same 3 questions) ─
const FAQ_TOPIC_POOL = [
  "What file formats is this logo available in?",
  "Is this logo available in vector format?",
  "Can I use this logo for educational purposes?",
  "What is the difference between the PNG and SVG versions of this logo?",
  "Is this logo suitable for design study or research reference?",
  "What is a CDR file and why is it included with this logo?",
  "Can this logo be resized without losing quality?",
  "What is the recommended use case for the AI file format of this logo?",
  "How is this logo archived on cdrlogo.com?",
  "What is the significance of having both raster and vector formats for this logo?",
  "Is a high-resolution version of this logo available for reference?",
  "What industry or category does this logo belong to?",
];

// ── AI content generation ──────────────────────────────────────────────────
async function generateAIContent({
  logoName,
  isManualTemplate,
  relatedLogos,
  canonicalUrl,
}) {
  const isVariant = relatedLogos.length > 0;

  // ── STEP 1: category classification (or manual template override) ───────
  let mainCategory = "template";
  let subCategory = "";

  if (!isManualTemplate) {
    const classified = await classifyCategory({ logoName });
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

  // ── STEP 2: brand + country + industry + website ─────────────────────────
  // TEMPLATE logos get NONE of these — no LLM call, all blank.
  let resolvedBrand = "";
  let resolvedCountry = "";
  let resolvedIndustry = "";
  let resolvedWebsite = "";

  if (!isTemplate) {
    const resolved = await resolveBrandCountryIndustryWebsite({
      logoName,
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

  // ── System prompt (shared) ────────────────────────────────────────────────
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

Note: this call does NOT generate main_description — that field is produced
by a separate, dedicated research pipeline and merged in afterward. Do not
output a main_description field at all.`;

  // ── Fixed-facts block for user prompt ─────────────────────────────────────
  const fixedFactsBlock = isTemplate
    ? `Brand   : NONE ON RECORD — this is a TEMPLATE-category logo. Do not mention a brand, company, or industry at all. Refer only to "${logoName}" and the file formats.
Country : NONE ON RECORD — do not mention a country.
Industry: NONE ON RECORD — do not mention an industry or sector.
Website : NONE ON RECORD — do not mention a website.

IMPORTANT: Do not output brand_used / country_used / industry_used / website_used at all for this logo — none of these fields exist for TEMPLATE logos.`
    : `Brand   : ${resolvedBrand || ""} (FIXED — from real-world brand knowledge, not generated by you here. Use exactly this string, do not alter, translate, or second-guess it.)
Country : ${resolvedCountry || ""} (FIXED — use exactly this string.)
Industry: ${resolvedIndustry || "Logo Design & Graphics"} (FIXED — use exactly this string.)
Website : ${resolvedWebsite
      ? `${resolvedWebsite} (FIXED — use exactly this string.)`
      : `UNKNOWN — leave website_used as "".`}

IMPORTANT: Do not output brand_used / country_used / industry_used at all —
brand, country, and industry are FIXED facts, never generated by you.
website_used is the only field you may need to leave blank if UNKNOWN above.`;

  // ── Field rules that mention brand — swapped for template ────────────────
  const metaDescriptionFieldRule = isTemplate
    ? `Must contain the Logo Name ("${logoName}") — do NOT mention a brand or company.
Must contain minimum 3 of: PNG, SVG, Vector, AI.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational use" OR "reference use" OR "research purposes"

STRICTLY FORBIDDEN: commercial projects, business use, branding needs, marketing language, the words "brand"/"company" used as a placeholder subject`
    : `Must contain brand name.
Must contain minimum 3 of: PNG, SVG, Vector, AI.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational use" OR "reference use" OR "research purposes"

STRICTLY FORBIDDEN: commercial projects, business use, branding needs, marketing language`;

  const altTextRule = isTemplate
    ? `Return EXACTLY: "${logoName} logo — PNG SVG vector file on cdrlogo.com"
DO NOT DEVIATE. DO NOT ADD WORDS. DO NOT use the word "brand".`
    : `Return EXACTLY: "${logoName} logo — PNG SVG vector file on cdrlogo.com"
DO NOT DEVIATE. DO NOT ADD WORDS.`;

  const ogDescriptionRule = isTemplate
    ? `Must sound like a DIGITAL ARCHIVE — never an advertisement.
Must contain the Logo Name and minimum 2 of: PNG, SVG, Vector, AI, CDR.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research purposes" OR "reference use"
STRICTLY FORBIDDEN: Perfect for, for your projects, commercial language, marketing language, the words "brand"/"company" used as a placeholder subject`
    : `Must sound like a DIGITAL ARCHIVE — never an advertisement.
Must contain brand name and minimum 2 of: PNG, SVG, Vector, AI, CDR.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research purposes" OR "reference use"
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
STRICTLY FORBIDDEN: Perfect for, for your projects, branding use, commercial wording, the word "brand" used as placeholder`
    : `Must contain brand name and minimum 2 of: PNG, SVG, Vector.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research use" OR "reference use"
STRICTLY FORBIDDEN: Perfect for, for your projects, branding use, commercial wording`;

  const imageObjectDescriptionRule = isTemplate
    ? `Short, literal description of the image file itself for schema.org/ImageObject.
Must mention: the Logo Name, at least one of: logo / image / file.
STRICTLY FORBIDDEN: Free, Download, marketing language, the word "brand" used as placeholder.`
    : `Short, literal description of the image file itself for schema.org/ImageObject.
Must mention: brand name, at least one of: logo / image / file.
STRICTLY FORBIDDEN: Free, Download, marketing language.`;

  const websiteRule = isTemplate
    ? `This logo has no confirmed brand — always return "website_used": "".`
    : `- Only return a real, currently-existing official domain.
- Must be the brand's own root domain — not a Wikipedia page, social media profile, marketplace listing, or unrelated site.
- If you are not near-certain, return "".
- Never fabricate a domain that "looks right" (e.g. guessing brandname.com without verifying it's correct).`;

  // ── FAQ section — expanded pool + variety + variant-dedup ─────────────────
  const faqSection = `--------------------------------------------------
faq (EXACTLY 3 Q&A PAIRS)
--------------------------------------------------

Choose EXACTLY 3 questions from this pool — pick a DIFFERENT combination of
3 than you would typically default to, so different logos end up with
different question sets rather than the same 3 every time. You do not have
to use the wording below verbatim; you may lightly rephrase a question as
long as it stays factual and on-topic.

QUESTION POOL:
${FAQ_TOPIC_POOL.map((q) => `- ${q}`).join("\n")}
${isTemplate ? `\nNote: this logo has no confirmed brand, so skip any pool question that would require mentioning a brand or industry (e.g. skip the "what industry does this logo belong to" question for this logo).` : ""}
${usedFaqQuestions.length ? `\nPREVIOUSLY USED FAQ QUESTIONS on related pages (choose DIFFERENT questions from the pool where possible — avoid repeating these verbatim):\n${usedFaqQuestions.map((q) => `- "${q}"`).join("\n")}` : ""}

Answers must be factual, 1–2 sentences, educational/reference tone.
NEVER use: Free, Download, commercial wording${isTemplate ? `, the word "brand"/"company" as a placeholder subject` : ""}.

Return as array: [{ "question": "...", "answer": "..." }, ...]`;

  // ── User prompt ─────────────────────────────────────────────────────────
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
4. tags: keep core brand/format tags but vary the 4 context-specific tags. important **dont use these tags in tags [logo,png,svg,vector,cdrlogo,cdrlogo.com] **
5. faq: choose a different combination of questions than previous pages where possible (see FAQ pool below).
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


==================================================
🚨 ABSOLUTE TAG RULE (HIGHEST PRIORITY) only select less than 5
==================================================

The "tags" array MUST NEVER contain ANY of the following values:

- logo
- png
- svg
- vector
- cdrlogo
- cdrlogo.com
- website
- website.com
${isTemplate ? `- brand\n- company` : ""}

THIS IS A HARD REQUIREMENT.

DO NOT include these words exactly, in any capitalization, or as standalone tags.

❌ WRONG:
[ "logo", "png", "sports", "vector"]

❌ WRONG:
[ "SVG", "vector", "cdrlogo.com"]



If you cannot think of enough tags, use fewer tags.
DO NOT fill the array with the forbidden words.
--------------------------------------------------

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
main_description field — that is generated separately.)
===========================================
==================================================
FINAL SELF VALIDATION
==================================================

BEFORE RETURNING: Scan ALL fields. If ANY banned word found OR
educational phrase missing from meta_description / og_description /
twitter_description${isTemplate ? ` OR the word "brand"/"company" was used as a placeholder subject` : ""} — REGENERATE internally.

Return ONLY VALID JSON (no "category", "brand_used", "country_used",
"industry_used", or "main_description" fields — main_description is
generated by a separate pipeline):

{
  "website_used": "...",
  "meta_title": "...",
  "meta_description": "...",
  "alt_text": "...",
  "tags": ["...", "..."],
  "og_title": "...",
  "og_description": "...",
  "twitter_title": "...",
  "twitter_description": "...",
  "image_object_description": "...",
  "faq": [
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." },
    { "question": "...", "answer": "..." }
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
      temperature: 0.6,
      messages: finalMessages,
      response_format: { type: "json_object" },
    });
    const raw = completion.choices[0]?.message?.content || "{}";
    try { return JSON.parse(raw); } catch { return {}; }
  }

  let parsed = await runContentCall();

  // TEMPLATE-only safety net: if the model slipped in a literal "brand"/
  // "company" placeholder word despite instructions, do ONE regeneration
  // pass with an explicit correction note before falling back silently.
  if (isTemplate) {
    const placeholderHits = scanTemplateFieldsForPlaceholderBrand(parsed);
    if (placeholderHits.length) {
      console.warn(`  [ai:template-guard] Placeholder "brand"/"company" word found in: ${placeholderHits.join(", ")} — regenerating once.`);
      parsed = await runContentCall(
        `Your previous JSON response used the word "brand" or "company" as a placeholder subject in these fields: ${placeholderHits.join(", ")}. This logo has NO confirmed real brand — regenerate the ENTIRE JSON response, replacing every instance where "brand"/"company" was used as a stand-in subject with the actual Logo Name ("${logoName}") instead. Return the full corrected JSON object.`
      );
    }
  }

  // ── Resolve category ──────────────────────────────────────────────────────
  const finalCategoryValue = isTemplate ? "template" : subCategory;
  const resolvedCategories = [finalCategoryValue];

  // ── Resolve brand / country / industry / website ──────────────────────────
  const brand = isTemplate ? "" : stripSpecialChars(resolvedBrand);
  const country = isTemplate ? "" : (resolvedCountry || "");
  const industry = isTemplate ? "" : (resolvedIndustry || "Logo Design & Graphics");
  const website = isTemplate ? "" : (resolvedWebsite || "");

  // ── Main description — dedicated research-based pipeline ──────────────────
  // Template → blank. Non-template → real web research, then the model
  // honestly judges Case A (150–250 words) / Case B (30–80 words) /
  // Case C (blank, no reliable info at all).
  const description = await generateMainDescription({
    logoName,
    brand,
    isTemplate,
    canonicalUrl,
  });

  // ── Field fallbacks (educational-tone, banned-word-free) ─────────────────
  const metaTitle = stripAccents(parsed.meta_title) ||
    `${logoName} — PNG SVG vector file on cdrlogo.com`;
  const metaDescription = stripAccents(parsed.meta_description) ||
    `${logoName}  available in PNG, SVG and vector format for educational use and research purposes. Reference archive on cdrlogo.com.`;
  const altText = stripAccents(parsed.alt_text) ||
    (isTemplate
      ? `${logoName} logo — PNG SVG vector file on cdrlogo.com`
      : `${logoName} — PNG SVG vector file on cdrlogo.com`);
  const tags = Array.isArray(parsed.tags) && parsed.tags.length
    ? parsed.tags.map(t => stripAccents(String(t)))
    : [logoName, "PNG", "SVG", "vector", "cdrlogo.com"];

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
  const faqPairs = Array.isArray(parsed.faq) ? parsed.faq : [];

  // ── Post-generation validation logging (not blocking, but visible) ───────
  const violations = validateAIContent(
    { ...parsed, meta_title: metaTitle, meta_description: metaDescription, alt_text: altText, og_title: ogTitle, og_description: ogDescription, twitter_title: twitterTitle, twitter_description: twitterDescription, image_object_description: imageObjectDescription, faq: faqPairs },
    { usedTitles: relatedLogos.map((r) => r.metaTitle), usedFaqQuestions, isTemplate }
  );
  if (violations.length) {
    console.warn(`  [ai:validate] ${violations.length} issue(s) found:\n    - ${violations.join("\n    - ")}`);
  }

  return {
    category: resolvedCategories,
    mainCategory,
    subCategory: finalCategoryValue,
    brand,
    website,
    country,
    industry,
    metaTitle,
    metaDescription,
    description,
    altText,
    tags,
    ogTitle,
    ogDescription,
    twitterTitle,
    twitterDescription,
    imageObjectDescription,
    faqPairs,
    isVariant,
    isTemplate,
    relatedSlugs: relatedLogos.map((r) => r.slug).filter(Boolean),
  };
}

// ── Process one logo folder ───────────────────────────────────────────────────
async function processOneLogoFolder({ folderName, folderFiles, sharedFields, watermark }) {
  const rawLogoName = stripSpecialChars(logoNameFromFolderName(folderName));
  console.log(`\n  ── Processing folder: "${folderName}" → "${rawLogoName}"`);

  try {
    // ── Step A: resolve final name & slug (auto-versioning) ──────────────────
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

    // ── Step B: AI content generation ────────────────────────────────────────
    const isManualTemplate =
      sharedFields.category.toLowerCase().trim() === "template" ||
      /\btemplate\b/i.test(finalLogoName);

    const aiContent = await generateAIContent({
      logoName: stripSpecialChars(finalLogoName),
      isManualTemplate,
      relatedLogos: related,
      canonicalUrl,
    });

    console.log(`  [ai] main: "${aiContent.mainCategory}" | sub: "${aiContent.subCategory}" | brand: "${aiContent.brand || "(none — template)"}" | website: "${aiContent.website || "(none)"}" | country: "${aiContent.country || "(none)"}" | industry: "${aiContent.industry || "(none)"}"`);
    console.log(`  [ai] metaTitle (${aiContent.metaTitle.length} chars): "${aiContent.metaTitle.substring(0, 60)}"`);
    console.log(`  [ai] ogTitle: "${aiContent.ogTitle}" | twitterTitle: "${aiContent.twitterTitle}"`);
    console.log(`  [ai] tags: ${aiContent.tags.length} | faq pairs: ${aiContent.faqPairs.length}`);

    // ── Step C: classify & process files ─────────────────────────────────────
    const publicFiles = [];
    const separateFiles = [];
    let svgContent = null;
    const fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };

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
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.png = fileBuffer.length;

        const watermarked = await applyWatermark(fileBuffer, watermark);
        const webpBuffer = await sharp(watermarked).webp({ quality: 90 }).toBuffer();
        const webpName = safeFilename.replace(/\.png$/i, ".webp");
        publicFiles.push({ key: `public/${finalSlug}/${webpName}`, buffer: webpBuffer, contentType: "image/webp" });

      } else if (fileExt === "ai") {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.ai = fileBuffer.length;

      } else if (fileExt === "cdr") {
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
        fileSizes.cdr = fileBuffer.length;

      } else {
        // koi aur file type ho to bhi "separate" mein hi — koi "private" folder nahi
        separateFiles.push({ key: `separate/${finalSlug}/${safeFilename}`, buffer: fileBuffer, contentType: mime(safeFilename) });
      }
    }


    // ── Step D: upload to R2 ──────────────────────────────────────────────────
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
    const webpUrl = findUrl((f) => f.key.endsWith(".webp"));
    const aiUrl = findUrl((f) => f.key.endsWith(".ai"));
    const cdrUrl = findUrl((f) => f.key.endsWith(".cdr"));

    // ogImageUrl — public WebP is the OG/Twitter card image
    const ogImageUrl = webpUrl || null;
    console.log(`  [urls] webp: ${webpUrl || "null"} | ogImageUrl: ${ogImageUrl || "null"}`);

    // ── Step E: build schema JSON-LD ──────────────────────────────────────────
    const imageObjectSchema = buildImageObjectSchema({
      imageUrl: ogImageUrl,
      logoName: finalLogoName,
      brand: aiContent.brand,
      canonicalUrl,
      description: aiContent.imageObjectDescription,
    });

    const breadcrumbSchema = buildBreadcrumbSchema({
      brand: aiContent.brand,
      logoName: finalLogoName,
      canonicalUrl,
    });

    const faqSchema = buildFaqSchema(aiContent.faqPairs);

    console.log(`  [schema] imageObject: ${Object.keys(imageObjectSchema).length ? "built" : "empty"} | breadcrumb: built | faq: ${faqSchema.length} question(s)`);

    // ── Step F: save to DB ────────────────────────────────────────────────────
    const logo = await prisma.logo.create({
      data: {
        owner: "admin",
        logoName: finalLogoName,
        slug: finalSlug,
        brand: aiContent.brand,
        website: aiContent.website,
        // Single-element array: just the sub category (or ["template"]).
        // sharedFields.category === "template" is a manual override that
        // forces template regardless of what the classifier picked.
        category: isManualTemplate ? ["template"] : aiContent.category,
        industry: aiContent.industry,
        country: aiContent.country,
        license: sharedFields.license,
        description: aiContent.description,
        tags: aiContent.tags,
        brandColors: sharedFields.brandColors,
        publishStatus: sharedFields.publishStatus,
        downloadCount: sharedFields.downloadCount,
        svgUrl,
        pngUrl,
        webpUrl,
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

        // ── SEO / social ────────────────────────────────────────────────────
        canonicalUrl,
        ogTitle: aiContent.ogTitle,
        ogDescription: aiContent.ogDescription,
        ogImageUrl,
        ogType: "website",
        twitterTitle: aiContent.twitterTitle,
        twitterDescription: aiContent.twitterDescription,
        twitterImage: ogImageUrl,
        twitterCardType: "summary_large_image",

        // ── Schema JSON-LD ───────────────────────────────────────────────────
        imageObjectSchema,
        breadcrumbSchema,
        faqSchema,
      },
    });

    console.log(`  [db] ✓ Saved ID: ${logo.id}`);

    return {
      success: true,
      logoName: finalLogoName,
      slug: finalSlug,
      versioned,
      originalName: rawLogoName,
      category: aiContent.category,
      brand: aiContent.brand,
      website: aiContent.website,
      country: aiContent.country,
      industry: aiContent.industry,
      canonicalUrl,
      ogImageUrl,
      id: logo.id,
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

export async function POST(req) {
  console.log("\n========== SINGLE-FOLDER UPLOAD START ==========");
  const startTime = Date.now();

  try {
    const body = await req.json();
    const {
      key,
      folderName,          // ← ab single folder name aayega
      category = "",
      license = "Educational",
      publishStatus = "Draft",
      downloadCount = "unlimited",
      brandColors = [],
    } = body;

    if (!key || !folderName) {
      return NextResponse.json({ error: "key and folderName both required." }, { status: 400 });
    }

    console.log(`[1] Fetching wrapper ZIP from R2: ${key}, folder: ${folderName}`);

    const obj = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    const wrapperBuffer = Buffer.from(await obj.Body.transformToByteArray());
    const wrapperZip = new AdmZip(wrapperBuffer);
    const allEntries = wrapperZip.getEntries();

    // ── sirf isi folderName ke files nikalo ──────────────────────
    const folderFiles = [];
    for (const entry of allEntries) {
      if (entry.isDirectory) continue;
      const parts = entry.entryName.split("/").filter(Boolean);
      if (parts.length < 2) continue;
      if (parts[0] !== folderName) continue;
      const filename = parts[parts.length - 1];
      if (filename.startsWith(".")) continue;
      folderFiles.push({ filename, buffer: entry.getData() });
    }

    if (folderFiles.length === 0) {
      return NextResponse.json({ error: `No files found in folder "${folderName}".` }, { status: 400 });
    }

    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;

    // NOTE: brand/category no longer resolved from website.categories (DB
    // "sheet") — category comes purely from the LLM classifying the logo
    // NAME against CATEGORY_TAXONOMY_TEXT, and brand/country/industry/
    // website come from a dedicated real-world-knowledge LLM call. See
    // classifyCategory() and resolveBrandCountryIndustryWebsite() above.

    const sharedFields = { category, license, publishStatus, downloadCount, brandColors };

    const result = await processOneLogoFolder({ folderName, folderFiles, sharedFields, watermark });

    await prisma.log.create({
      data: {
        who: "api:bulk-upload-logo",
        content: result.success
          ? `Bulk upload ✓ "${result.logoName}" (slug: ${result.slug})`
          : `Bulk upload ❌ "${result.logoName}": ${result.error}`,
      },
    });

    console.log(`Duration: ${Date.now() - startTime}ms`);
    return NextResponse.json(result);

  } catch (error) {
    console.error("Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}