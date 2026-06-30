import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";

let openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// ── mime helpers ──────────────────────────────────────────────────────────────
let MIME = {
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
  let lastDot = filename.lastIndexOf(".");
  let name = lastDot !== -1 ? filename.slice(0, lastDot) : filename;
  let extension = lastDot !== -1 ? filename.slice(lastDot) : "";

  let cleanName = name
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

// ── Per-char advance-width table for Arial Bold (em units at 1000 UPM) ───────
let ARIAL_BOLD_W = {
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
let FALLBACK_W = 0.62;

function measureText(text, fontSize) {
  let w = 0;
  for (let ch of text) w += (ARIAL_BOLD_W[ch] ?? FALLBACK_W) * fontSize;
  return Math.ceil(w);
}

// ── Pixel-perfect watermark ───────────────────────────────────────────────────
async function applyWatermark(buffer, wm) {
  if (!wm?.enabled || !wm?.text?.trim()) return buffer;

  let meta = await sharp(buffer).metadata();
  let W = meta.width;
  let H = meta.height;

  let fontSize = Math.max(1, wm.fontSize ?? Math.floor(W * 0.04));
  let opacity = Math.min(1, Math.max(0, (wm.opacity ?? 30) / 100));
  let color = wm.color || "#ffffff";
  let position = wm.position || "center";

  let textW = measureText(wm.text, fontSize);
  let textH = Math.ceil(fontSize * 1.15);

  let pad = Math.max(8, Math.floor(Math.min(W, H) * 0.015));

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

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <text
    x="${tx}"
    y="${ty}"
    text-anchor="start"
    dominant-baseline="hanging"
    font-size="${fontSize}"
    font-weight="bold"
    font-family="Arial, sans-serif"
    fill="${color}"
    opacity="${opacity.toFixed(4)}"
    letter-spacing="0"
  >${escapeXml(wm.text)}</text>
</svg>`;

  return sharp(buffer)
    .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
    .toBuffer();
}

// ── file size formatter ────────────────────────────────────────────────────────
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

// ── Generate slug from logo name ─────────────────────────────────────────────
function generateSlugFromName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

// ── Normalize a logo name for fuzzy comparison ────────────────────────────────
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\bversion\s*\d+\b/g, "")
    .replace(/\bv\.?\s*\d+\b/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ── Extract significant words for DB pre-filtering ───────────────────────────
function getSignificantWords(name) {
  let stop = new Set(["logo", "version", "the", "and", "of", "new", "old"]);
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter(w => w && !stop.has(w) && !/^v\.?\d+$/.test(w) && !/^\d+$/.test(w));
}

// ── Find related logos by fuzzy/normalized name match ────────────────────────
async function findRelatedLogos(logoName) {
  let words = getSignificantWords(logoName);
  if (!words.length) return { related: [], exactNormalizedMatches: [] };

  let candidates = await prisma.logo.findMany({
    where: {
      OR: words.map(w => ({ logoName: { contains: w, mode: "insensitive" } })),
    },
    select: {
      logoName: true,
      metaTitle: true,
      metaDescription: true,
      description: true,
      tags: true,
      category: true,
      brand: true,
      slug: true,
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  let targetNorm = normalizeName(logoName);
  let exactNormalizedMatches = candidates.filter(
    c => normalizeName(c.logoName) === targetNorm
  );
  let related = candidates.slice(0, 5);

  return { related, exactNormalizedMatches };
}

// ── Generate next version name ────────────────────────────────────────────────
function generateVersionedName(logoName, exactNormalizedMatches) {
  let usedVersions = new Set();

  for (let match of exactNormalizedMatches) {
    let m = match.logoName.match(/\bv(?:ersion)?\.?\s*(\d+)\b/i);
    if (m) {
      usedVersions.add(parseInt(m[1], 10));
    } else {
      usedVersions.add(1);
    }
  }

  let next = 1;
  while (usedVersions.has(next)) next++;
  if (next === 1 && usedVersions.has(1)) next = 2;

  let cleanBase = logoName
    .replace(/\b(19|20)\d{2}\b/g, "")
    .replace(/\bversion\s*\d+\b/gi, "")
    .replace(/\bv\.?\s*\d+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  return `${cleanBase} V${next}`;
}

// ── OpenAI call with 1 retry ──────────────────────────────────────────────────
async function callOpenAIWithRetry(params, retries = 1) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await openai.chat.completions.create(params);
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[OpenAI] Attempt ${attempt + 1} failed, retrying...`);
      await new Promise(r => setTimeout(r, 1000));
    }
  }
}

