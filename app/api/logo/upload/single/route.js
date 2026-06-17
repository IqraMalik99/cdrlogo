import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import OpenAI from "openai";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";

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

// ── Pixel-perfect watermark ───────────────────────────────────────────────────
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
  const stop = new Set(["logo", "version", "the", "and", "of", "new", "old"]);
  return name
    .toLowerCase()
    .replace(/\b(19|20)\d{2}\b/g, "")
    .split(/[^a-z0-9]+/)
    .filter(w => w && !stop.has(w) && !/^v\.?\d+$/.test(w) && !/^\d+$/.test(w));
}

// ── Find related logos by fuzzy/normalized name match ─────────────────────────
// FIX: only version if the FULL normalized name matches, not just a shared word.
// e.g. "Nike" won't trigger versioning for "Nike Air" anymore.
async function findRelatedLogos(logoName) {
  const words = getSignificantWords(logoName);
  if (!words.length) return { related: [], exactNormalizedMatches: [] };

  const candidates = await prisma.logo.findMany({
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
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const targetNorm = normalizeName(logoName);

  // Only exact normalized matches trigger auto-versioning
  const exactNormalizedMatches = candidates.filter(
    c => normalizeName(c.logoName) === targetNorm
  );

  // Related = candidates sharing words, used only for AI context (not versioning)
  const related = candidates.slice(0, 5);

  return { related, exactNormalizedMatches };
}

// ── Generate next version name ────────────────────────────────────────────────
function generateVersionedName(logoName, exactNormalizedMatches) {
  const usedVersions = new Set();

  for (const match of exactNormalizedMatches) {
    const m = match.logoName.match(/\bv(?:ersion)?\.?\s*(\d+)\b/i);
    if (m) {
      usedVersions.add(parseInt(m[1], 10));
    } else {
      usedVersions.add(1);
    }
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
// UPDATED PROMPT (v2):
//  - Removed "shapes, colors" from description requirements (we don't send the image)
//  - Focus is now on brand identity, historical context, industry relevance, and era
//  - Added history field generation
//  - NEW: for versioned/variant logos, we now extract the previous version's
//    opening sentence and explicitly ban it, force a distinct angle (rebrand
//    trigger / market shift / usage context / identity evolution), forbid
//    structural mirroring, and require partial tag divergence — so versioned
//    logos get genuinely unique, non-duplicate SEO content instead of just
//    reworded copies of the prior version.
//  - Temperature raised slightly (0.4 → 0.6) to support that lexical variety;
//    response_format json_object still enforces valid JSON output.
async function generateAIContent({ logoName, brand, category, industry, country, relatedLogos }) {
  const isVariant = relatedLogos.length > 0;

  const relatedContext = isVariant
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

  // Pull the opening sentence/clause of each prior description so we can
  // explicitly ban those openers — this is what actually forces variation,
  // rather than just telling the model "be different" and hoping it complies.
  const usedOpeners = isVariant
    ? relatedLogos
        .map(r => (r.description || "").split(/[.!?]/)[0].trim())
        .filter(Boolean)
    : [];

  const systemPrompt = `You are an expert SEO copywriter specializing in logo and branding content for a logo download website. You write factual, unique, non-generic content grounded in real brand history and industry context. You never invent or guess visual details (colors, shapes, layout) you cannot verify. Every piece of content you write must be structurally and lexically distinct from any prior version shown to you — same facts, different sentences. You always respond with valid JSON only, no markdown formatting, no code fences.`;

  const userPrompt = `Generate SEO content for the following logo entry.

Logo Name: ${logoName}
Brand: ${brand || "N/A"}
Category: ${category || "N/A"}
Industry: ${industry || "N/A"}
Country: ${country || "N/A"}
${isVariant
  ? `\nThis is a variant/new version of an existing logo already published on the site. Below are the previous version(s). Search engines penalize near-duplicate content, so this version's content MUST be unique at the sentence level, not just reworded.

${relatedContext}

UNIQUENESS RULES (mandatory):
1. Do NOT begin main_description with any of these previously-used openers: ${usedOpeners.length ? usedOpeners.map(o => `"${o}"`).join(", ") : "N/A"}.
2. Pick ONE distinct angle for this version that the previous version(s) did NOT lead with — for example: the rebrand/version trigger, a shift in market or industry positioning, a notable usage context, or how the brand's identity strategy evolved. Lead the description with that angle, not a generic brand intro.
3. Vary sentence structure and length from the previous version(s) — do not mirror their paragraph shape or clause order.
4. Do not reuse specific phrases, adjectives, or descriptive combinations from the previous meta_title, meta_description, or description shown above.
5. tags should overlap on core brand/industry terms where accurate, but include at least 3-4 tags not present in the previous version's tag list (e.g. version/year identifiers, more specific industry or use-case terms).`
  : "\nThis is a new logo with no prior versions in the database."}

Requirements:
- main_description: 100-150 words. Write factual, SEO-friendly content about the brand's identity, history, industry relevance, and what era or version this logo represents. Do NOT invent or describe visual details (colors, shapes, typography) — focus only on verifiable brand context, market position, and historical significance.
- history: 40-60 words. A short factual paragraph about the brand's founding, key milestones, and how this logo fits into their timeline. Omit if the brand is not well-known.
- meta_title: Under 60 characters, SEO-optimized, include brand name and relevant keywords.
- meta_description: Under 160 characters, SEO-optimized, compelling and specific to this logo version.
- tags: 10-15 highly relevant SEO keywords as an array (brand name, industry terms, logo type, version/year identifiers, format keywords like "vector", "SVG").

Respond ONLY with valid JSON in this exact format:
{
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

  return {
    metaTitle: parsed.meta_title || "",
    metaDescription: parsed.meta_description || "",
    description: parsed.main_description || "",
    history: parsed.history || "",
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
    isVariant,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  console.log("\n========== UPLOAD-LOGO START ==========");
  const startTime = Date.now();

  try {
    const formData = await req.formData();
    console.log("[1] ✓ Form data received");

    // ── 1. pull fields ────────────────────────────────────────────────────────
    const slug = formData.get("slug")?.trim();
    const logoName = formData.get("logoName")?.trim();
    const brand = formData.get("brand") || "";
    const website = formData.get("website") || "";
    const category = formData.get("category") || "";
    const industry = formData.get("industry") || "";
    const country = formData.get("country") || "";
    const license = formData.get("license") || "";
    const publishStatus = formData.get("publishStatus") || "Draft";
    const downloadCount = formData.get("downloadCount") || "unlimited";
    const altText = formData.get("altText") || "";
    const focusKeywords = formData.get("focusKeywords") || "";

    // Manually entered fields — used as fallback if AI generation fails/disabled
    let description = formData.get("description") || "";
    let metaTitle = formData.get("metaTitle") || "";
    let metaDescription = formData.get("metaDescription") || "";
    let history = formData.get("history") || "";

    let brandColors = [];
    try { brandColors = JSON.parse(formData.get("brandColors") || "[]"); } catch { }

    const useAI = formData.get("useAI") !== "false";

    console.log("[1a] Parsed form fields:");
    console.log(`  slug: "${slug}"`);
    console.log(`  logoName: "${logoName}"`);
    console.log(`  brand: "${brand}"`);
    console.log(`  category: "${category}"`);
    console.log(`  useAI: ${useAI}`);

    // // ── Validation ────────────────────────────────────────────────────────────
    if (!slug) {
      console.log("[1b] ❌ VALIDATION FAILED: slug is required");
      return NextResponse.json({ error: "slug is required." }, { status: 400 });
    }
    if (!logoName) {
      console.log("[1b] ❌ VALIDATION FAILED: logoName is required");
      return NextResponse.json({ error: "logoName is required." }, { status: 400 });
    }
    console.log("[1b] ✓ Basic validation passed");

    // ── Check slug uniqueness (RESTORED) ─────────────────────────────────────
    // console.log("[1c] Checking slug uniqueness...");
    // const existing = await prisma.logo.findUnique({ where: { slug } });
    // if (existing) {
    //   console.log(`[1c] ❌ Slug already exists: "${slug}"`);
    //   return NextResponse.json(
    //     { error: `Slug "${slug}" is already taken. Please use a different slug.` },
    //     { status: 409 }
    //   );
    // }
    // console.log("[1c] ✓ Slug is unique");

    // ── 2. collect ZIP files ──────────────────────────────────────────────────
    console.log("[2] Collecting ZIP files...");
    const zipFiles = formData.getAll("files");
    if (!zipFiles.length) {
      console.log("[2] ❌ No ZIP files found");
      return NextResponse.json({ error: "No ZIP file uploaded." }, { status: 400 });
    }
    console.log(`[2] ✓ Found ${zipFiles.length} ZIP file(s)`);

    // ── 3. fetch watermark settings from DB ───────────────────────────────────
    console.log("[3] Fetching watermark settings...");
    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;
    console.log(`[3] ✓ Watermark config: ${watermark?.enabled ? "ENABLED" : "DISABLED"}`);

    // ── 4. AI content generation ──────────────────────────────────────────────
    let tags = [];
    let aiMeta = { isVariant: false };
    let finalLogoName = logoName;
    let finalSlug = slug;

    if (useAI) {
      console.log("[4] AI GENERATION ENABLED - Starting process...");
      try {
        console.log(`[4a] Finding related logos for "${logoName}"...`);
        const { related, exactNormalizedMatches } = await findRelatedLogos(logoName);
        console.log(`[4a] ✓ Found ${related.length} related logo(s), ${exactNormalizedMatches.length} exact normalized match(es)`);

        // FIX: only auto-version on exact normalized matches, not loose word matches
        if (exactNormalizedMatches.length > 0) {
          console.log(`[4b] Exact matches found — auto-versioning LOGO NAME...`);
          exactNormalizedMatches.forEach((m, i) => {
            console.log(`     ${i + 1}. "${m.logoName}"`);
          });
          finalLogoName = generateVersionedName(logoName, exactNormalizedMatches);
          finalSlug = generateSlugFromName(finalLogoName);
          console.log(`[4b] ✓ Logo name: "${logoName}" → "${finalLogoName}"`);
          console.log(`[4b] ✓ Slug: "${slug}" → "${finalSlug}"`);

          // Re-check that the new auto-versioned slug is also unique
          const versionedSlugExists = await prisma.logo.findUnique({ where: { slug: finalSlug } });
          if (versionedSlugExists) {
            console.log(`[4b] ❌ Auto-versioned slug "${finalSlug}" already exists`);
            return NextResponse.json(
              { error: `Auto-versioned slug "${finalSlug}" is already taken. Please upload again or check existing logos.` },
              { status: 409 }
            );
          }
        } else {
          console.log(`[4b] No exact matches — this is a new logo, no versioning needed`);
        }

        console.log(`[4c] Calling OpenAI (gpt-4o-mini, temp=0.6)...`);
        const aiContent = await generateAIContent({
          logoName: finalLogoName,
          brand,
          category,
          industry,
          country,
          relatedLogos: related,
        });
        console.log(`[4c] ✓ AI response received`);
        console.log(`     - meta_title: "${aiContent.metaTitle.substring(0, 60)}"`);
        console.log(`     - tags: ${aiContent.tags.length} generated`);
        console.log(`     - history: ${aiContent.history ? "✓" : "empty"}`);

        aiMeta = {
          isVariant: aiContent.isVariant,
          relatedCount: related.length,
          originalLogoName: logoName,
          finalLogoName,
          versioned: finalLogoName !== logoName,
        };

        if (aiContent.metaTitle) metaTitle = aiContent.metaTitle;
        if (aiContent.metaDescription) metaDescription = aiContent.metaDescription;
        if (aiContent.description) description = aiContent.description;
        if (aiContent.history) history = aiContent.history;
        if (aiContent.tags.length) tags = aiContent.tags;
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
        try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
      }
    } else {
      console.log("[4] AI DISABLED - Using manual fields only");
      try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
    }

    if (!description) {
      console.log("[4] ❌ No description found");
      return NextResponse.json({ error: "description is required (AI generation may have failed)." }, { status: 400 });
    }
    console.log("[4] ✓ Description present");

    // ── 5. process every ZIP ──────────────────────────────────────────────────
    console.log("[5] Processing ZIP contents...");
    const publicFiles = [];
    const privateFiles = [];
    let svgContent = null;

    const fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };

    for (const zipFile of zipFiles) {
      const arrayBuffer = await zipFile.arrayBuffer();
      const zip = new AdmZip(Buffer.from(arrayBuffer));

      for (const entry of zip.getEntries()) {
        if (entry.isDirectory) continue;

        const filename = entry.entryName.split("/").pop();
        const fileExt = ext(filename);
        const fileBuffer = entry.getData();
        const fileSize = (fileBuffer.length / 1024).toFixed(2);

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

          const watermarked = await applyWatermark(fileBuffer, watermark);
          const webpBuffer = await sharp(watermarked).webp({ quality: 90 }).toBuffer();
          const webpName = filename.replace(/\.png$/i, ".webp");
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
    const allUploads = [...publicFiles, ...privateFiles];

    const uploadResults = await Promise.all(
      allUploads.map(async ({ key, buffer, contentType }) => {
        try {
          console.log(`     Uploading: ${key}`);
          return await uploadToR2({ fileBuffer: buffer, fileName: key, mimeType: contentType });
        } catch (err) {
          console.error(`     ❌ Failed to upload: ${key} — ${err.message}`);
          return null; // don't let one failure kill the whole batch
        }
      })
    );

    const urlMap = {};
    allUploads.forEach(({ key }, i) => { urlMap[key] = uploadResults[i]; });

    const failedUploads = allUploads.filter((_, i) => !uploadResults[i]);
    if (failedUploads.length) {
      console.warn(`[6] ⚠ ${failedUploads.length} file(s) failed to upload: ${failedUploads.map(f => f.key).join(", ")}`);
    }
    console.log(`[6] ✓ Upload complete (${allUploads.length - failedUploads.length}/${allUploads.length} succeeded)`);

    const findUrl = (predicate) => {
      const match = allUploads.find(predicate);
      return match ? urlMap[match.key] : null;
    };

    const svgUrl = findUrl(f => f.key.endsWith(".svg"));
    const pngUrl = findUrl(f => f.key.endsWith(".png"));
    const webpUrl = findUrl(f => f.key.endsWith(".webp"));
    const aiUrl = findUrl(f => f.key.endsWith(".ai"));
    const cdrUrl = findUrl(f => f.key.endsWith(".cdr"));

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
    console.log(`     Tags (${tags.length}): ${tags.slice(0, 5).join(", ")}${tags.length > 5 ? "..." : ""}`);

    const logo = await prisma.logo.create({
      data: {
        logoName: finalLogoName, slug: finalSlug, brand, website, category, industry, country,
        license, description, history, tags, brandColors, publishStatus,
        downloadCount, svgUrl, pngUrl, webpUrl, aiUrl, cdrUrl, svgContent,
        metaTitle, metaDescription, altText, focusKeywords,
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),
      },
    });
    console.log(`[7] ✓ Logo saved to DB with ID: ${logo.id}`);

    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Logo uploaded successfully: ${finalSlug} (name: "${finalLogoName}")${aiMeta.versioned ? ` [auto-versioned from "${logoName}"]` : ""}${aiMeta.isVariant ? ` (AI variant content based on ${aiMeta.relatedCount} related logo(s))` : useAI ? " (AI-generated content)" : ""}`,
      },
    });

    const duration = Date.now() - startTime;
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
    const duration = Date.now() - startTime;
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