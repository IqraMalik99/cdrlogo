// app/api/admin/regenerate-previews/route.js
//
// SIRF HORIZONTAL logos ke previews dobara banata hai, side spacing kam karke:
//   1) Square 1200x1200 WebP -> usi key par OVERWRITE (webpUrl same rehta hai)
//   2) OG     1200x630  WebP -> "<name>-og.webp" par OVERWRITE
//
// Horizontal kaise pata chalta hai: original PNG ko trim karke width/height ratio nikalte hain.
// ratio >= minRatio (default 1.3) -> horizontal -> regenerate.
// Baaki logos (square / vertical) skip hote hain, kuch upload/update nahi hota.
//
// Touch NAHI hota: pngUrl, svgUrl, aiUrl, cdrUrl, file sizes, svgContent,
// description, meta, tags, FAQ, category, brand, publishStatus, webpUrl.
// DB update sirf tab hota hai jab ogImageUrl / twitterImage pehle se set na ho.
//
// POST body (sab optional):
//   {
//     "cursor": "<last id from previous response>",
//     "limit": 5,                    // 1-10 (production), default 5
//     "dryRun": false,               // true = sirf report (PNG padhta hai, upload/update nahi)
//     "slug": "samsung-wallet-logo", // sirf ek logo test karne ke liye
//     "minRatio": 1.3,               // width/height iske barabar ya zyada ho to horizontal
//     "padX": 0.04,                  // left/right padding (4%). Kam karna ho to 0.02
//     "padY": 0.12,                  // top/bottom padding (12%)
//     "updateSchemaDomain": false    // true = imageObjectSchema ke url/contentUrl ko webpUrl par set karo
//   }

import { NextResponse } from "next/server";
import sharp from "sharp";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { uploadToR2 } from "../../../../../lib/uploadToR2";
import { prisma } from "../../../../../lib/prisma";
import { r2 } from "../../../../../lib/r2";

export const maxDuration = 60;

// ── Config ────────────────────────────────────────────────────────────────────
const DEFAULT_PAD_X = 0.04;   // left/right 4% (pehle 12% tha)
const DEFAULT_PAD_Y = 0.12;   // top/bottom 12%
const DEFAULT_MIN_RATIO = 1.3; // width/height >= 1.3 => horizontal
const SQUARE = { width: 1200, height: 1200 };
const OG = { width: 1200, height: 630 };

// ── Watermark helpers (upload route jaisa hi, taaki purane/naye previews match karein)
function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

// ── Trim: transparent / solid-color margin hata do, phir size batao ──────────
async function trimLogo(pngBuffer) {
  let trimmed = pngBuffer;
  try {
    trimmed = await sharp(pngBuffer).trim({ threshold: 10 }).toBuffer();
  } catch {
    trimmed = pngBuffer;
  }
  const meta = await sharp(trimmed).metadata();
  return { buffer: trimmed, width: meta.width || 1, height: meta.height || 1 };
}

// ── Preview builder: logo white canvas ke center mein, no stretch / no crop ──
// padX = left/right, padY = top/bottom (fraction of canvas size)
async function buildPreviewWebp(trimmedBuffer, width, height, padX, padY, watermark) {
  const innerW = Math.max(1, Math.round(width * (1 - padX * 2)));
  const innerH = Math.max(1, Math.round(height * (1 - padY * 2)));

  const resizedLogo = await sharp(trimmedBuffer)
    .resize(innerW, innerH, { fit: "inside", withoutEnlargement: false })
    .png()
    .toBuffer();

  const canvasPng = await sharp({
    create: { width, height, channels: 3, background: "#ffffff" },
  })
    .composite([{ input: resizedLogo, gravity: "center" }])
    .png()
    .toBuffer();

  const finalPng = await applyWatermark(canvasPng, watermark);

  return sharp(finalPng).webp({ quality: 90 }).toBuffer();
}

