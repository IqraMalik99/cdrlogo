import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const DEFAULT_WEBSITE = "cdrlogo.com";

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
    case "top-left":      tx = pad;                         ty = pad;               break;
    case "top-right":     tx = W - pad - textW;             ty = pad;               break;
    case "top-center":    tx = Math.round((W - textW) / 2); ty = pad;               break;
    case "bottom-left":   tx = pad;                         ty = H - pad - textH;   break;
    case "bottom-right":  tx = W - pad - textW;             ty = H - pad - textH;   break;
    case "bottom-center": tx = Math.round((W - textW) / 2); ty = H - pad - textH;  break;
    case "center":
    default:              tx = Math.round((W - textW) / 2); ty = Math.round((H - textH) / 2); break;
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

// ── Normalize Website.categories into a flat list of category names ──────────
function extractCategoryNames(categoriesJson) {
  if (!categoriesJson) return [];

  let list = categoriesJson;
  if (typeof list === "string") {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];

  return list
    .map((c) => {
      if (typeof c === "string") return c;
      if (c && typeof c === "object") return c.name || c.title || c.label || c.slug || null;
      return null;
    })
    .filter(Boolean);
}

// ── DB: find related / exact matches ──────────────────────────────────────────
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
      // needed to build relatedSlugs, matching single-upload behavior
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

