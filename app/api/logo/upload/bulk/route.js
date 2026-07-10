import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../../../lib/r2";

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

function extractCategoryNames(categoriesJson) {
  if (!categoriesJson) return [];
  let list = categoriesJson;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  return list
    .map((c) => {
      if (typeof c === "string") return { name: c, slug: generateSlugFromName(c) };
      if (c && typeof c === "object" && (c.name || c.title || c.label)) return {
        name: c.name || c.title || c.label || "",
        slug: c.slug || generateSlugFromName(c.name || c.title || c.label || ""),
      };
      return null;
    })
    .filter((c) => c && c.name);
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

// ── Validate AI response against hard rules ───────────────────────────────────
function validateAIContent(parsed, { usedTitles = [], usedOpeners = [] } = {}) {
  const violations = [];

  const fieldsToScan = {
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

  for (const [field, value] of Object.entries(fieldsToScan)) {
    const hit = containsBannedPhrase(value);
    if (hit) violations.push(`${field} contains banned phrase: "${hit}"`);
  }

  if (Array.isArray(parsed.faq)) {
    parsed.faq.forEach((qa, i) => {
      const hit = containsBannedPhrase(qa?.answer);
      if (hit) violations.push(`faq[${i}].answer contains banned phrase: "${hit}"`);
    });
  }

  if (!hasEducationalPhrase(parsed.meta_description))
    violations.push("meta_description missing required educational/reference/research phrase");
  if (!hasEducationalPhrase(parsed.main_description))
    violations.push("main_description missing required educational/reference phrase");
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

  if (parsed.main_description) {
    const opener = String(parsed.main_description).split(/[.!?]/)[0].trim().toLowerCase();
    if (opener && usedOpeners.some((o) => o && o.trim().toLowerCase() === opener)) {
      violations.push("main_description opening sentence duplicates a previous page's opening sentence");
    }
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
      { "@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.cdrlogo.com/" },
      { "@type": "ListItem", "position": 2, "name": brandLabel, "item": `https://www.cdrlogo.com/brand/${brandSlug}/` },
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
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const targetNorm = normalizeName(logoName);
  const exactNormalizedMatches = candidates.filter(
    (c) => normalizeName(c.logoName) === targetNorm
  );

  return { related: candidates.slice(0, 5), exactNormalizedMatches };
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

// ── AI content generation (identical prompt to single-upload) ─────────────────
async function generateAIContent({
  logoName,
  userCategory,
  availableCategories,
  relatedLogos,
  canonicalUrl,
}) {
  const isVariant = relatedLogos.length > 0;

  const STYLE_LETTERS = ["A", "B", "C", "D"];
  const forcedStyle = STYLE_LETTERS[Math.floor(Math.random() * 4)];
  console.log(`  [style] Forced style for this logo: STYLE ${forcedStyle}`);

  const relatedContext = isVariant
    ? relatedLogos
      .slice(0, 5)
      .map(
        (r, i) =>
          `Previous version ${i + 1}:\n- Name: ${r.logoName}\n- Meta Title: ${r.metaTitle || "N/A"}\n- Meta Description: ${r.metaDescription || "N/A"}\n- Description: ${r.description || "N/A"}\n- Tags: ${Array.isArray(r.tags) ? r.tags.join(", ") : "N/A"}`
      )
      .join("\n\n")
    : "";

  const usedOpeners = isVariant
    ? relatedLogos
      .map((r) => (r.description || "").split(/[.!?]/)[0].trim())
      .filter(Boolean)
    : [];

  const hasCategoryList = availableCategories.length > 0;

  // ── System prompt ─────────────────────────────────────────────────────────
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

1. Identify the real-world brand from logo name when confidence is HIGH.

2. Identify official website ONLY if highly confident.

3. Identify real specific industry.

4. Identify country of brand origin.

5. If confidence is LOW (<90%):

brand = ""
website = ""
industry = "Logo Design & Graphics"
country = "Worldwide"

6. NEVER invent fake companies.

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

Note: main_description has ADDITIONAL banned words beyond this global list
— see the "MAIN_DESCRIPTION — ABSOLUTE BANNED WORDS" section in the user
prompt. Both lists apply simultaneously.`;

  // ── User prompt (identical to single-upload) ──────────────────────────────
  const userPrompt = `Generate complete SEO metadata for this logo page.

==================================================
LOGO DETAILS
==================================================

Logo Name     : ${logoName}
Canonical URL : ${canonicalUrl}

${hasCategoryList
      ? `Category: Select UP TO 5 categories from the list below, based strictly on relevancy to this logo's brand/industry name.
- Try to select exactly 5 if there are 5 genuinely relevant matches.
- If fewer than 5 are relevant, select only those that are (do NOT force irrelevant categories).
- If NOT EVEN ONE category from the list is relevant, return exactly ["template"] as the category array.
- Copy category names verbatim from this list — do not modify or invent names:
${availableCategories.map((c) => `- ${c.name}`).join("\n")}`
      : `Category: Use your best classification for this logo's industry.`
    }

Brand   : UNKNOWN — infer real brand if confidently identifiable donot guess.
Website : UNKNOWN
Industry: UNKNOWN — infer specific industry sector

${isVariant ? `
==================================================
VARIANT / UNIQUENESS REQUIREMENT
==================================================

This logo name matches ${relatedLogos.length} existing page(s) on the site.

PREVIOUS PAGES (for reference — DO NOT COPY):

${relatedContext}

PREVIOUSLY USED OPENING SENTENCES (banned — do not reuse):

${usedOpeners.map((o) => `- "${o}"`).join("\n")}

MANDATORY RULES FOR THIS VARIANT:

1. meta_title MUST be textually different from every previous Meta Title listed above.
2. meta_description MUST use different sentence structure and different educational/reference phrasing.
3. main_description's first sentence MUST open differently from every sentence listed above.
4. og_title, og_description, twitter_title, twitter_description must each differ in wording from previous fields.
5. tags: keep core brand/format tags but vary the 4 context-specific tags.
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

STRICTLY FORBIDDEN: Free, Download, Free Download

--------------------------------------------------
meta_description (140–155 chars HARD LIMIT)
--------------------------------------------------

Must contain brand name.
Must contain minimum 3 of: PNG, SVG, Vector, AI.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational use" OR "reference use" OR "research purposes"

STRICTLY FORBIDDEN: commercial projects, business use, branding needs, marketing language

--------------------------------------------------
⚠️ MAIN_DESCRIPTION — ABSOLUTE BANNED WORDS (HIGHEST PRIORITY)
==================================================

STYLE ASSIGNMENT FOR THIS LOGO MAIN_DESCRIPTION  — MANDATORY
==================================================

This logo has been externally assigned: STYLE ${forcedStyle}

This assignment is NOT your choice — it was randomly generated in code to
guarantee stylistic variation across the entire site. You MUST write
main_description using STYLE ${forcedStyle} below. Do NOT use any other
style. Do NOT blend multiple styles together. Do NOT default to the style
that "feels most natural" — use STYLE ${forcedStyle}, exactly as described.

STYLE A — Format-first:
Start with the file formats as the subject.
Example: "PNG, SVG, AI, and CDR files of the [Logo Name]
are archived here as scalable vector assets for reference use."

STYLE B — Brand-first (requires confirmed brand, industry, AND country):
Start with the brand as the subject.
Example: "[Brand], a [industry] company from [country],
is represented here through its [Logo Name], archived
in PNG, SVG, AI, and CDR scalable vector formats."

STYLE C — Archive-purpose-first:
Start with the archive purpose as the subject.
Example: "This entry documents the [Logo Name] for
research and educational reference, available in PNG,
SVG, AI, and CDR vector file formats."

STYLE D — Industry-context-first (requires confirmed industry AND country):
Start with the industry as the subject.
Example: "Within the [industry] sector, the [Logo Name]
is preserved here as scalable vector artwork in PNG,
SVG, AI, and CDR formats for educational study."

FALLBACK RULE (applies ONLY if the assigned style is STYLE B or STYLE D):
STYLE B and STYLE D require a confidently identified brand, industry, AND
country for THIS specific logo. If you cannot confidently identify these,
fall back to STYLE A instead. Do NOT fabricate brand, industry, or country
details just to force-fit STYLE ${forcedStyle}.

REGARDLESS OF STYLE:
1. Never reuse the same paragraph structure or sentence order as any
   previous page for this logo (see PREVIOUS PAGES above, if applicable).
2. Do not swap synonyms (presented/features/offers/provides) while keeping
   the same sentence skeleton — that still counts as a repeated template.
3. Vary WHERE brand context, format list, and educational phrase appear
   within the sentence.

==================================================

The following words/phrases are BANNED from main_description with ZERO
exceptions. This rule overrides every other instruction in this prompt,
including style, tone, and word-count guidance. If a banned word would
naturally fit the sentence, REWRITE the sentence instead of using it.

BANNED LIST:
Free Download, High Quality, High Resolution, Best Logo, Premium,
Amazing, Beautiful, Professional Design, Modern red/blue/green
(or any color/style description), Click here, Download now,
100% free, No copyright, HD logo, World best, Top quality,
Marketing/promotional language of any kind.

SELF-CHECK BEFORE RETURNING main_description:
Re-read the sentence you wrote. If ANY word above appears — even as
part of a larger phrase, even with different capitalization — DELETE
it and rewrite that sentence completely. Do not just swap the banned
word for a synonym while keeping the same sentence structure.

Must naturally contain ONE of:

* vector format
* scalable vector
* vector artwork
* vector assets
* vector files

Must naturally contain ONE of:

* educational use
* reference use
* archival reference
* design study
* research reference

Cover:

* brand background (if known)
* industry (if known)
* available formats (PNG, SVG, AI, CDR)

Word count:
45–100 words.


--------------------------------------------------
alt_text (LOCKED FORMAT)
--------------------------------------------------

Return EXACTLY: "{Brand} logo — PNG SVG vector file on cdrlogo.com"
DO NOT DEVIATE. DO NOT ADD WORDS.

--------------------------------------------------
tags (12–15 items, array of strings)
--------------------------------------------------

Must include: brand name, logo, PNG, SVG, vector, cdrlogo.com, industry term.
Add 4 context-specific tags based on industry.

--------------------------------------------------
og_title (50–60 chars)
--------------------------------------------------

Format: "{Logo Name} — PNG SVG vector file on cdrlogo.com"
Use the EXACT FULL Logo Name — every distinguishing word MUST appear. No "| cdrlogo.com" suffix.
STRICTLY FORBIDDEN: Free, Download, marketing phrases.

--------------------------------------------------
og_description (120–160 chars)
--------------------------------------------------

Must sound like a DIGITAL ARCHIVE — never an advertisement.
Must contain brand name and minimum 2 of: PNG, SVG, Vector, AI, CDR.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research purposes" OR "reference use"
STRICTLY FORBIDDEN: Perfect for, for your projects, commercial language, marketing language.

--------------------------------------------------
twitter_title (50–60 chars)
--------------------------------------------------

Brand mandatory. At least one of: PNG, SVG, Vector.
STRICTLY FORBIDDEN: Free, Download.

--------------------------------------------------
twitter_description (100–140 chars)
--------------------------------------------------

Must contain brand name and minimum 2 of: PNG, SVG, Vector.
Must contain AT LEAST ONE EXACT PHRASE:
  "educational reference" OR "research use" OR "reference use"
STRICTLY FORBIDDEN: Perfect for, for your projects, branding use, commercial wording.

--------------------------------------------------
image_object_description (15–25 words)
--------------------------------------------------

Short, literal description of the image file itself for schema.org/ImageObject.
Must mention: brand name, at least one of: logo / image / file.
STRICTLY FORBIDDEN: Free, Download, marketing language.

--------------------------------------------------
faq (EXACTLY 3 Q&A PAIRS)
--------------------------------------------------

Allowed question topics ONLY:
- What formats is this logo available in
- Can I use this logo for educational purposes?
- Is this logo available in vector format?

Answers must be factual, 1–2 sentences, educational/reference tone.
NEVER use: Free, Download, commercial wording.

Return as array: [{ "question": "...", "answer": "..." }, ...]

--------------------------------------------------
FINAL OUTPUT FIELDS
--------------------------------------------------

brand_used, website_used, industry_used, country_used
===========================================
==================================================
FINAL SELF VALIDATION
==================================================

BEFORE RETURNING: Scan ALL fields. If ANY banned word found OR
educational phrase missing from meta_description / og_description /
twitter_description / main_description — REGENERATE internally.

Return ONLY VALID JSON:

{
  "category": ["...", "...", "...", "...", "..."],
  "brand_used": "...",
  "website_used": "...",
  "country_used": "...",
  "industry_used": "...",
  "meta_title": "...",
  "meta_description": "...",
  "main_description": "...",
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

  const completion = await callOpenAIWithRetry({
    model: "gpt-4.1-mini",
    temperature: 0.6,
    messages,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }




  // ── Server-side compliance check ──────────────────────────────────────────
  //   const usedTitles = relatedLogos.map((r) => r.metaTitle).filter(Boolean);
  //   const violations = validateAIContent(parsed, { usedTitles, usedOpeners });

  //   if (violations.length) {
  //     console.warn(`  [AI Validation] ${violations.length} violation(s) found, re-calling OpenAI once:`);
  //     violations.forEach((v) => console.warn(`       - ${v}`));

  //     const correctionPrompt = `Your previous JSON response violated these rules:

  // ${violations.map((v) => `- ${v}`).join("\n")}

  // Regenerate the COMPLETE JSON response, fixing every violation above. Do not
  // repeat the same mistakes. Re-check every field against the banned-words list
  // and the educational/reference phrase requirement before returning. Return
  // ONLY the corrected JSON object, with the same structure as before.`;

  //     const retryCompletion = await callOpenAIWithRetry({
  //       model: "gpt-4.1-mini",
  //       temperature: 0.5,
  //       messages: [
  //         ...messages,
  //         { role: "assistant", content: raw },
  //         { role: "user", content: correctionPrompt },
  //       ],
  //       response_format: { type: "json_object" },
  //     });

  //     const retryRaw = retryCompletion.choices[0]?.message?.content || "{}";
  //     let retryParsed;
  //     try { retryParsed = JSON.parse(retryRaw); } catch { retryParsed = null; }

  //     if (retryParsed) {
  //       const retryViolations = validateAIContent(retryParsed, { usedTitles, usedOpeners });
  //       console.log(`  [AI Validation] Retry result: ${retryViolations.length ? `${retryViolations.length} violation(s) remain` : "clean"}`);
  //       parsed = retryParsed;
  //     } else {
  //       console.warn("  [AI Validation] Retry response failed to parse — keeping original");
  //     }
  //   } else {
  //     console.log("  [AI Validation] ✓ No violations found on first attempt");
  //   }




  // ── Resolve category ──────────────────────────────────────────────────────
  let rawCategories = parsed.category;
  if (typeof rawCategories === "string") rawCategories = [rawCategories];
  if (!Array.isArray(rawCategories)) rawCategories = [];

  let resolvedCategories = [];
  if (hasCategoryList) {
    for (const cat of rawCategories) {
      const match = availableCategories.find(
        (c) => c.name.toLowerCase() === String(cat).trim().toLowerCase()
      );
      if (match) resolvedCategories.push(match.name);
    }
    resolvedCategories = resolvedCategories.slice(0, 5);
    if (resolvedCategories.length === 0) resolvedCategories = ["template"];
  } else {
    resolvedCategories = rawCategories.slice(0, 5).map(String).filter(Boolean);
  }

  // ...


  // ── Resolve brand / country / industry / website ──────────────────────────
  const brand = (parsed.brand_used && String(parsed.brand_used).trim()) || "";
  const country = (parsed.country_used && String(parsed.country_used).trim()) || "Worldwide";
  const industry = (parsed.industry_used && String(parsed.industry_used).trim()) || "Logo Design & Graphics";
  const website = (parsed.website_used && String(parsed.website_used).trim()) || "";

  // ── Field fallbacks (educational-tone, banned-word-free) ─────────────────
  const metaTitle = parsed.meta_title ||
    `${logoName} — PNG SVG vector file on cdrlogo.com`;
  const metaDescription = parsed.meta_description ||
    `${logoName}  available in PNG, SVG and vector format for educational use and research purposes. Reference archive on cdrlogo.com.`;
  const description = parsed.main_description ||
    `The ${logoName}  is available in PNG, SVG, AI and CDR vector formats and high resolution, provided on cdrlogo.com for educational use and reference purposes.`;
  const altText = parsed.alt_text ||
    `${logoName} — PNG SVG vector file on cdrlogo.com`;
  const tags = Array.isArray(parsed.tags) && parsed.tags.length
    ? parsed.tags
    : [logoName, "PNG", "SVG", "vector", "cdrlogo.com"];

  const ogTitle = (parsed.og_title && String(parsed.og_title).trim()) ||
    `${logoName} — PNG & SVG Vector`;
  const ogDescription = parsed.og_description ||
    `${logoName} available in PNG and SVG vector format for educational reference and research purposes.`;
  const twitterTitle = (parsed.twitter_title && String(parsed.twitter_title).trim()) ||
    `${logoName} — PNG SVG Vector`;
  const twitterDescription = (parsed.twitter_description && String(parsed.twitter_description).trim()) ||
    `${logoName} in PNG and SVG vector format for educational reference and research use.`;
  const imageObjectDescription = parsed.image_object_description ||
    `${logoName} image on cdrlogo.com`;
  const faqPairs = Array.isArray(parsed.faq) ? parsed.faq : [];



  return {
    category: resolvedCategories,
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
    relatedSlugs: relatedLogos.map((r) => r.slug).filter(Boolean),
  };
}

// ── Process one logo folder ───────────────────────────────────────────────────
async function processOneLogoFolder({ folderName, folderFiles, sharedFields, watermark }) {
  const rawLogoName = logoNameFromFolderName(folderName);
  console.log(`\n  ── Processing folder: "${folderName}" → "${rawLogoName}"`);

  try {
    // ── Step A: resolve final name & slug (auto-versioning) ──────────────────
    const { related, exactNormalizedMatches } = await findRelatedLogos(rawLogoName);

    let finalLogoName = rawLogoName;
    let versioned = false;

    if (exactNormalizedMatches.length > 0) {
      finalLogoName = generateVersionedName(rawLogoName, exactNormalizedMatches);
      versioned = true;
      console.log(`  [name] Auto-versioned: "${rawLogoName}" → "${finalLogoName}"`);
    }

    const finalSlug = generateSlugFromName(finalLogoName);
    const canonicalUrl = `https://www.cdrlogo.com/logo/${finalSlug}/`;
    console.log(`  [slug] ${finalSlug}`);

    // ── Step B: AI content generation ────────────────────────────────────────
    const aiContent = await generateAIContent({
      logoName: finalLogoName,
      userCategory: sharedFields.category,
      availableCategories: sharedFields.availableCategories,
      relatedLogos: related,
      canonicalUrl,
    });

    console.log(`  [ai] category: "${aiContent.category}" | brand: "${aiContent.brand}" | website: "${aiContent.website || "(none)"}" | country: "${aiContent.country}" | industry: "${aiContent.industry}"`);
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
        category: sharedFields.category.toLowerCase().trim() === "template"
          ? ["template"]
          : Array.isArray(aiContent.category) && aiContent.category.length > 0
            ? aiContent.category
            : ["template"],
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
    const availableCategories = category.toLowerCase().trim() === "template"
      ? []
      : extractCategoryNames(websiteRecord?.categories);

    const sharedFields = { category, license, publishStatus, downloadCount, brandColors, availableCategories };

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