// ── URL <-> R2 key helpers ────────────────────────────────────────────────────
function keyFromUrl(url) {
  try {
    return decodeURIComponent(new URL(url).pathname.replace(/^\/+/, ""));
  } catch {
    return null;
  }
}

function originFromUrl(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

// ".../samsung-wallet-logo.webp" -> ".../samsung-wallet-logo-og.webp"
function ogKeyFromWebpKey(webpKey) {
  return webpKey.replace(/\.webp$/i, "-og.webp");
}

async function fetchFromR2(key) {
  const obj = await r2.send(
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key })
  );
  return Buffer.from(await obj.Body.transformToByteArray());
}

// ── Single logo ───────────────────────────────────────────────────────────────
async function processLogo(
  logo,
  { watermark, dryRun, updateSchemaDomain, minRatio, padX, padY }
) {
  const base = { id: logo.id, slug: logo.slug };

  if (!logo.pngUrl) return { ...base, status: "skipped", reason: "pngUrl missing" };
  if (!logo.webpUrl) return { ...base, status: "skipped", reason: "webpUrl missing" };

  const webpKey = keyFromUrl(logo.webpUrl);
  const pngKey = keyFromUrl(logo.pngUrl);
  const origin = originFromUrl(logo.webpUrl);

  if (!webpKey || !pngKey || !origin) {
    return { ...base, status: "skipped", reason: "could not parse URLs" };
  }
  if (!/\.webp$/i.test(webpKey)) {
    return { ...base, status: "skipped", reason: "webpUrl is not a .webp file" };
  }

  const ogKey = ogKeyFromWebpKey(webpKey);
  const ogUrl = `${origin}/${ogKey}`;

  // 1) Original PNG padho (sirf read, kabhi modify nahi) aur orientation check karo
  const pngBuffer = await fetchFromR2(pngKey);
  const trimmed = await trimLogo(pngBuffer);
  const ratio = +(trimmed.width / trimmed.height).toFixed(2);

  if (ratio < minRatio) {
    return { ...base, status: "skipped", reason: `not horizontal (ratio ${ratio} < ${minRatio})` };
  }

  if (dryRun) {
    return {
      ...base,
      status: "dry-run",
      ratio,
      willOverwrite: [webpKey, ogKey],
      unchangedWebpUrl: logo.webpUrl,
    };
  }

  // 2) Dono previews generate karo (kam side padding ke saath)
  const [squareWebp, ogWebp] = await Promise.all([
    buildPreviewWebp(trimmed.buffer, SQUARE.width, SQUARE.height, padX, padY, watermark),
    buildPreviewWebp(trimmed.buffer, OG.width, OG.height, padX, padY, watermark),
  ]);

  // 3) Upload: dono apni usi key par overwrite
  await uploadToR2({ fileBuffer: squareWebp, fileName: webpKey, mimeType: "image/webp" });
  await uploadToR2({ fileBuffer: ogWebp, fileName: ogKey, mimeType: "image/webp" });

  // 4) DB: sirf zarurat ho tabhi update (webpUrl same rehta hai)
  const data = {};
  if (!logo.ogImageUrl) data.ogImageUrl = ogUrl;
  if (!logo.twitterImage) data.twitterImage = ogUrl;

  if (updateSchemaDomain && logo.imageObjectSchema && typeof logo.imageObjectSchema === "object") {
    data.imageObjectSchema = {
      ...logo.imageObjectSchema,
      url: logo.webpUrl,
      contentUrl: logo.webpUrl,
    };
  }

  if (Object.keys(data).length > 0) {
    await prisma.logo.update({ where: { id: logo.id }, data });
  }

  return {
    ...base,
    status: "done",
    ratio,
    webpUrl: logo.webpUrl,
    ogImageUrl: logo.ogImageUrl || ogUrl,
    squareKB: +(squareWebp.length / 1024).toFixed(1),
    ogKB: +(ogWebp.length / 1024).toFixed(1),
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────
export async function POST(req) {
  // Optional protection: .env mein ADMIN_API_SECRET set karo to header zaroori hoga
  const secret = process.env.ADMIN_API_SECRET;
  if (secret && req.headers.get("x-admin-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const body = await req.json().catch(() => ({}));
    const cursor = body.cursor || null;
    // Local (npm run dev) par koi 60s limit nahi hoti, isliye bada batch allowed
    const isLocal = process.env.NODE_ENV !== "production";
    const maxLimit = isLocal ? 5000 : 10;
    const limit = Math.min(maxLimit, Math.max(1, parseInt(body.limit, 10) || 5));
    const dryRun = !!body.dryRun;
    const updateSchemaDomain = !!body.updateSchemaDomain;
    const slug = body.slug ? String(body.slug).trim() : null;

    const minRatio = Number.isFinite(+body.minRatio) && +body.minRatio > 0 ? +body.minRatio : DEFAULT_MIN_RATIO;
    const padX = Number.isFinite(+body.padX) ? Math.min(0.3, Math.max(0, +body.padX)) : DEFAULT_PAD_X;
    const padY = Number.isFinite(+body.padY) ? Math.min(0.3, Math.max(0, +body.padY)) : DEFAULT_PAD_Y;

    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;

    const logos = await prisma.logo.findMany({
      where: slug ? { slug } : {},
      select: {
        id: true,
        slug: true,
        webpUrl: true,
        pngUrl: true,
        ogImageUrl: true,
        twitterImage: true,
        imageObjectSchema: true,
      },
      orderBy: { id: "asc" },
      take: limit,
      ...(cursor && !slug ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const results = [];
    // Ek-ek karke (sequential) taaki memory / timeout safe rahe
    for (const logo of logos) {
      // 60s limit se pehle gracefully ruk jao
      if (!isLocal && Date.now() - startTime > 50_000) {
        results.push({ id: logo.id, slug: logo.slug, status: "deferred", reason: "time limit — rerun from cursor" });
        continue;
      }
      try {
        const r = await processLogo(logo, { watermark, dryRun, updateSchemaDomain, minRatio, padX, padY });
        results.push(r);
        console.log(`[regen-previews] ${r.status} — ${logo.slug}${r.reason ? ` (${r.reason})` : ""}`);
      } catch (err) {
        console.error(`[regen-previews] ❌ ${logo.slug}: ${err.message}`);
        results.push({ id: logo.id, slug: logo.slug, status: "failed", error: err.message });
      }
    }

    // Cursor: pehle deferred logo se pehle wala id (taaki deferred dobara process ho)
    const firstDeferredIdx = results.findIndex((r) => r.status === "deferred");
    const lastProcessed =
      firstDeferredIdx === -1
        ? logos[logos.length - 1]
        : firstDeferredIdx > 0
          ? logos[firstDeferredIdx - 1]
          : null;

    const nextCursor = slug ? null : lastProcessed?.id ?? cursor;
    const done = slug ? true : logos.length < limit && firstDeferredIdx === -1;

    const summary = {
      done: results.filter((r) => r.status === "done").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      deferred: results.filter((r) => r.status === "deferred").length,
      dryRun: results.filter((r) => r.status === "dry-run").length,
    };

    if (!dryRun && (summary.done || summary.failed)) {
      await prisma.log.create({
        data: {
          who: "api:regenerate-previews",
          content: `Horizontal previews regenerated (padX ${padX}, padY ${padY}, minRatio ${minRatio}): ${summary.done} done, ${summary.failed} failed, ${summary.skipped} skipped (batch of ${logos.length})`,
        },
      });
    }

    return NextResponse.json({
      ok: true,
      dryRun,
      settings: { minRatio, padX, padY },
      summary,
      nextCursor,
      finished: done,
      durationMs: Date.now() - startTime,
      results,
    });
  } catch (error) {
    console.error("[regen-previews] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}