// ── Banned words/phrases — checked in code, not just trusted to the LLM ─────
// These mirror the prompt's banned-word lists. Server-side enforcement exists
// because the LLM's own "self validation" step is not reliable — it can and
// does ship banned phrases despite being told not to.
let BANNED_PHRASES = [
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

let EDUCATIONAL_PHRASES = [
  "educational use",
  "educational reference",
  "reference use",
  "research purposes",
  "research use",
  "design reference",
];

function containsBannedPhrase(text) {
  if (!text) return null;
  let lower = String(text).toLowerCase();
  for (let phrase of BANNED_PHRASES) {
    if (lower.includes(phrase)) return phrase;
  }
  return null;
}

function hasEducationalPhrase(text) {
  if (!text) return false;
  let lower = String(text).toLowerCase();
  return EDUCATIONAL_PHRASES.some(p => lower.includes(p));
}

// ── Validate a parsed AI response against the hard rules ────────────────────
// Returns an array of human-readable violation strings (empty = compliant).
// usedTitles/usedDescriptions are previous pages' exact field values — used
// to catch verbatim or near-verbatim duplicate titles across versions.
function validateAIContent(parsed, { usedTitles = [], usedOpeners = [] } = {}) {
  let violations = [];

  let fieldsToScanForBannedWords = {
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

  for (let [field, value] of Object.entries(fieldsToScanForBannedWords)) {
    let hit = containsBannedPhrase(value);
    if (hit) violations.push(`${field} contains banned phrase: "${hit}"`);
  }

  if (Array.isArray(parsed.faq)) {
    parsed.faq.forEach((qa, i) => {
      let hit = containsBannedPhrase(qa?.answer);
      if (hit) violations.push(`faq[${i}].answer contains banned phrase: "${hit}"`);
    });
  }

  if (!hasEducationalPhrase(parsed.meta_description)) {
    violations.push("meta_description missing required educational/reference/research phrase");
  }
  if (!hasEducationalPhrase(parsed.main_description)) {
    violations.push("main_description missing required educational/reference phrase");
  }
  if (!hasEducationalPhrase(parsed.og_description)) {
    violations.push("og_description missing required educational/reference phrase");
  }
  if (!hasEducationalPhrase(parsed.twitter_description)) {
    violations.push("twitter_description missing required educational/reference phrase");
  }

  // ── Duplicate-title check against prior pages for this same logo/version ─
  if (parsed.meta_title && usedTitles.some(t => t && t.trim().toLowerCase() === String(parsed.meta_title).trim().toLowerCase())) {
    violations.push("meta_title is identical to a previous page's meta_title");
  }
  if (parsed.main_description) {
    let opener = String(parsed.main_description).split(/[.!?]/)[0].trim().toLowerCase();
    if (opener && usedOpeners.some(o => o && o.trim().toLowerCase() === opener)) {
      violations.push("main_description opening sentence duplicates a previous page's opening sentence");
    }
  }

  return violations;
}

// ── Build BreadcrumbList schema in code (reliable URLs) ──────────────────────
// Home > Brand > Logo Name
function buildBreadcrumbSchema({ brand, logoName, canonicalUrl }) {
  let brandLabel = (brand && brand.trim()) ? brand.trim() : "Logos";
  let brandSlug = generateSlugFromName(brandLabel);

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "name": "Home",
        "item": "https://www.cdrlogo.com/",
      },
      {
        "@type": "ListItem",
        "position": 2,
        "name": brandLabel,
        "item": `https://www.cdrlogo.com/brand/${brandSlug}/`,
      },
      {
        "@type": "ListItem",
        "position": 3,
        "name": logoName,
        "item": canonicalUrl,
      },
    ],
  };
}

// ── Build ImageObject schema (static parts in code, description from LLM) ───
function buildImageObjectSchema({ imageUrl, logoName, brand, canonicalUrl, description }) {
  if (!imageUrl) return {};
  return {
    "@context": "https://schema.org",
    "@type": "ImageObject",
    "contentUrl": imageUrl,
    "url": imageUrl,
    "name": `${logoName} Logo`,
    "description": description || `${logoName} logo image on cdrlogo.com`,
    "representativeOfPage": true,
    ...(brand ? { "creator": { "@type": "Organization", "name": brand } } : {}),
    "mainEntityOfPage": canonicalUrl,
  };
}

// ── Build FAQ schema from LLM-generated Q&A pairs ────────────────────────────
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

