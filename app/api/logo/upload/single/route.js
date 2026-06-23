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

// ── Generate slug from logo name ────────────────────────────────────────────
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

// ── Find related logos by fuzzy/normalized name match ─────────────────────────
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
      // ── ADDITION 1: fetch slug so we can build relatedSlugs list ──────────
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

// ── OpenAI: generate SEO content + tags ───────────────────────────────────────
async function generateAIContent({ logoName, brand, website, category, industry, country, relatedLogos }) {
  let isVariant = relatedLogos.length > 0;

  let relatedContext = isVariant
    ? relatedLogos
      .slice(0, 5)
      .map(
        (r, i) =>
          `Previous version ${i + 1}:
- Name: ${r.logoName}
- Meta Title: ${r.metaTitle || "N/A"}
- Meta Description: ${r.metaDescription || "N/A"}
- Description: ${r.description || "N/A"}
- Tags: ${Array.isArray(r.tags) ? r.tags.join(", ") : "N/A"}`
      )
      .join("\n\n")
    : "";

  let usedOpeners = isVariant
    ? relatedLogos
      .map(r => (r.description || "").split(/[.!?]/)[0].trim())
      .filter(Boolean)
    : [];

  // Brand, website, and industry are no longer force-defaulted before the
  // prompt — the model decides all three itself from the logo name whenever
  // they weren't explicitly given.
  let providedBrand = (brand && brand.trim()) ? brand.trim() : "";
  let providedWebsite = (website && website.trim()) ? website.trim() : "";
  let providedIndustry = (industry && industry.trim()) ? industry.trim() : "";
  let resolvedCountry = (country && country.trim()) ? country.trim() : "";

  let systemPrompt = `You are a senior SEO specialist for a professional logo download website (cdrlogo.com). Your sole job is to write SEO content that ranks for queries like "Nike logo PNG download", "Apple logo SVG vector free", "brand logo transparent background". If the brand/company is not explicitly given to you, you must infer/decide the most likely real-world brand from the logo name yourself — never invent a placeholder brand and never leave it blank. You must also determine that brand's real official website URL (e.g. https://www.nike.com) from your own knowledge of the brand — never invent or guess a fake-looking domain. You must also determine the brand's real industry/sector (e.g. "Sportswear & Athletic Apparel", "Automotive", "Fast Food", "Technology / Consumer Electronics") based on what the brand actually does — never leave it as a vague placeholder like "General" if a real brand was identified. Every field you return must be filled — no empty strings, no "N/A". If, after your best effort, no real brand can be identified at all, use "cdrlogo.com" as the brand, "https://cdrlogo.com" as the website, and "Logo Design & Graphics" as the industry. If you can identify the real brand but are not confident of its exact official domain, still give your best real answer rather than a placeholder. You always return valid JSON only — no markdown, no code fences, no commentary.`;

  let userPrompt = `Generate SEO content for this logo page on cdrlogo.com.

== LOGO DETAILS ==
Logo Name : ${logoName}
${providedBrand ? `Brand     : ${providedBrand} (use this if it is correct)` : `Brand     : UNKNOWN — infer/decide the real brand yourself from the logo name. Only use "cdrlogo.com" as the brand if you genuinely cannot determine any real brand.`}
${providedWebsite ? `Website   : ${providedWebsite} (use this if it is correct)` : `Website   : UNKNOWN — determine the brand's real official website URL yourself (use your own knowledge of the brand, not a guess). Only use "https://cdrlogo.com" if you genuinely cannot identify any real brand/website.`}
Category  : ${category || "Logo"}
${providedIndustry ? `Industry  : ${providedIndustry} (use this if it is correct)` : `Industry  : UNKNOWN — determine the brand's real industry/sector yourself based on what the brand actually does. Be specific (e.g. "Sportswear & Athletic Apparel", not just "Retail"). Only use "Logo Design & Graphics" if you genuinely cannot identify any real brand.`}
${resolvedCountry ? `Country   : ${resolvedCountry}` : ""}

== FIELD RULES (read every rule before writing) ==

meta_title (STRICT: 50-60 chars, NEVER exceed 60):
  • Format: "{Brand} Logo PNG SVG Vector Free Download | cdrlogo.com"
  • Always include: brand name (the one you decided/were given) + at least TWO of these intent words: PNG, SVG, Vector, Download, Free
  • If brand is unknown use the logo name instead
  • End with "| cdrlogo.com" — counts toward the 60-char limit so keep the brand part short
  • NEVER leave empty

meta_description (STRICT: 140-155 chars):
  • Must read like a download CTA, NOT a blog intro
  • Must contain: brand/logo name + at least 3 of: free download, PNG, SVG, vector, transparent, high quality, AI, EPS
  • Structure: "Download [Brand] logo in [formats]. [one benefit sentence]. Available at cdrlogo.com."
  • NEVER use blog phrases: "In this article", "We explore", "This post", "Learn about"
  • NEVER leave empty

main_description (100-150 words):
  • Write this one like an informative, blog-style paragraph about the brand/logo — natural, editorial tone, not a stiff product-page listing
  • Opening sentence MUST still mention downloading the logo + at least one format (PNG/SVG/vector) before moving into the informative content
  • Cover: what the logo is, what brand it represents, what industry/sector, brief relevant brand context, download formats available (PNG, SVG, AI, EPS, CDR), use cases (websites, presentations, print, apps)
  • Include naturally: "free download", "vector format", "transparent background", "high resolution"
  • Do NOT describe colors, shapes, or visual design — only brand context and download utility
  • NEVER leave empty
  * 120–155 characters
* Mention logo name naturally
* Mention available formats naturally
* Mention educational or design reference use
* Include natural download intent
* Do not repeat the title exactly

alt_text (10-15 words):
  • Format: "{Brand} logo in PNG SVG vector format — free download on cdrlogo.com"
  • NEVER leave empty

history (40-60 words):
  • Short brand founding/milestone paragraph — how this logo fits their timeline
  • If brand is unknown or very obscure: write "Download the ${logoName} logo from cdrlogo.com. Available in PNG, SVG, AI, EPS and CDR vector formats for commercial and personal use."
  • NEVER leave empty — always use the fallback above for unknown brands

tags (12-15 items, array of strings):
  • Must include: brand/logo name, "PNG", "SVG", "vector", "free download", "transparent", industry term, "logo download", "cdrlogo.com"
  • Add format variants: "AI file", "EPS", "CDR" where relevant
  • NEVER return empty array

brand_used (string):
  • Return the exact brand name you decided to use for this logo (whether it was given to you or you inferred it). If you could not determine any real brand, return "cdrlogo.com".

website_used (string):
  • Return the brand's real official website URL (full https:// URL), whether it was given to you or you determined it yourself from your knowledge of the brand. Only return "https://cdrlogo.com" if you could not determine any real brand/website.

industry_used (string):
  • Return the brand's real industry/sector, whether it was given to you or you determined it yourself. Be specific and accurate to what the brand actually does (e.g. "Sportswear & Athletic Apparel", "Fast Food", "Automotive Manufacturing"). Only return "Logo Design & Graphics" if you could not determine any real brand.
${isVariant ? `
== VARIANT / VERSION RULES ==
This is a new version of an existing logo. Previous version(s) already indexed:

${relatedContext}

Previously used description openers (DO NOT reuse any): ${usedOpeners.length ? usedOpeners.map(o => `"${o}"`).join(", ") : "none"}

Mandatory uniqueness:
1. Open main_description from a different angle than previous versions (e.g. rebrand trigger, new market context, updated usage, identity evolution) — still must mention downloading + format in sentence 1.
2. Do not mirror sentence structure or paragraph shape of prior versions.
3. Do not reuse phrases or adjective combinations from prior meta_title or meta_description.
4. Tags: keep core brand/format terms, add 3-4 new tags (e.g. version identifier, more specific use-case terms).` : ""}

Respond ONLY with valid JSON — no markdown, no code fences:
{
  "meta_title": "...",
  "meta_description": "...",
  "main_description": "...",
  "alt_text": "...",
  "history": "...",
  "tags": ["...", "...", ...],
  "brand_used": "...",
  "website_used": "...",
  "industry_used": "..."
}`;

  let completion = await callOpenAIWithRetry({
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  let raw = completion.choices[0]?.message?.content || "{}";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // Fallback values — nothing should ever be empty per prompt rules,
  // but defensive defaults here in case GPT partially fails.
  // If the LLM didn't return anything usable, fall back to cdrlogo.com,
  // never to the raw form-submitted brand (per: "let llm decide brand no matter what").
  let resolvedBrandFb = (parsed.brand_used && String(parsed.brand_used).trim())
    || providedBrand
    || "cdrlogo.com";

  let resolvedWebsiteFb = (parsed.website_used && String(parsed.website_used).trim())
    || providedWebsite
    || "https://cdrlogo.com";

  let resolvedIndustryFb = (parsed.industry_used && String(parsed.industry_used).trim())
    || providedIndustry
    || "Logo Design & Graphics";

  return {
    brandUsed: resolvedBrandFb,
    websiteUsed: resolvedWebsiteFb,
    industryUsed: resolvedIndustryFb,
    metaTitle: parsed.meta_title || `${logoName} Logo PNG SVG Vector Free Download | cdrlogo.com`,
    metaDescription: parsed.meta_description || `Download ${logoName} logo in PNG, SVG and vector formats for free. Transparent background, high resolution. Available at cdrlogo.com.`,
    description: parsed.main_description || `Download the ${logoName} logo from cdrlogo.com in PNG, SVG, AI, EPS and CDR vector formats. Suitable for websites, presentations, print and apps. High resolution, transparent background available for free.`,
    altText: parsed.alt_text || `${logoName} logo PNG SVG vector format free download cdrlogo.com`,
    history: parsed.history || `Download the ${logoName} logo from cdrlogo.com. Available in PNG, SVG, AI, EPS and CDR vector formats for commercial and personal use.`,
    tags: Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : [logoName, "logo", "PNG", "SVG", "vector", "free download", "transparent", "cdrlogo.com"],
    isVariant,
    relatedSlugs: relatedLogos.map(r => r.slug).filter(Boolean),
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
    let category = formData.get("category") || "";
    let industry = formData.get("industry") || "";
    let country = formData.get("country") || "";
    let license = formData.get("license") || "";
    let publishStatus = formData.get("publishStatus") || "Draft";
    let downloadCount = formData.get("downloadCount") || "unlimited";
    let altText = formData.get("altText") || "";
    let focusKeywords = formData.get("focusKeywords") || "";

    let description = formData.get("description") || "";
    let metaTitle = formData.get("metaTitle") || "";
    let metaDescription = formData.get("metaDescription") || "";
    let history = formData.get("history") || "";

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
    // ── ADDITION 3: declare new SEO vars with safe defaults ───────────────────
    let relatedSlugs = [];
    // canonicalUrl is always cdrlogo.com regardless of env config, and is
    // rebuilt below once finalSlug is settled (after potential auto-versioning).
    let canonicalUrl = `https://cdrlogo.com/logos/${slug}/`;

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
          // update canonicalUrl after versioned slug is finalised
          canonicalUrl = `https://cdrlogo.com/logos/${finalSlug}/`;
        } else {
          console.log(`[4b] No exact matches — this is a new logo, no versioning needed`);
        }

        console.log(`[4c] Calling OpenAI (gpt-4o-mini, temp=0.6)...`);
        let aiContent = await generateAIContent({
          logoName: finalLogoName,
          brand,
          website,
          category,
          industry,
          country,
          relatedLogos: related,
        });
        console.log(`[4c] ✓ AI response received`);
        console.log(`     - brand_used: "${aiContent.brandUsed}"`);
        console.log(`     - website_used: "${aiContent.websiteUsed}"`);
        console.log(`     - industry_used: "${aiContent.industryUsed}"`);
        console.log(`     - meta_title: "${aiContent.metaTitle.substring(0, 60)}"`);
        console.log(`     - tags: ${aiContent.tags.length} generated`);
        console.log(`     - history: ${aiContent.history ? "✓" : "empty"}`);

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

        // The LLM's decided brand, website, and industry always win, regardless of what was submitted.
        brand = aiContent.brandUsed;
        website = aiContent.websiteUsed;
        industry = aiContent.industryUsed;

        if (aiContent.metaTitle) metaTitle = aiContent.metaTitle;
        if (aiContent.metaDescription) metaDescription = aiContent.metaDescription;
        if (aiContent.description) description = aiContent.description;
        if (aiContent.history) history = aiContent.history;
        if (aiContent.altText) altText = aiContent.altText;
        if (aiContent.tags.length) tags = aiContent.tags;
        // capture the two new SEO values from AI response
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
        // AI failed entirely — fall back to cdrlogo.com as the brand/website/industry source,
        // never leave a half-applied or blank brand/website/industry.
        if (!brand || !brand.trim()) brand = "cdrlogo.com";
        if (!website || !website.trim()) website = "https://cdrlogo.com";
        if (!industry || !industry.trim()) industry = "Logo Design & Graphics";
        try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
      }
    } else {
      console.log("[4] AI DISABLED - Using manual fields only");
      // No AI requested — same rule: if no brand/website/industry was submitted, default to cdrlogo.com.
      if (!brand || !brand.trim()) brand = "cdrlogo.com";
      if (!website || !website.trim()) website = "https://cdrlogo.com";
      if (!industry || !industry.trim()) industry = "Logo Design & Graphics";
      try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
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

    // ── 6. upload everything to R2 (with per-file error handling) ────────────
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

    // ── 7. save to DB ─────────────────────────────────────────────────────────
    console.log("[7] Saving logo to database...");
    console.log(`     Final logo name: "${finalLogoName}"`);
    console.log(`     Final slug: "${finalSlug}"`);
    console.log(`     Brand: "${brand}"`);
    console.log(`     Website: "${website}"`);
    console.log(`     Industry: "${industry}"`);
    console.log(`     Tags (${tags.length}): ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`);

    // ── ADDITION 4: build schemaMarkup JSON-LD string before prisma.create ────
    let schemaMarkup = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "name": finalLogoName,
      "contentUrl": svgUrl || webpUrl || "",
      "encodingFormat": svgUrl ? "image/svg+xml" : "image/webp",
      "description": description,
      "thumbnailUrl": webpUrl || "",
      "acquireLicensePage": canonicalUrl,
    });

    let logo = await prisma.logo.create({
      data: {
        logoName: finalLogoName, slug: finalSlug, brand, website, category, industry, country,
        license, description, history, tags, brandColors, publishStatus,
        downloadCount, svgUrl, pngUrl, webpUrl, aiUrl, cdrUrl, svgContent,
        metaTitle, metaDescription, altText, focusKeywords,
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),
        // new SEO fields (require matching Prisma schema fields):
        canonicalUrl,
        relatedSlugs,
        schemaMarkup,
      },
    });
    console.log(`[7] ✓ Logo saved to DB with ID: ${logo.id}`);

    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Logo uploaded successfully: ${finalSlug} (name: "${finalLogoName}")${aiMeta.versioned ? ` [auto-versioned from "${logoName}"]` : ""}${aiMeta.isVariant ? ` (AI variant content based on ${aiMeta.relatedCount} related logo(s))` : useAI ? " (AI-generated content)" : ""}`,
      },
    });

    let duration = Date.now() - startTime;
    console.log(`\n========== UPLOAD-LOGO SUCCESS ==========`);
    console.log(`Total time: ${duration}ms`);
    console.log(`Final Slug: "${finalSlug}"`);
    console.log(`Logo Name: "${finalLogoName}"${aiMeta.versioned ? ` (auto-versioned from "${logoName}")` : ""}`);
    console.log(`Files: ${allUploads.length} total (${publicFiles.length} public, ${privateFiles.length} private)`);
    console.log(`========================================\n`);

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
    console.error(`Time elapsed: ${duration}ms`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
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