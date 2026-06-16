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

/**
 * Derive a human-readable logo name from the folder name.
 * Strips a leading numeric prefix (e.g. "01 ", "02 ") then Title Cases the rest.
 *
 * Examples:
 *   "01 cdr logo"              → "Cdr Logo"
 *   "04 TIMNAS INDONESIA 2025" → "Timnas Indonesia 2025"
 *   "05 Olympique de Marseille"→ "Olympique De Marseille"
 */
function logoNameFromFolderName(folderName) {
  return folderName
    .replace(/^\d+\s+/, "")                    // strip leading number + spaces
    .replace(/[-_]+/g, " ")                    // hyphens/underscores → spaces
    .replace(/\b\w/g, (c) => c.toUpperCase()) // Title Case
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
async function generateAIContent({ logoName, category, relatedLogos }) {
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

  const systemPrompt = `You are an expert SEO copywriter specializing in logo and branding content for a logo download website. You write factual, unique, non-generic content grounded in real brand history and industry context. You never invent or guess visual details (colors, shapes) you cannot verify. You always respond with valid JSON only, no markdown formatting, no code fences.`;

  const userPrompt = `Generate SEO content for the following logo entry.

Logo Name: ${logoName}
Category: ${category || "N/A"}
${
  isVariant
    ? `\nThis is a variant/new version of an existing logo. Below are the previous version(s) already published. Write NEW, DIFFERENT content for THIS version — do not repeat the same wording. Focus on what makes this version distinct: its era, any known rebranding events, market context, and how the brand identity evolved.\n\n${relatedContext}`
    : "\nThis is a new logo with no prior versions in the database."
}

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
    temperature: 0.4,
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

// ── Process one logo folder ───────────────────────────────────────────────────
// folderName  : raw folder name from ZIP (e.g. "01 cdr logo")
// folderFiles : [{ filename, buffer }]  — only the files inside that folder
async function processOneLogoFolder({
  folderName,
  folderFiles,
  sharedFields,   // { category, license, publishStatus, downloadCount, brandColors }
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

    // ── Step B: AI content generation ─────────────────────────────────────────
    const aiContent = await generateAIContent({
      logoName: finalLogoName,
      category: sharedFields.category,
      relatedLogos: related,
    });
    console.log(`  [ai] metaTitle: "${aiContent.metaTitle}" | tags: ${aiContent.tags.length}`);

    // ── Step C: classify & process files ──────────────────────────────────────
    const publicFiles = [];
    const privateFiles = [];
    let svgContent = null;
    const fileSizes = { svg: 0, png: 0, ai: 0, cdr: 0 };

    for (const { filename, buffer: fileBuffer } of folderFiles) {
      const fileExt = ext(filename);

      // ── ignore HTML / HTM files entirely ──────────────────────────────────
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
        // unknown types go to private misc
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

    // ── Step E: save to DB ────────────────────────────────────────────────────
    const logo = await prisma.logo.create({
      data: {
        logoName: finalLogoName,
        slug: finalSlug,
        brand: "",
        website: "",
        category: sharedFields.category,
        industry: "",
        country: "",
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
      },
    });

    console.log(`  [db] ✓ Saved ID: ${logo.id}`);

    return {
      success: true,
      logoName: finalLogoName,
      slug: finalSlug,
      versioned,
      originalName: rawLogoName,
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

    // ── Shared fields ─────────────────────────────────────────────────────────
    const category      = formData.get("category") || "";
    const license       = formData.get("license") || "";
    const publishStatus = formData.get("publishStatus") || "Draft";
    const downloadCount = formData.get("downloadCount") || "unlimited";

    let brandColors = [];
    try { brandColors = JSON.parse(formData.get("brandColors") || "[]"); } catch {}

    if (!category) {
      return NextResponse.json(
        { error: "Category is required for bulk upload." },
        { status: 400 }
      );
    }

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
    // Structure expected: <folder-name>/<file>  (one level deep)
    // We ignore __MACOSX, hidden folders, and any loose root-level files.
    const folderMap = new Map(); // folderName → [{ filename, buffer }]

    for (const entry of allEntries) {
      if (entry.isDirectory) continue;

      const parts = entry.entryName.split("/").filter(Boolean);

      // Must be at least 2 parts: folder/file
      if (parts.length < 2) {
        console.log(`[skip] Root-level file ignored: ${entry.entryName}`);
        continue;
      }

      const topFolder = parts[0];

      // Skip macOS metadata and hidden folders
      if (topFolder.startsWith("__MACOSX") || topFolder.startsWith(".")) continue;

      const filename = parts[parts.length - 1];

      // Skip hidden files
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

    // ── Watermark settings ────────────────────────────────────────────────────
    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;
    console.log(`[3] Watermark: ${watermark?.enabled ? "ENABLED" : "DISABLED"}`);

    const sharedFields = { category, license, publishStatus, downloadCount, brandColors };

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
            ? `Bulk upload ✓ "${result.logoName}" (slug: ${result.slug})${result.versioned ? ` [auto-versioned from "${result.originalName}"]` : ""}`
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