// ── OpenAI: generate SEO content + tags + full OG/Twitter fields ─────────────
async function generateAIContent({
  logoName, brand, website, category, industry, country, relatedLogos, canonicalUrl,
}) {
  let isVariant = relatedLogos.length > 0;

  let relatedContext = isVariant
    ? relatedLogos
      .slice(0, 5)
      .map(
        (r, i) =>
          `Previous version ${i + 1}:\n- Name: ${r.logoName}\n- Meta Title: ${r.metaTitle || "N/A"}\n- Meta Description: ${r.metaDescription || "N/A"}\n- Description: ${r.description || "N/A"}\n- Tags: ${Array.isArray(r.tags) ? r.tags.join(", ") : "N/A"}`
      )
      .join("\n\n")
    : "";

  let usedOpeners = isVariant
    ? relatedLogos
      .map(r => (r.description || "").split(/[.!?]/)[0].trim())
      .filter(Boolean)
    : [];

  // Brand, website, industry: LLM always decides from logo name.
  // Form-submitted values are hints only — passed as context, not forced.
  let providedBrand = (brand && brand.trim()) ? brand.trim() : "";
  let providedWebsite = (website && website.trim()) ? website.trim() : "";
  let providedIndustry = (industry && industry.trim()) ? industry.trim() : "";
  let resolvedCountry = (country && country.trim()) ? country.trim() : "";

  // ── SYSTEM PROMPT ─────────────────────────────────────────────

  let systemPrompt = `You are a senior SEO specialist generating metadata for cdrlogo.com, a professional logo reference archive website.

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

2. Identify official website ONLY if highly confident otherwise blank .

3. Identify real specific industry.

4. Identify country of brand origin.

5. If confidence is LOW (<90%):

brand = "cdrlogo.com"
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
No commentary.`;


  ///////////////////////////////////////////////////////////////
  // USER PROMPT
  ///////////////////////////////////////////////////////////////

  let userPrompt = `Generate complete SEO metadata for this logo page.

==================================================
LOGO DETAILS
==================================================

Logo Name : ${logoName}

${providedBrand
      ? `Brand : ${providedBrand} (verify independently)`
      : `Brand : UNKNOWN — infer real brand if confidently identifiable`
    }

${providedWebsite
      ? `Website : ${providedWebsite} (verify independently)`
      : `Website : UNKNOWN`
    }

Category : ${category || "Logo"}

${providedIndustry
      ? `Industry : ${providedIndustry} (verify independently)`
      : `Industry : UNKNOWN`
    }

${resolvedCountry ? `Country : ${resolvedCountry}` : ""}

Canonical URL : ${canonicalUrl}

${isVariant ? `
==================================================
VARIANT / UNIQUENESS REQUIREMENT
==================================================

This logo name matches ${relatedLogos.length} existing page(s) on the site
(same brand, same base name, or an earlier version/upload of the same logo).

PREVIOUS PAGES (for reference — DO NOT COPY):

${relatedContext}

PREVIOUSLY USED OPENING SENTENCES (banned — do not reuse or closely
paraphrase any of these as the first sentence of main_description):

${usedOpeners.map(o => `- "${o}"`).join("\n")}

MANDATORY RULES FOR THIS VARIANT:

1. meta_title MUST be textually different from every previous Meta Title
   listed above — not just reordered words. Use a different descriptive
   angle (e.g. reference a distinguishing visual trait, color, or file
   variant if known) instead of the generic "{Brand} Logo PNG SVG Vector"
   pattern if that exact phrase was already used.
2. meta_description MUST use different sentence structure and different
   educational/reference phrasing than every previous Meta Description above.
3. main_description's first sentence MUST open differently from every
   sentence listed under PREVIOUSLY USED OPENING SENTENCES.
4. og_title, og_description, twitter_title, twitter_description must each
   differ in wording from the corresponding previous fields above.
5. tags: keep core brand/format tags but vary the 4 context-specific tags.
6. If you cannot find a distinguishing real-world detail, vary the sentence
   structure and word order rather than reusing the same template — never
   submit a title or description identical or near-identical to one above.
` : ""}

==================================================
FIELD RULES
==================================================


--------------------------------------------------
meta_title
(50–60 chars HARD LIMIT)
--------------------------------------------------

Format:

"{Logo Name} Logo PNG SVG Vector | cdrlogo.com"

MANDATORY RULES:

1. Use the EXACT FULL Logo Name as given (e.g. "Apple Clip Blue Logo PNG SVG
   Vector | cdrlogo.com") — NOT the brand name alone. Every distinguishing
   word in the logo name (color, style, variant, version) MUST appear.

2. This title MUST be textually different from every meta_title listed in
   PREVIOUS PAGES above — not just reordered words. Use a different
   descriptive angle or include a distinguishing trait from the logo name
   that the previous title did not use.

3. Must include minimum TWO of: PNG, SVG, Vector.

4. If the generated title would be identical or near-identical to a previous
   page's meta_title, add a distinguishing qualifier (color, file variant,
   edition) rather than reusing the same template.

STRICTLY FORBIDDEN:

Free
Download
Free Download

If too long: abbreviate automatically.

INVALID if forbidden words appear.
INVALID if title duplicates a previous page's meta_title.

--------------------------------------------------
meta_description
(140–155 chars HARD LIMIT)
--------------------------------------------------

MANDATORY REQUIREMENTS:

Must contain brand name.

Must contain minimum 3:

PNG
SVG
Vector
AI
Must contain AT LEAST ONE EXACT PHRASE:

educational use

OR

reference use

OR

research purposes

Allowed patterns (vary naturally):

Pattern A:

"[Brand] logo available in PNG, SVG, and vector format for educational use and research purposes. Reference archive on cdrlogo.com."

Pattern B:

"Access [Brand] logo files in PNG, SVG, and vector format for educational reference and logo research on cdrlogo.com."

Pattern C:

"Explore [Brand] logo resources in PNG, SVG, and vector format for research purposes at cdrlogo.com."

INVALID if educational/reference wording missing.


--------------------------------------------------
main_description
(120–155 words)
--------------------------------------------------

Sentence 1 MUST mention:

PNG OR SVG OR Vector.

Must naturally include ALL:

vector format
high resolution

Must contain:

educational use

OR

reference use

Content should cover:

- what brand represents
- company background
- industry
- available formats:
  PNG
  SVG
  AI
  CDR

STRICTLY FORBIDDEN:

Free
Download
Marketing language
Commercial wording
Promotional wording

DO NOT describe:

colors
visual style
logo design elements


--------------------------------------------------
alt_text
(LOCKED FORMAT)
--------------------------------------------------

Return EXACTLY this:

"{Brand} logo — PNG SVG vector file on cdrlogo.com"

Rules:

DO NOT CHANGE FORMAT.

DO NOT ADD WORDS.

STRICTLY FORBIDDEN:

Free
Download
CTA language
SEO wording
Get it now"

INVALID if modified.

--------------------------------------------------
tags
(12–15 array items)
--------------------------------------------------

Must include:

brand name
logo
PNG
SVG
vector
cdrlogo.com

Use:

8 fixed SEO tags

PLUS

4 context-specific tags based on industry.

Example:

Nike:

sportswear logo
athletic apparel
shoe brand

Tesla:

electric vehicle logo
automotive company
EV brand

Avoid identical tag arrays across pages.


--------------------------------------------------
og_title
(50–60 chars)
--------------------------------------------------

Format:

"{Logo Name} Logo — PNG & SVG Vector"

MANDATORY RULES:

1. Use the EXACT FULL Logo Name as given (e.g. "Apple Clip Blue"), NOT the
   brand name alone (e.g. NOT "Apple Logo — PNG & SVG Vector"). Every
   distinguishing word (color, style, version) MUST appear.

2. Must be textually different from every og_title of previous pages above.

3. Social friendly. No cdrlogo.com suffix.

STRICTLY FORBIDDEN anywhere in this field:

Free
Download
Perfect for
For your projects
For your brand
For digital and print projects
Ideal for
Great for
Cutting-edge
Innovative
Stunning
Any marketing or commercial wording

INVALID if full logo name is not used.
INVALID if a previous page's og_title is duplicated.

--------------------------------------------------
og_description
(120–160 chars)
--------------------------------------------------

MANDATORY RULES:

1. Must sound like a DIGITAL ARCHIVE — NEVER an advertisement or product page.

2. Must contain the brand name.

3. Must contain minimum 2 of: PNG, SVG, Vector, AI, CDR.

4. Must contain AT LEAST ONE EXACT PHRASE:
   "educational reference"
   OR "research purposes"
   OR "reference use"

5. Must NOT contain any banned phrase from the global list.

Approved patterns (vary wording naturally):

Pattern A:
"[Brand] logo available in PNG, SVG and vector format for educational
reference and research purposes at cdrlogo.com."

Pattern B:
"Access the [Logo Name] logo in PNG and SVG vector format — educational
reference archive at cdrlogo.com."

Pattern C:
"Explore [Logo Name] logo files in SVG vector and PNG format for design
research and educational reference at cdrlogo.com."

STRICTLY FORBIDDEN anywhere in this field:

Perfect for
For your projects
For your brand
For digital and print projects
Creative and branding needs
Commercial projects
Business use
Marketing materials
Elevate your brand
Cutting-edge
Innovative
Stunning
Any marketing, commercial or promotional wording

INVALID if educational/reference phrase is missing.
INVALID if commercial tone appears.
INVALID if banned phrase appears.

--------------------------------------------------
twitter_title
(50–60 chars)
--------------------------------------------------

Rules:

Brand mandatory.

At least one:

PNG
SVG
Vector

STRICTLY FORBIDDEN:

Free
Download


---------------------------------------------------
twitter_description
(100–140 chars)
--------------------------------------------------

MANDATORY RULES:

1. Must contain the brand name.

2. Must contain minimum 2 of: PNG, SVG, Vector

3. Must contain AT LEAST ONE EXACT PHRASE:
   "educational reference"
   OR "research use"
   OR "reference use"

4. Must NOT contain any banned phrase from the global list.

Approved patterns (vary wording naturally):

Pattern A:
"[Brand] logo in PNG  and SVG vector format for educational
reference and research use."

Pattern B:
"[Logo Name] logo — SVG vector and PNG format for educational reference
at cdrlogo.com."

Pattern C:
"Explore [Logo Name] in SVG vector and PNG for educational
archive reference."

ABSOLUTELY FORBIDDEN anywhere in this field:

Perfect for
For your projects
For digital and print projects
For your brand
Great for
Ideal for
Best for
Get it now
Free Download
Useful for creators
Suitable for projects
Creative work
Branding use
Design work
Business use
Marketing use
Commercial projects
Cutting-edge
Innovative
Stunning

INVALID if educational/reference phrase is missing.
INVALID if any banned phrase appears.


--------------------------------------------------
image_object_description
(15–25 words)
--------------------------------------------------

Short, literal description of the image file itself
(what schema.org/ImageObject "description" should say).

Must mention:

Brand name
At least one of: logo / image / file

STRICTLY FORBIDDEN:

Free
Download
Marketing language


--------------------------------------------------
faq
(EXACTLY 3 Q&A PAIRS)
--------------------------------------------------

Generate exactly 3 question/answer pairs about
format / download / usage only.

Allowed question topics ONLY:

- What formats is this logo available in?
- Can I use this logo for educational purposes?
- Is this logo available in SVG format?

Answers must:

- be factual, 1–2 sentences
- reference only formats relevant to this logo
- maintain educational/reference tone
- NEVER use: Free, Download, commercial wording

Return as array of objects:

[
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." },
  { "question": "...", "answer": "..." }
]


--------------------------------------------------
FINAL OUTPUT FIELDS
--------------------------------------------------

brand_used
website_used
industry_used
country_used


==================================================
FINAL SELF VALIDATION
==================================================

BEFORE RETURNING:

Scan ALL generated fields.

If ANY field contains ANY banned word:

Free
Download
Perfect for
Branding needs
Commercial projects
Creative work
Business use
Marketing use

OR

meta_description missing:

educational use
reference use
research purposes

OR

og_description sounds commercial

OR

alt_text format changed

OR

twitter_description contains filler language

OR

faq has more or fewer than 3 items

OR

faq covers topics outside format/download/usage

THEN:

DO NOT RETURN.

REGENERATE internally.


GOOGLE SAFETY RULES
==================================================

* Every page must help users — not just rank.
* No scaled-content abuse patterns.
* No thin or duplicate content.
* Vary description structure across pages.
* Accuracy over verbosity — keep it concise.
==============================================
FINAL ZERO TOLERANCE VALIDATION

Reject output instantly if ANY field contains:

free download
get it now
access
explore
discover
grab
perfect for
ideal for
great for
best for
for your projects
branding needs
creative needs
marketing use
commercial use
business use
professional use

Descriptions MUST sound like:

digital archive
reference library
educational catalog
logo archive

Descriptions MUST NOT sound like:

product advertisement
commercial promotion
marketing copy

If violation found → regenerate before returning JSON.
==================================================
RETURN JSON ONLY
==================================================

{
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
  ],
  "brand_used": "...",
  "website_used": "...",
  "industry_used": "...",
  "country_used": "..."
}`;

  let messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ];

  let completion = await callOpenAIWithRetry({
    model: "gpt-4.1-mini",
    temperature: 0.6,
    messages,
    response_format: { type: "json_object" },
  });

  let raw = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = {}; }

  // ── Server-side compliance check — do not trust the LLM's self-validation ─
  // Previous titles/openers (for duplicate detection across versions) come
  // from the same relatedLogos data already passed in for variant context.
  let usedTitles = relatedLogos.map(r => r.metaTitle).filter(Boolean);
  let violations = validateAIContent(parsed, { usedTitles, usedOpeners });

  if (violations.length) {
    console.warn(`[AI Validation] ${violations.length} violation(s) found, re-calling OpenAI once:`);
    violations.forEach(v => console.warn(`     - ${v}`));

    let correctionPrompt = `Your previous JSON response violated these rules:

${violations.map(v => `- ${v}`).join("\n")}

Regenerate the COMPLETE JSON response, fixing every violation above. Do not
repeat the same mistakes. Re-check every field against the banned-words list
and the educational/reference phrase requirement before returning. Return
ONLY the corrected JSON object, with the same structure as before.`;

    let retryCompletion = await callOpenAIWithRetry({
      model: "gpt-4.1-mini",
      temperature: 0.5,
      messages: [
        ...messages,
        { role: "assistant", content: raw },
        { role: "user", content: correctionPrompt },
      ],
      response_format: { type: "json_object" },
    });

    let retryRaw = retryCompletion.choices[0]?.message?.content || "{}";
    let retryParsed;
    try { retryParsed = JSON.parse(retryRaw); } catch { retryParsed = null; }

    if (retryParsed) {
      let retryViolations = validateAIContent(retryParsed, { usedTitles, usedOpeners });
      console.log(`[AI Validation] Retry result: ${retryViolations.length ? `${retryViolations.length} violation(s) remain` : "clean"}`);
      // Per spec: call the LLM again no more than once. Whatever comes back
      // from this single retry is accepted as final — we don't loop further.
      parsed = retryParsed;
    } else {
      console.warn("[AI Validation] Retry response failed to parse — keeping original response");
    }
  } else {
    console.log("[AI Validation] ✓ No violations found on first attempt");
  }

  // ── Defensive fallbacks — LLM rules but we never ship empty strings ───────
  // NOTE: these fallback strings only fire if the LLM call/parse fails
  // entirely (e.g. JSON.parse threw and parsed === {}). They must themselves
  // be banned-word-free, since they can end up shipped as-is.
  let resolvedBrand = (parsed.brand_used && String(parsed.brand_used).trim()) || providedBrand || "";
  let resolvedWebsite = (parsed.website_used && String(parsed.website_used).trim()) || providedWebsite || "";
  let resolvedIndustry = (parsed.industry_used && String(parsed.industry_used).trim()) || providedIndustry || "";

  return {
    brandUsed: resolvedBrand,
    websiteUsed: resolvedWebsite,
    industryUsed: resolvedIndustry,

    metaTitle: parsed.meta_title || `${logoName} Logo PNG SVG Vector | cdrlogo.com`,
    metaDescription: parsed.meta_description || `${logoName} logo available in PNG, SVG and vector format for educational use and research purposes. Reference archive on cdrlogo.com.`,
    description: parsed.main_description || `The ${logoName} logo is available in PNG, SVG, AI and CDR vector formats with  high resolution, provided on cdrlogo.com for educational use and reference purposes.`,
    altText: parsed.alt_text || `${logoName} logo — PNG SVG vector file on cdrlogo.com`,
    tags: Array.isArray(parsed.tags) && parsed.tags.length
      ? parsed.tags
      : [logoName, "logo", "PNG", "SVG", "vector", "cdrlogo.com"],

    // ── New OG / Twitter fields ─────────────────────────────────────────────

    ogTitle: parsed.og_title || `${logoName} Logo — PNG & SVG Vector`,
    ogDescription: parsed.og_description || `${logoName} logo available in PNG and SVG vector format for educational reference and research purposes.`,
    twitterTitle: parsed.twitter_title || `${logoName} Logo — PNG SVG Vector`,
    twitterDescription: parsed.twitter_description || `${logoName} logo in PNG and SVG vector format for educational reference and research use.`,

    // ── Schema source fields (raw from LLM, structured into JSON-LD later) ──
    imageObjectDescription: parsed.image_object_description || `${logoName} logo image on cdrlogo.com`,
    faq: Array.isArray(parsed.faq) ? parsed.faq : [],

    isVariant,
    relatedSlugs: [],
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  console.log("\n========== UPLOAD-LOGO START ==========");
  let startTime = Date.now();

  try {
    let formData = await req.formData();
    console.log("[1] ✓ Form data received");

    // ── 1. pull fields ────────────────────────────────────────────────────────
    let slug = formData.get("slug")?.trim();
    let logoName = formData.get("logoName")?.trim();
    let brand = formData.get("brand") || "";
    let website = formData.get("website") || "";
    let categoryRaw = formData.get("category") || "";
    let category = categoryRaw.toLowerCase().trim() === "template" ? ["template"] : [categoryRaw];
    let industry = formData.get("industry") || "";
    let country = formData.get("country") || "";
    let license = formData.get("license") || "";
    let publishStatus = formData.get("publishStatus") || "Draft";
    let downloadCount = formData.get("downloadCount") || "unlimited";
    let altText = formData.get("altText") || "";

    let description = formData.get("description") || "";
    let metaTitle = formData.get("metaTitle") || "";
    let metaDescription = formData.get("metaDescription") || "";


    let brandColors = [];
    try { brandColors = JSON.parse(formData.get("brandColors") || "[]"); } catch { }

    let useAI = formData.get("useAI") !== "false";

    console.log("[1a] Parsed form fields:");
    console.log(`  slug: "${slug}"`);
    console.log(`  logoName: "${logoName}"`);
    console.log(`  brand: "${brand}"`);
    console.log(`  category: "${category}"`);
    console.log(`  useAI: ${useAI}`);

    if (!slug) {
      console.log("[1b] ❌ VALIDATION FAILED: slug is required");
      return NextResponse.json({ error: "slug is required." }, { status: 400 });
    }
    if (!logoName) {
      console.log("[1b] ❌ VALIDATION FAILED: logoName is required");
      return NextResponse.json({ error: "logoName is required." }, { status: 400 });
    }
    console.log("[1b] ✓ Basic validation passed");

    // ── 2. collect ZIP files ──────────────────────────────────────────────────
    console.log("[2] Collecting ZIP files...");
    let zipFiles = formData.getAll("files");
    if (!zipFiles.length) {
      console.log("[2] ❌ No ZIP files found");
      return NextResponse.json({ error: "No ZIP file uploaded." }, { status: 400 });
    }
    console.log(`[2] ✓ Found ${zipFiles.length} ZIP file(s)`);

    // ── 3. fetch watermark settings from DB ───────────────────────────────────
    console.log("[3] Fetching watermark settings...");
    let websiteRecord = await prisma.website.findFirst();
    let watermark = websiteRecord?.watermark ?? null;
    console.log(`[3] ✓ Watermark config: ${watermark?.enabled ? "ENABLED" : "DISABLED"}`);

    // ── 4. AI content generation ──────────────────────────────────────────────
    let tags = [];
    let aiMeta = { isVariant: false };
    let finalLogoName = logoName;
    let finalSlug = slug;
    let relatedSlugs = [];

    // canonicalUrl is always cdrlogo.com/logos/{slug}/ — rebuilt after
    // potential auto-versioning settles the final slug.
    let canonicalUrl = `https://www.cdrlogo.com/logo/${slug}/`;

    // ── New SEO vars with safe defaults (overwritten by AI below) ────────────
    let ogTitle = "";
    let ogDescription = "";
    let ogImageUrl = "";          // set after WebP upload in step 6
    let twitterTitle = "";
    let twitterDescription = "";
    let twitterCardType = "summary_large_image";

    // ── Schema fields (NEW) ───────────────────────────────────────────────────
    let imageObjectSchema = {};
    let breadcrumbSchema = {};
    let faqSchema = [];
    let imageObjectDescription = "";
    let faqPairs = [];

    if (useAI) {
      console.log("[4] AI GENERATION ENABLED - Starting process...");
      try {
        console.log(`[4a] Finding related logos for "${logoName}"...`);
        let { related, exactNormalizedMatches } = await findRelatedLogos(logoName);
        console.log(`[4a] ✓ Found ${related.length} related logo(s), ${exactNormalizedMatches.length} exact normalized match(es)`);

        if (exactNormalizedMatches.length > 0) {
          console.log(`[4b] Exact matches found — auto-versioning LOGO NAME...`);
          exactNormalizedMatches.forEach((m, i) => {
            console.log(`     ${i + 1}. "${m.logoName}"`);
          });
          finalLogoName = generateVersionedName(logoName, exactNormalizedMatches);
          finalSlug = generateSlugFromName(finalLogoName);
          console.log(`[4b] ✓ Logo name: "${logoName}" → "${finalLogoName}"`);
          console.log(`[4b] ✓ Slug: "${slug}" → "${finalSlug}"`);

          let versionedSlugExists = await prisma.logo.findUnique({ where: { slug: finalSlug } });
          if (versionedSlugExists) {
            console.log(`[4b] ❌ Auto-versioned slug "${finalSlug}" already exists`);
            return NextResponse.json(
              { error: `Auto-versioned slug "${finalSlug}" is already taken. Please upload again or check existing logos.` },
              { status: 409 }
            );
          }
          // Rebuild canonicalUrl after versioned slug is finalised
          canonicalUrl = `https://www.cdrlogo.com/logo/${finalSlug}/`;
        } else {
          console.log(`[4b] No exact matches — this is a new logo, no versioning needed`);
        }

        console.log(`[4c] Calling OpenAI (gpt-41-mini, temp=0.6)...`);
        let aiContent = await generateAIContent({
          logoName: finalLogoName,
          brand,
          website,
          category: categoryRaw,
          industry,
          country,
          relatedLogos: related,
          canonicalUrl,
        });
        console.log(`[4c] ✓ AI response received`);
        console.log(`     - brand_used: "${aiContent.brandUsed}"`);
        console.log(`     - website_used: "${aiContent.websiteUsed}"`);
        console.log(`     - industry_used: "${aiContent.industryUsed}"`);
        console.log(`     - meta_title (${aiContent.metaTitle.length} chars): "${aiContent.metaTitle.substring(0, 60)}"`);
        console.log(`     - og_title: "${aiContent.ogTitle}"`);
        console.log(`     - twitter_title: "${aiContent.twitterTitle}"`);
        console.log(`     - tags: ${aiContent.tags.length} generated`);
        console.log(`     - faq pairs: ${aiContent.faq.length} generated`);

        aiMeta = {
          isVariant: aiContent.isVariant,
          relatedCount: related.length,
          originalLogoName: logoName,
          finalLogoName,
          versioned: finalLogoName !== logoName,
          brandUsed: aiContent.brandUsed,
          websiteUsed: aiContent.websiteUsed,
          industryUsed: aiContent.industryUsed,
        };

        // LLM's decided values always win over form-submitted hints
        brand = aiContent.brandUsed;
        website = aiContent.websiteUsed;
        industry = aiContent.industryUsed;

        if (aiContent.metaTitle) metaTitle = aiContent.metaTitle;
        if (aiContent.metaDescription) metaDescription = aiContent.metaDescription;
        if (aiContent.description) description = aiContent.description;
        if (aiContent.altText) altText = aiContent.altText;
        if (aiContent.tags.length) tags = aiContent.tags;

        // ── Assign new OG / Twitter fields ───────────────────────────────────
        ogTitle = aiContent.ogTitle;
        ogDescription = aiContent.ogDescription;
        twitterTitle = aiContent.twitterTitle;
        twitterDescription = aiContent.twitterDescription;
        // twitterCardType stays "summary_large_image" (schema default)

        // ── Schema source values from LLM (structured into JSON-LD below) ───
        imageObjectDescription = aiContent.imageObjectDescription;
        faqPairs = aiContent.faq;

        if (aiContent.relatedSlugs.length) relatedSlugs = aiContent.relatedSlugs;
        console.log(`[4d] ✓ AI content applied to logo`);

      } catch (aiErr) {
        console.error("[4] ❌ AI generation failed:", aiErr.message);
        await prisma.log.create({
          data: {
            who: "api:upload-logo",
            content: `AI generation error for "${logoName}": ${aiErr?.message}`,
          },
        });
        console.log("[4] ⚠ Falling back to manually entered fields");
        if (!brand || !brand.trim()) brand = "cdrlogo.com";
        if (!website || !website.trim()) website = "";
        if (!industry || !industry.trim()) industry = "Logo Design & Graphics";
        try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
        // OG/Twitter fallbacks — simple, compliant with banned-word rules
        ogTitle = `${logoName} Logo — PNG & SVG Vector`;
        ogDescription = `${logoName} logo available in PNG and SVG vector format for educational reference and research purposes.`;
        twitterTitle = `${logoName} Logo — PNG SVG Vector`;
        twitterDescription = `${logoName} logo in PNG and SVG vector format for educational reference and research use.`;
        // Schema fallbacks
        imageObjectDescription = `${logoName} logo image on cdrlogo.com`;
        faqPairs = [];
      }
    } else {
      console.log("[4] AI DISABLED - Using manual fields only");
      if (!brand || !brand.trim()) brand = "cdrlogo.com";
      if (!website || !website.trim()) website = "";
      if (!industry || !industry.trim()) industry = "Logo Design & Graphics";
      try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
      // Manual-mode OG/Twitter: derive from whatever meta fields were submitted
      ogTitle = metaTitle || `${logoName} Logo — PNG & SVG Vector`;
      ogDescription = metaDescription || `${logoName} logo available in PNG and SVG vector format for educational reference purposes.`;
      twitterTitle = ogTitle;
      twitterDescription = ogDescription.substring(0, 140);
      // Schema fallbacks (manual mode — no LLM call)
      imageObjectDescription = `${logoName} logo image on cdrlogo.com`;
      faqPairs = [];
    }

    if (!description) {
      console.log("[4] ❌ No description found");
      return NextResponse.json({ error: "description is required (AI generation may have failed)." }, { status: 400 });
    }
    console.log("[4] ✓ Description present");

    // ── 5. process every ZIP ──────────────────────────────────────────────────
    console.log("[5] Processing ZIP contents...");
    let publicFiles = [];
    let privateFiles = [];
    let svgContent = null;
    let fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };

    for (let zipFile of zipFiles) {
      let arrayBuffer = await zipFile.arrayBuffer();
      let zip = new AdmZip(Buffer.from(arrayBuffer));

      for (let entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        let filename = entry.entryName.split("/").pop();
        filename = sanitizeFilename(filename);
        let fileExt = ext(filename);
        let fileBuffer = entry.getData();
        let fileSize = (fileBuffer.length / 1024).toFixed(2);

        console.log(`     - ${filename} (${fileSize} KB)`);

        if (fileExt === "svg") {
          privateFiles.push({
            key: `separate/${finalSlug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          fileSizes.svg = fileBuffer.length;
          if (!svgContent) svgContent = fileBuffer.toString("utf-8");
          console.log(`       → private SVG stored (${fileSize} KB)`);

        } else if (fileExt === "png") {
          privateFiles.push({
            key: `separate/${finalSlug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          fileSizes.png = fileBuffer.length;

          // Watermark applies to the public WebP preview only —
          // the private PNG is always stored clean/unwatermarked.
          let watermarked = await applyWatermark(fileBuffer, watermark);
          let webpBuffer = await sharp(watermarked).webp({ quality: 90 }).toBuffer();
          let webpName = filename.replace(/\.png$/i, ".webp");
          publicFiles.push({
            key: `public/${finalSlug}/${webpName}`,
            buffer: webpBuffer,
            contentType: "image/webp",
          });
          console.log(`       → private PNG (${fileSize} KB) + public WebP (${(webpBuffer.length / 1024).toFixed(2)} KB)`);

        } else if (fileExt === "ai") {
          privateFiles.push({
            key: `separate/${finalSlug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          fileSizes.ai = fileBuffer.length;
          console.log(`       → private AI stored (${fileSize} KB)`);

        } else if (fileExt === "cdr") {
          privateFiles.push({
            key: `separate/${finalSlug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          fileSizes.cdr = fileBuffer.length;
          console.log(`       → private CDR stored (${fileSize} KB)`);

        } else {
          privateFiles.push({
            key: `private/${finalSlug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          console.log(`       → private misc file (${fileSize} KB)`);
        }
      }
    }
    console.log(`[5] ✓ ZIP processing complete: ${publicFiles.length} public, ${privateFiles.length} private`);

    // ── 6. upload everything to R2 ────────────────────────────────────────────
    console.log("[6] Uploading files to R2...");
    let allUploads = [...publicFiles, ...privateFiles];

    let uploadResults = await Promise.all(
      allUploads.map(async ({ key, buffer, contentType }) => {
        try {
          console.log(`     Uploading: ${key}`);
          return await uploadToR2({ fileBuffer: buffer, fileName: key, mimeType: contentType });
        } catch (err) {
          console.error(`     ❌ Failed to upload: ${key} — ${err.message}`);
          return null;
        }
      })
    );

    let urlMap = {};
    allUploads.forEach(({ key }, i) => { urlMap[key] = uploadResults[i]; });

    let failedUploads = allUploads.filter((_, i) => !uploadResults[i]);
    if (failedUploads.length) {
      console.warn(`[6] ⚠ ${failedUploads.length} file(s) failed to upload: ${failedUploads.map(f => f.key).join(", ")}`);
    }
    console.log(`[6] ✓ Upload complete (${allUploads.length - failedUploads.length}/${allUploads.length} succeeded)`);

    let findUrl = (predicate) => {
      let match = allUploads.find(predicate);
      return match ? urlMap[match.key] : null;
    };

    let svgUrl = findUrl(f => f.key.endsWith(".svg"));
    let pngUrl = findUrl(f => f.key.endsWith(".png"));
    let webpUrl = findUrl(f => f.key.endsWith(".webp"));
    let aiUrl = findUrl(f => f.key.endsWith(".ai"));
    let cdrUrl = findUrl(f => f.key.endsWith(".cdr"));

    console.log("[6a] Resolved file URLs:");
    if (svgUrl) console.log(`     SVG: ${svgUrl}`);
    if (pngUrl) console.log(`     PNG: ${pngUrl}`);
    if (webpUrl) console.log(`     WebP (public): ${webpUrl}`);
    if (aiUrl) console.log(`     AI: ${aiUrl}`);
    if (cdrUrl) console.log(`     CDR: ${cdrUrl}`);

    // ── ogImageUrl: use the public WebP as the OG/Twitter card image ─────────
    // This is the 1200x630-friendly public preview. If no WebP exists (edge
    // case: zip had no PNG), leave it null — the front-end can fall back to a
    // site-wide default OG image.
    ogImageUrl = webpUrl || null;
    console.log(`[6b] ogImageUrl set to: ${ogImageUrl || "null (no WebP available)"}`);

    // ── 6c. build structured schema JSON-LD (NEW) ─────────────────────────────
    // ImageObject + BreadcrumbList + FAQ — these are stored as JSON in the DB
    // (Logo.imageObjectSchema / breadcrumbSchema / faqSchema) so the frontend
    // can inject them as <script type="application/ld+json"> in <head>.
    console.log("[6c] Building schema JSON-LD...");

    imageObjectSchema = buildImageObjectSchema({
      imageUrl: ogImageUrl,
      logoName: finalLogoName,
      brand,
      canonicalUrl,
      description: imageObjectDescription,
    });

    breadcrumbSchema = buildBreadcrumbSchema({
      brand,
      logoName: finalLogoName,
      canonicalUrl,
    });

    faqSchema = buildFaqSchema(faqPairs);

    console.log(`[6c] ✓ imageObjectSchema: ${Object.keys(imageObjectSchema).length ? "built" : "empty (no image)"}`);
    console.log(`[6c] ✓ breadcrumbSchema: built (Home > ${brand || "Logos"} > ${finalLogoName})`);
    console.log(`[6c] ✓ faqSchema: ${faqSchema.length} question(s)`);

    // ── 7. save to DB ─────────────────────────────────────────────────────────
    console.log("[7] Saving logo to database...");
    console.log(`     Final logo name : "${finalLogoName}"`);
    console.log(`     Final slug      : "${finalSlug}"`);
    console.log(`     Brand           : "${brand}"`);
    console.log(`     Website         : "${website}"`);
    console.log(`     Industry        : "${industry}"`);
    console.log(`     canonicalUrl    : "${canonicalUrl}"`);
    console.log(`     ogTitle         : "${ogTitle}"`);
    console.log(`     ogDescription   : "${ogDescription?.substring(0, 60)}..."`);
    console.log(`     ogImageUrl      : "${ogImageUrl || "null"}"`);
    console.log(`     ogType          : "website"`);
    console.log(`     twitterTitle    : "${twitterTitle}"`);
    console.log(`     twitterCardType : "${twitterCardType}"`);
    console.log(`     Tags (${tags.length}): ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`);

    let logo = await prisma.logo.create({
      data: {
        logoName: finalLogoName,
        slug: finalSlug,
        brand,
        website,
        category,
        industry,
        country,
        license,
        description,
        tags,
        brandColors,
        publishStatus,
        downloadCount,
        svgUrl,
        pngUrl,
        webpUrl,
        aiUrl,
        cdrUrl,
        svgContent,
        metaTitle,
        metaDescription: metaDescription.trim(),
        altText,
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),

        // ── SEO / social fields ─────────────────────────────────────────────
        canonicalUrl,
        ogTitle,
        ogDescription,
        ogImageUrl,               // public WebP URL (watermarked preview)
        ogType: "website",        // changed from "website" → "article"
        twitterTitle,
        twitterDescription,
        twitterImage: ogImageUrl,   // same image reused for Twitter card
        twitterCardType,

        // ── Schema fields (NEW) ──────────────────────────────────────────────
        imageObjectSchema,
        breadcrumbSchema,
        faqSchema,
      },
    });
    console.log(`[7] ✓ Logo saved to DB with ID: ${logo.id}`);

    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Logo uploaded: ${finalSlug} (name: "${finalLogoName}")${aiMeta.versioned ? ` [auto-versioned from "${logoName}"]` : ""}${aiMeta.isVariant ? ` (AI variant, ${aiMeta.relatedCount} related)` : useAI ? " (AI-generated)" : " (manual)"}`,
      },
    });

    let duration = Date.now() - startTime;
    console.log(`\n========== UPLOAD-LOGO SUCCESS ==========`);
    console.log(`Total time  : ${duration}ms`);
    console.log(`Final Slug  : "${finalSlug}"`);
    console.log(`Logo Name   : "${finalLogoName}"${aiMeta.versioned ? ` (auto-versioned from "${logoName}")` : ""}`);
    console.log(`Files       : ${allUploads.length} total (${publicFiles.length} public, ${privateFiles.length} private)`);
    console.log(`==========================================\n`);

    return NextResponse.json({
      message: "Logo uploaded successfully!",
      logo,
      ai: aiMeta,
      files: {
        public: publicFiles.map(f => ({ key: f.key, url: urlMap[f.key] })),
        private: privateFiles.map(f => ({ key: f.key, url: urlMap[f.key] })),
      },
    });

  } catch (error) {
    let duration = Date.now() - startTime;
    console.error(`\n========== UPLOAD-LOGO ERROR ==========`);
    console.error(`Time elapsed : ${duration}ms`);
    console.error(`Error        : ${error.message}`);
    console.error(`Stack        : ${error.stack}`);
    console.error(`========================================\n`);

    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Upload error: ${error?.message}`,
      },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}