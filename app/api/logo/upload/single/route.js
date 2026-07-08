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

// ── Extract usable category names from the website record's categories JSON ──
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
      website: true,
      country: true,
      industry: true,
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

// ── Banned words/phrases — mirror the prompt's banned-word lists. ───────────
// NOTE: server-side validateAIContent() below is kept for reference/parity
// with the bulk-upload route but is NOT invoked (matches bulk's behavior,
// where the compliance re-call step is disabled). The LLM's own in-prompt
// self-validation is relied on instead.
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
// Kept for parity with bulk-upload route. Not called (see note above).
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
    "name": `${logoName}`,
    "description": description || `${logoName}  image on cdrlogo.com`,
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
// Matches the bulk-upload route's generation pattern exactly:
//   - brand/website/industry/country are always AI-inferred (no form hints)
//   - category is LLM-selected from the site's category list
//   - main_description uses the randomized STYLE A/B/C/D rotation
//   - the compliance validation/retry call is disabled (kept for reference)
async function generateAIContent({
  logoName, userCategory, availableCategories, relatedLogos, canonicalUrl,
}) {
  let isVariant = relatedLogos.length > 0;

  let STYLE_LETTERS = ["A", "B", "C", "D"];
  let forcedStyle = STYLE_LETTERS[Math.floor(Math.random() * 4)];
  console.log(`  [style] Forced style for this logo: STYLE ${forcedStyle}`);

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

  let hasCategoryList = availableCategories.length > 0;

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

  ///////////////////////////////////////////////////////////////
  // USER PROMPT
  ///////////////////////////////////////////////////////////////

  let userPrompt = `Generate complete SEO metadata for this logo page.

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

  // ── Server-side compliance validation + one corrective re-call ───────────
  // DISABLED to match the bulk-upload route's current behavior. Left here,
  // commented out, for parity/reference — re-enable both routes together
  // if this is turned back on.
  //
  // let usedTitles = relatedLogos.map(r => r.metaTitle).filter(Boolean);
  // let violations = validateAIContent(parsed, { usedTitles, usedOpeners });
  //
  // if (violations.length) {
  //   console.warn(`[AI Validation] ${violations.length} violation(s) found, re-calling OpenAI once:`);
  //   violations.forEach(v => console.warn(`     - ${v}`));
  //
  //   let correctionPrompt = `Your previous JSON response violated these rules:
  //
  // ${violations.map(v => `- ${v}`).join("\n")}
  //
  // Regenerate the COMPLETE JSON response, fixing every violation above. Do not
  // repeat the same mistakes. Re-check every field against the banned-words list
  // and the educational/reference phrase requirement before returning. Return
  // ONLY the corrected JSON object, with the same structure as before.`;
  //
  //   let retryCompletion = await callOpenAIWithRetry({
  //     model: "gpt-4.1-mini",
  //     temperature: 0.5,
  //     messages: [
  //       ...messages,
  //       { role: "assistant", content: raw },
  //       { role: "user", content: correctionPrompt },
  //     ],
  //     response_format: { type: "json_object" },
  //   });
  //
  //   let retryRaw = retryCompletion.choices[0]?.message?.content || "{}";
  //   let retryParsed;
  //   try { retryParsed = JSON.parse(retryRaw); } catch { retryParsed = null; }
  //
  //   if (retryParsed) {
  //     let retryViolations = validateAIContent(retryParsed, { usedTitles, usedOpeners });
  //     console.log(`[AI Validation] Retry result: ${retryViolations.length ? `${retryViolations.length} violation(s) remain` : "clean"}`);
  //     parsed = retryParsed;
  //   } else {
  //     console.warn("[AI Validation] Retry response failed to parse — keeping original response");
  //   }
  // } else {
  //   console.log("[AI Validation] ✓ No violations found on first attempt");
  // }

  // ── Resolve category ───────────────────────────────────────────────────────
  let rawCategories = parsed.category;
  if (typeof rawCategories === "string") rawCategories = [rawCategories];
  if (!Array.isArray(rawCategories)) rawCategories = [];

  let resolvedCategories = [];
  if (hasCategoryList) {
    for (let cat of rawCategories) {
      let match = availableCategories.find(
        (c) => c.name.toLowerCase() === String(cat).trim().toLowerCase()
      );
      if (match) resolvedCategories.push(match.name);
    }
    resolvedCategories = resolvedCategories.slice(0, 5);
    if (resolvedCategories.length === 0) resolvedCategories = ["template"];
  } else {
    resolvedCategories = rawCategories.slice(0, 5).map(String).filter(Boolean);
  }

  // ── Resolve brand / country / industry / website (AI-inferred only) ──────
  let resolvedBrand = (parsed.brand_used && String(parsed.brand_used).trim()) || "";
  let resolvedCountry = (parsed.country_used && String(parsed.country_used).trim()) || "Worldwide";
  let resolvedIndustry = (parsed.industry_used && String(parsed.industry_used).trim()) || "Logo Design & Graphics";
  let resolvedWebsite = (parsed.website_used && String(parsed.website_used).trim()) || "";

  // ── Defensive fallbacks — LLM rules but we never ship empty strings ───────
  return {
    category: resolvedCategories,
    brand: resolvedBrand,
    website: resolvedWebsite,
    country: resolvedCountry,
    industry: resolvedIndustry,

    metaTitle: parsed.meta_title || `${logoName} — PNG SVG vector file on cdrlogo.com`,
    metaDescription: parsed.meta_description || `${logoName} available in PNG, SVG and vector format for educational use and research purposes. Reference archive on cdrlogo.com.`,
    description: parsed.main_description || `The ${logoName} is available in PNG, SVG, AI and CDR vector formats and high resolution, provided on cdrlogo.com for educational use and reference purposes.`,
    altText: parsed.alt_text || `${logoName} — PNG SVG vector file on cdrlogo.com`,
    tags: Array.isArray(parsed.tags) && parsed.tags.length
      ? parsed.tags
      : [logoName, "PNG", "SVG", "vector", "cdrlogo.com"],

    ogTitle: parsed.og_title || `${logoName} — PNG & SVG Vector`,
    ogDescription: parsed.og_description || `${logoName} available in PNG and SVG vector format for educational reference and research purposes.`,
    twitterTitle: parsed.twitter_title || `${logoName} — PNG SVG Vector`,
    twitterDescription: parsed.twitter_description || `${logoName} in PNG and SVG vector format for educational reference and research use.`,

    imageObjectDescription: parsed.image_object_description || `${logoName} image on cdrlogo.com`,
    faq: Array.isArray(parsed.faq) ? parsed.faq : [],

    isVariant,
    relatedSlugs: relatedLogos.map((r) => r.slug).filter(Boolean),
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
    console.log(`  brand: "${brand}" (only used if AI generation is disabled/fails)`);
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

    // ── 3. fetch watermark settings + category list from DB ──────────────────
    console.log("[3] Fetching website settings...");
    let websiteRecord = await prisma.website.findFirst();
    let watermark = websiteRecord?.watermark ?? null;
    console.log(`[3] ✓ Watermark config: ${watermark?.enabled ? "ENABLED" : "DISABLED"}`);

    let availableCategories = categoryRaw.toLowerCase().trim() === "template"
      ? []
      : extractCategoryNames(websiteRecord?.categories);
    console.log(`[3] ✓ Available categories for AI selection: ${availableCategories.length}`);

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

    // ── Schema fields ──────────────────────────────────────────────────────
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

        console.log(`[4c] Calling OpenAI (gpt-4.1-mini, temp=0.6)...`);
        let aiContent = await generateAIContent({
          logoName: finalLogoName,
          userCategory: categoryRaw,
          availableCategories,
          relatedLogos: related,
          canonicalUrl,
        });
        console.log(`[4c] ✓ AI response received`);
        console.log(`     - category: ${JSON.stringify(aiContent.category)}`);
        console.log(`     - brand_used: "${aiContent.brand}"`);
        console.log(`     - website_used: "${aiContent.website}"`);
        console.log(`     - industry_used: "${aiContent.industry}"`);
        console.log(`     - country_used: "${aiContent.country}"`);
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
          brandUsed: aiContent.brand,
          websiteUsed: aiContent.website,
          industryUsed: aiContent.industry,
          countryUsed: aiContent.country,
        };

        // AI-inferred values always win — form-submitted brand/website/
        // industry/country are ignored when AI generation is enabled.
        brand = aiContent.brand;
        website = aiContent.website;
        industry = aiContent.industry;
        country = aiContent.country;

        // Category is now LLM-selected from the site's category list,
        // respecting the "template" override from the form.
        category = categoryRaw.toLowerCase().trim() === "template"
          ? ["template"]
          : (Array.isArray(aiContent.category) && aiContent.category.length > 0
            ? aiContent.category
            : ["template"]);

        metaTitle = aiContent.metaTitle;
        metaDescription = aiContent.metaDescription;
        description = aiContent.description;
        altText = aiContent.altText;
        if (aiContent.tags.length) tags = aiContent.tags;

        // ── Assign OG / Twitter fields ───────────────────────────────────────
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
        if (!country || !country.trim()) country = "Worldwide";
        try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
        // OG/Twitter fallbacks — simple, compliant with banned-word rules
        ogTitle = `${logoName} — PNG & SVG Vector`;
        ogDescription = `${logoName} available in PNG and SVG vector format for educational reference and research purposes.`;
        twitterTitle = `${logoName} — PNG SVG Vector`;
        twitterDescription = `${logoName} in PNG and SVG vector format for educational reference and research use.`;
        // Schema fallbacks
        imageObjectDescription = `${logoName} image on cdrlogo.com`;
        faqPairs = [];
      }
    } else {
      console.log("[4] AI DISABLED - Using manual fields only");
      if (!brand || !brand.trim()) brand = "cdrlogo.com";
      if (!website || !website.trim()) website = "";
      if (!industry || !industry.trim()) industry = "Logo Design & Graphics";
      if (!country || !country.trim()) country = "Worldwide";
      try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
      // Manual-mode OG/Twitter: derive from whatever meta fields were submitted
      ogTitle = metaTitle || `${logoName} — PNG & SVG Vector`;
      ogDescription = metaDescription || `${logoName} available in PNG and SVG vector format for educational reference purposes.`;
      twitterTitle = ogTitle;
      twitterDescription = ogDescription.substring(0, 140);
      // Schema fallbacks (manual mode — no LLM call)
      imageObjectDescription = `${logoName} image on cdrlogo.com`;
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

    // ── 6c. build structured schema JSON-LD ───────────────────────────────────
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
    console.log(`     Category        : ${JSON.stringify(category)}`);
    console.log(`     Brand           : "${brand}"`);
    console.log(`     Website         : "${website}"`);
    console.log(`     Industry        : "${industry}"`);
    console.log(`     Country         : "${country}"`);
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
        ogType: "website",
        twitterTitle,
        twitterDescription,
        twitterImage: ogImageUrl,   // same image reused for Twitter card
        twitterCardType,

        // ── Schema fields ─────────────────────────────────────────────────────
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