// ── AI content generation ─────────────────────────────────────────────────────
// Generates: category, brand, website, country, industry + SEO fields.
// Category is fetched from DB (Website.categories) and AI must pick from that list.
// brand/country/industry are FORCED — the model must always decide a real
// value (falling back to cdrlogo.com-style defaults only as an absolute last
// resort), matching single-upload behavior. website remains confidence-gated:
// it is only filled when the model is genuinely sure, otherwise left empty.
async function generateAIContent({
  logoName,
  userCategory,        // uploader's hint (may be "")
  availableCategories, // string[] from Website.categories in DB
  relatedLogos,
}) {
  const isVariant = relatedLogos.length > 0;

  const relatedContext = isVariant
    ? relatedLogos
        .slice(0, 5)
        .map(
          (r, i) =>
            `Previous version ${i + 1}:\n- Name: ${r.logoName}\n- Category: ${r.category || "N/A"}\n- Brand: ${r.brand || "N/A"}\n- Website: ${r.website || "N/A"}\n- Country: ${r.country || "N/A"}\n- Industry: ${r.industry || "N/A"}\n- Meta Title: ${r.metaTitle || "N/A"}\n- Meta Description: ${r.metaDescription || "N/A"}\n- Description: ${r.description || "N/A"}\n- Tags: ${Array.isArray(r.tags) ? r.tags.join(", ") : "N/A"}`
        )
        .join("\n\n")
    : "";

  const usedOpeners = isVariant
    ? relatedLogos
        .map((r) => (r.description || "").split(/[.!?]/)[0].trim())
        .filter(Boolean)
    : [];

  const hasCategoryList = availableCategories.length > 0;

  const systemPrompt = `You are a senior SEO specialist for a professional logo download website (cdrlogo.com). Your job is to write SEO content that ranks for queries like "Nike logo PNG download", "Apple logo SVG vector free", "brand logo transparent background", AND to classify each logo's category, brand, country, and industry. If the brand/company is not explicitly given to you, you must infer/decide the most likely real-world brand from the logo name yourself — never invent a placeholder brand and never leave it blank. You must also determine the brand's real industry/sector and home country based on what you actually know about that brand — never leave these as vague placeholders if a real brand was identified. You are only conservative about the brand's official WEBSITE URL specifically: only fill it in if you are genuinely confident, otherwise leave it as an empty string — getting a wrong domain is worse than no domain. Every other field you return must always be filled — no empty strings, no "N/A". If, after your best effort, no real brand can be identified at all, use "cdrlogo.com" as the brand, "Logo Design & Graphics" as the industry, and "Worldwide" as the country — and leave website empty. You always return valid JSON only — no markdown, no code fences, no commentary.`;

  const userPrompt = `Generate SEO content and metadata for the following logo entry on cdrlogo.com.

Logo Name: ${logoName}
Uploader-selected category (hint, may be wrong or missing): ${userCategory || "(none provided)"}
${
  hasCategoryList
    ? `\nAvailable categories on this site (you MUST choose exactly one of these, copying the string exactly as written — do not invent a new category, do not modify spelling/casing):\n${availableCategories.map((c) => `- ${c}`).join("\n")}`
    : `\nNo category list is configured on this site. Use the uploader-selected category as-is, or your best single-word/short-phrase classification if none was provided.`
}
${
  isVariant
    ? `\nThis is a variant/new version of an existing logo. Below are the previous version(s) already published. Write NEW, DIFFERENT content for THIS version — do not repeat the same wording. Focus on what makes this version distinct: its era, any known rebranding events, market context, and how the brand identity evolved.\n\n${relatedContext}\n\nPreviously used description openers (DO NOT reuse any): ${usedOpeners.length ? usedOpeners.map((o) => `"${o}"`).join(", ") : "none"}`
    : "\nThis is a new logo with no prior versions in the database."
}

Requirements:
- category: ${hasCategoryList ? "Pick the single best-fitting category from the provided list above, copied exactly. If the uploader's hint matches one of the list items, prefer it unless another item in the list is clearly a better fit for this specific logo." : "Best classification as described above."}
- brand: The real-world brand/company/organization this logo belongs to. Infer/decide this yourself from the logo name whenever it isn't obvious — never leave it blank. Only use "cdrlogo.com" if you genuinely cannot identify any real brand at all.
- website: The brand's real official website domain (e.g. "nike.com"). ONLY fill this if you are highly confident. If you are not fully confident about the exact official site, return an empty string "" — do not guess.
- country: The country the brand/organization is primarily associated with or headquartered in (e.g. "United States", "Indonesia", "United Kingdom"). Use the brand's real home country, decided yourself from your knowledge of the brand — do not guess from visual style, language, or filename alone. Always provide your best real answer; only use "Worldwide" if you genuinely could not identify any real brand at all.
- industry: The primary industry or sector this brand operates in. Be specific (e.g. "Sportswear & Athletic Apparel", "Fast Food", "Automotive Manufacturing"), not a vague placeholder like "General" or "Retail". Decide this yourself based on what the brand actually does. Only use "Logo Design & Graphics" if you genuinely could not identify any real brand.
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
- history: 40-60 words. A short factual paragraph about the brand's founding, key milestones, and how this logo fits into their timeline. If the brand is unknown or very obscure, instead write: "Download the ${logoName} logo from cdrlogo.com. Available in PNG, SVG, AI, EPS and CDR vector formats for commercial and personal use." NEVER leave empty.
- meta_title: STRICT 50-60 characters, NEVER exceed 60. Format: "{Brand} Logo PNG SVG Vector Free Download | cdrlogo.com". Always include the brand name + at least TWO of: PNG, SVG, Vector, Download, Free. End with "| cdrlogo.com" (counts toward the 60-char limit, so keep the brand part short). NEVER leave empty.
- tags: 12-15 items as an array. Must include: brand/logo name, "PNG", "SVG", "vector", "free download", "transparent", an industry term, "logo download", "cdrlogo.com". Add format variants ("AI file", "EPS", "CDR") where relevant. NEVER return an empty array.

Respond ONLY with valid JSON in this exact format:
{
  "category": "...",
  "brand": "...",
  "website": "...",
  "country": "...",
  "industry": "...",
  "meta_title": "...",
  "meta_description": "...",
  "main_description": "...",
  "history": "...",
  "tags": ["...", "...", ...]
}`;

  const completion = await callOpenAIWithRetry({
    model: "gpt-4o-mini",
    temperature: 0.6,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  // ── Resolve category: must be one of availableCategories if that list exists ──
  // (unchanged — this DB-driven category logic stays exactly as before)
  let resolvedCategory = String(parsed.category || "").trim();
  if (hasCategoryList) {
    const match = availableCategories.find(
      (c) => c.toLowerCase() === resolvedCategory.toLowerCase()
    );
    if (match) {
      resolvedCategory = match; // use the exact stored casing/spelling
    } else {
      // AI didn't return a valid list item — fall back to uploader's hint,
      // then to the first available category, never an invented value.
      resolvedCategory =
        availableCategories.find(
          (c) => c.toLowerCase() === String(userCategory || "").toLowerCase()
        ) || userCategory || availableCategories[0];
    }
  } else if (!resolvedCategory) {
    resolvedCategory = userCategory || "";
  }

  // ── Resolve brand/country/industry — FORCED, never empty (matches single-upload) ──
  // Only website remains confidence-gated and may legitimately stay empty.
  const brand    = (parsed.brand    && String(parsed.brand).trim())    || "cdrlogo.com";
  const country  = (parsed.country  && String(parsed.country).trim())  || "Worldwide";
  const industry = (parsed.industry && String(parsed.industry).trim()) || "Logo Design & Graphics";

  // Website stays confidence-gated: empty string if the model wasn't sure.
  // Do NOT default this to cdrlogo.com — leaving it blank is intentional here.
  const website = (parsed.website && String(parsed.website).trim()) || "";

  return {
    category: resolvedCategory,
    brand,
    website,
    country,
    industry,
    metaTitle:       parsed.meta_title        || `${logoName} Logo PNG SVG Vector Free Download | cdrlogo.com`,
    metaDescription: parsed.meta_description  || `Download ${logoName} logo in PNG, SVG and vector formats for free. Transparent background, high resolution. Available at cdrlogo.com.`,
    description:     parsed.main_description  || `Download the ${logoName} logo from cdrlogo.com in PNG, SVG, AI, EPS and CDR vector formats. Suitable for websites, presentations, print and apps. High resolution, transparent background available for free.`,
    history:         parsed.history           || `Download the ${logoName} logo from cdrlogo.com. Available in PNG, SVG, AI, EPS and CDR vector formats for commercial and personal use.`,
    tags:            Array.isArray(parsed.tags) && parsed.tags.length ? parsed.tags : [logoName, "logo", "PNG", "SVG", "vector", "free download", "transparent", "cdrlogo.com"],
    isVariant,
    relatedSlugs:    relatedLogos.map((r) => r.slug).filter(Boolean),
  };
}

// ── Process one logo folder ───────────────────────────────────────────────────
async function processOneLogoFolder({
  folderName,
  folderFiles,
  sharedFields,   // { category, license, publishStatus, downloadCount, brandColors, availableCategories }
  watermark,
}) {
  const rawLogoName = logoNameFromFolderName(folderName);
  console.log(`\n  ── Processing folder: "${folderName}" → "${rawLogoName}"`);

  try {
    // ── Step A: resolve final name & slug (auto-versioning) ───────────────────
    const { related, exactNormalizedMatches } = await findRelatedLogos(rawLogoName);

    let finalLogoName = rawLogoName;
    let versioned = false;

    if (exactNormalizedMatches.length > 0) {
      finalLogoName = generateVersionedName(rawLogoName, exactNormalizedMatches);
      versioned = true;
      console.log(`  [name] Auto-versioned: "${rawLogoName}" → "${finalLogoName}"`);
    }

    const finalSlug = generateSlugFromName(finalLogoName);
    console.log(`  [slug] ${finalSlug}`);

    // canonicalUrl is always cdrlogo.com, matching single-upload behavior.
    const canonicalUrl = `https://cdrlogo.com/logos/${finalSlug}/`;

    // ── Step B: AI content generation ────────────────────────────────────────
    // Category is fetched from DB via sharedFields.availableCategories.
    // brand, country, industry are LLM-generated and forced (never empty).
    // website remains confidence-gated and may legitimately be empty.
    const aiContent = await generateAIContent({
      logoName: finalLogoName,
      userCategory: sharedFields.category,
      availableCategories: sharedFields.availableCategories,
      relatedLogos: related,
    });
    console.log(
      `  [ai] category: "${aiContent.category}" | brand: "${aiContent.brand}" | website: "${aiContent.website || "(none)"}" | country: "${aiContent.country || "(none)"}" | industry: "${aiContent.industry}" | metaTitle: "${aiContent.metaTitle}" | tags: ${aiContent.tags.length}`
    );

    // ── Step C: classify & process files ──────────────────────────────────────
    const publicFiles = [];
    const privateFiles = [];
    let svgContent = null;
    const fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };

    for (const { filename, buffer: fileBuffer } of folderFiles) {
      const fileExt = ext(filename);

      if (fileExt === "html" || fileExt === "htm") {
        console.log(`  [skip] Ignoring HTML file: ${filename}`);
        continue;
      }

      const fileSize = (fileBuffer.length / 1024).toFixed(2);
      console.log(`  [file] ${filename} (${fileSize} KB)`);

      if (fileExt === "svg") {
        privateFiles.push({
          key: `separate/${finalSlug}/${filename}`,
          buffer: fileBuffer,
          contentType: mime(filename),
        });
        fileSizes.svg = fileBuffer.length;
        if (!svgContent) svgContent = fileBuffer.toString("utf-8");

      } else if (fileExt === "png") {
        privateFiles.push({
          key: `separate/${finalSlug}/${filename}`,
          buffer: fileBuffer,
          contentType: mime(filename),
        });
        fileSizes.png = fileBuffer.length;

        const watermarked = await applyWatermark(fileBuffer, watermark);
        const webpBuffer = await sharp(watermarked).webp({ quality: 90 }).toBuffer();
        const webpName = filename.replace(/\.png$/i, ".webp");
        publicFiles.push({
          key: `public/${finalSlug}/${webpName}`,
          buffer: webpBuffer,
          contentType: "image/webp",
        });

      } else if (fileExt === "ai") {
        privateFiles.push({
          key: `separate/${finalSlug}/${filename}`,
          buffer: fileBuffer,
          contentType: mime(filename),
        });
        fileSizes.ai = fileBuffer.length;

      } else if (fileExt === "cdr") {
        privateFiles.push({
          key: `separate/${finalSlug}/${filename}`,
          buffer: fileBuffer,
          contentType: mime(filename),
        });
        fileSizes.cdr = fileBuffer.length;

      } else {
        privateFiles.push({
          key: `private/${finalSlug}/${filename}`,
          buffer: fileBuffer,
          contentType: mime(filename),
        });
      }
    }

    // ── Step D: upload to R2 ──────────────────────────────────────────────────
    const allUploads = [...publicFiles, ...privateFiles];
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

    const svgUrl  = findUrl((f) => f.key.endsWith(".svg"));
    const pngUrl  = findUrl((f) => f.key.endsWith(".png"));
    const webpUrl = findUrl((f) => f.key.endsWith(".webp"));
    const aiUrl   = findUrl((f) => f.key.endsWith(".ai"));
    const cdrUrl  = findUrl((f) => f.key.endsWith(".cdr"));

    // ── schemaMarkup: same ImageObject JSON-LD shape as single-upload ─────────
    const schemaMarkup = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "ImageObject",
      "name": finalLogoName,
      "contentUrl": svgUrl || webpUrl || "",
      "encodingFormat": svgUrl ? "image/svg+xml" : "image/webp",
      "description": aiContent.description,
      "thumbnailUrl": webpUrl || "",
      "acquireLicensePage": canonicalUrl,
    });

    // ── Step E: save to DB ────────────────────────────────────────────────────
    const logo = await prisma.logo.create({
      data: {
        logoName: finalLogoName,
        slug: finalSlug,
        brand:    aiContent.brand,
        website:  aiContent.website,
        category: aiContent.category,
        industry: aiContent.industry,   // ← now LLM-generated, no longer ""
        country:  aiContent.country,
        license: sharedFields.license,
        description: aiContent.description,
        history: aiContent.history,
        tags: aiContent.tags,
        brandColors: sharedFields.brandColors,
        publishStatus: sharedFields.publishStatus,
        downloadCount: sharedFields.downloadCount,
        svgUrl, pngUrl, webpUrl, aiUrl, cdrUrl, svgContent,
        metaTitle: aiContent.metaTitle,
        metaDescription: aiContent.metaDescription,
        altText: "",
        focusKeywords: "",
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),
        // new SEO fields, matching single-upload:
        canonicalUrl,
        relatedSlugs: aiContent.relatedSlugs,
        schemaMarkup,
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
      brand:    aiContent.brand,
      website:  aiContent.website,
      country:  aiContent.country,
      industry: aiContent.industry,
      canonicalUrl,
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

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  console.log("\n========== BULK-UPLOAD START ==========");
  const startTime = Date.now();

  try {
    const formData = await req.formData();

    const category      = formData.get("category") || "";
    const license       = formData.get("license") || "";
    const publishStatus = formData.get("publishStatus") || "Draft";
    const downloadCount = formData.get("downloadCount") || "unlimited";

    let brandColors = [];
    try { brandColors = JSON.parse(formData.get("brandColors") || "[]"); } catch {}

    // ── Wrapper ZIP ───────────────────────────────────────────────────────────
    const wrapperFile = formData.get("file");
    if (!wrapperFile) {
      return NextResponse.json({ error: "No ZIP file uploaded." }, { status: 400 });
    }

    console.log(`[1] Wrapper ZIP received: ${wrapperFile.name}`);

    const wrapperBuffer = Buffer.from(await wrapperFile.arrayBuffer());
    const wrapperZip = new AdmZip(wrapperBuffer);
    const allEntries = wrapperZip.getEntries();

    // ── Group files by top-level folder ───────────────────────────────────────
    const folderMap = new Map();

    for (const entry of allEntries) {
      if (entry.isDirectory) continue;

      const parts = entry.entryName.split("/").filter(Boolean);

      if (parts.length < 2) {
        console.log(`[skip] Root-level file ignored: ${entry.entryName}`);
        continue;
      }

      const topFolder = parts[0];
      if (topFolder.startsWith("__MACOSX") || topFolder.startsWith(".")) continue;

      const filename = parts[parts.length - 1];
      if (filename.startsWith(".")) continue;

      if (!folderMap.has(topFolder)) folderMap.set(topFolder, []);
      folderMap.get(topFolder).push({ filename, buffer: entry.getData() });
    }

    if (folderMap.size === 0) {
      return NextResponse.json(
        { error: "No logo folders found inside the ZIP. Each logo must be in its own sub-folder." },
        { status: 400 }
      );
    }

    console.log(`[2] Found ${folderMap.size} logo folder(s):`);
    for (const [name] of folderMap) console.log(`     - ${name}`);

    // ── Fetch Website settings: watermark + category list from DB ────────────
    // availableCategories is passed into AI so it picks from this list.
    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;
    const availableCategories = extractCategoryNames(websiteRecord?.categories);

    console.log(`[3] Watermark: ${watermark?.enabled ? "ENABLED" : "DISABLED"}`);
    console.log(
      `[3] Site categories (from DB): ${availableCategories.length ? availableCategories.join(", ") : "(none configured)"}`
    );

    const sharedFields = {
      category,           // uploader hint
      license,
      publishStatus,
      downloadCount,
      brandColors,
      availableCategories, // ← DB category list fed into AI per-logo
    };

    // ── Process each folder sequentially ─────────────────────────────────────
    const results = [];
    let successCount = 0;
    let failCount = 0;
    let idx = 0;

    for (const [folderName, folderFiles] of folderMap) {
      idx++;
      console.log(`\n[${idx}/${folderMap.size}] Folder: "${folderName}" (${folderFiles.length} file(s))`);

      const result = await processOneLogoFolder({
        folderName,
        folderFiles,
        sharedFields,
        watermark,
      });

      results.push(result);
      if (result.success) successCount++;
      else failCount++;

      // ── Audit log ──────────────────────────────────────────────────────────
      await prisma.log.create({
        data: {
          who: "api:bulk-upload-logo",
          content: result.success
            ? `Bulk upload ✓ "${result.logoName}" (slug: ${result.slug}, category: ${result.category}, brand: ${result.brand || "—"}, website: ${result.website || "—"}, country: ${result.country || "—"}, industry: ${result.industry || "—"})${result.versioned ? ` [auto-versioned from "${result.originalName}"]` : ""}`
            : `Bulk upload ❌ "${result.logoName}": ${result.error}`,
        },
      });
    }

    const duration = Date.now() - startTime;
    console.log(`\n========== BULK-UPLOAD DONE ==========`);
    console.log(`Total: ${folderMap.size} | Success: ${successCount} | Failed: ${failCount}`);
    console.log(`Time: ${duration}ms`);
    console.log(`======================================\n`);

    return NextResponse.json({
      message: `Bulk upload complete. ${successCount} succeeded, ${failCount} failed.`,
      total: folderMap.size,
      successCount,
      failCount,
      results,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n========== BULK-UPLOAD ERROR ==========`);
    console.error(`Time elapsed: ${duration}ms`);
    console.error(`Error: ${error.message}`);
    console.error(`Stack: ${error.stack}`);
    console.error(`=======================================\n`);

    await prisma.log.create({
      data: {
        who: "api:bulk-upload-logo",
        content: `Bulk upload fatal error: ${error?.message}`,
      },
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}