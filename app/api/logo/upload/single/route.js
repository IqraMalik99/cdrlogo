import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import sharp from "sharp";
import { uploadToR2 } from "../../../../lib/uploadToR2";
import { prisma } from "../../../../lib/prisma";

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
// Far more accurate than the flat 0.6 estimate for ASCII printable range.
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
const FALLBACK_W = 0.62; // for chars outside the table (e.g. accented)

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

  // Accurate bounding box
  const textW = measureText(wm.text, fontSize);
  const textH = Math.ceil(fontSize * 1.15); // tight cap-height for Arial Bold

  // Padding: 1.5% of shorter side, min 8px
  const pad = Math.max(8, Math.floor(Math.min(W, H) * 0.015));

  // Resolve top-left corner of the text box
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

  // Clamp — never let text bleed off canvas
  tx = Math.max(0, Math.min(tx, W - textW));
  ty = Math.max(0, Math.min(ty, H - textH));

  // SVG overlay:
  //   text-anchor="start"   → x is the LEFT edge of the text
  //   dominant-baseline="hanging" → y is the TOP of the em square
  // Together these make (tx, ty) the exact top-left of the rendered glyph block.
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
//  file size
function formatSize(bytes) {
  if (!bytes || bytes === 0) return "0 KB";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(req) {
  try {
    const formData = await req.formData();

    // ── 1. pull fields ────────────────────────────────────────────────────────
    const slug = formData.get("slug")?.trim();
    const logoName = formData.get("logoName")?.trim();
    const brand = formData.get("brand") || "";
    const website = formData.get("website") || "";
    const category = formData.get("category") || "";
    const industry = formData.get("industry") || "";
    const country = formData.get("country") || "";
    const license = formData.get("license") || "";
    const description = formData.get("description") || "";
    const history = formData.get("history") || "";
    const metaTitle = formData.get("metaTitle") || "";
    const metaDescription = formData.get("metaDescription") || "";
    const altText = formData.get("altText") || "";
    const focusKeywords = formData.get("focusKeywords") || "";
    const publishStatus = formData.get("publishStatus") || "Draft";
    const downloadCount = formData.get("downloadCount") || "unlimited";

    let tags = [];
    let brandColors = [];
    try { tags = JSON.parse(formData.get("tags") || "[]"); } catch { }
    try { brandColors = JSON.parse(formData.get("brandColors") || "[]"); } catch { }

    if (!slug) return NextResponse.json({ error: "slug is required." }, { status: 400 });
    if (!logoName) return NextResponse.json({ error: "logoName is required." }, { status: 400 });

    const existing = await prisma.logo.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: `Slug "${slug}" is already taken. Please use a different slug.` },
        { status: 409 }
      );
    }

    // ── 2. collect ZIP files ──────────────────────────────────────────────────
    const zipFiles = formData.getAll("files");
    if (!zipFiles.length) {
      return NextResponse.json({ error: "No ZIP file uploaded." }, { status: 400 });
    }

    // ── 3. fetch watermark settings from DB ───────────────────────────────────
    const websiteRecord = await prisma.website.findFirst();
    const watermark = websiteRecord?.watermark ?? null;

    // ── 4. process every ZIP ──────────────────────────────────────────────────
    const publicFiles = []; // WebP previews (watermarked)
    const privateFiles = []; // Original files (clean)
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

        if (fileExt === "svg") {
          // Private: original SVG
          privateFiles.push({
            key: `separate/${slug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
          fileSizes.svg = fileBuffer.length;
          // Capture SVG source for DB (first SVG wins)
          if (!svgContent) svgContent = fileBuffer.toString("utf-8");

        } else if (fileExt === "png") {
          // Private: original PNG (always clean)
          privateFiles.push({
            key: `separate/${slug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });

          fileSizes.png = fileBuffer.length;

          // Public: watermarked WebP
          const watermarked = await applyWatermark(fileBuffer, watermark);
          const webpBuffer = await sharp(watermarked).webp({ quality: 90 }).toBuffer();
          const webpName = filename.replace(/\.png$/i, ".webp");
          publicFiles.push({
            key: `public/${slug}/${webpName}`,
            buffer: webpBuffer,
            contentType: "image/webp",
          });

        }
        else if (fileExt === "ai") {
          privateFiles.push({
            key: `separate/${slug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });

          fileSizes.ai = fileBuffer.length;           // ← add this

        } else if (fileExt === "cdr") {
          privateFiles.push({
            key: `separate/${slug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });

          fileSizes.cdr = fileBuffer.length;          // ← add this
        }
        else {
          privateFiles.push({
            key: `private/${slug}/${filename}`,
            buffer: fileBuffer,
            contentType: mime(filename),
          });
        }
      }
    }

    // ── 5. upload everything to R2 ────────────────────────────────────────────
    const allUploads = [...publicFiles, ...privateFiles];
    const uploadResults = await Promise.all(
      allUploads.map(({ key, buffer, contentType }) =>
        uploadToR2({ fileBuffer: buffer, fileName: key, mimeType: contentType })
      )
    );

    const urlMap = {};
    allUploads.forEach(({ key }, i) => { urlMap[key] = uploadResults[i]; });

    const findUrl = (predicate) => {
      const match = allUploads.find(predicate);
      return match ? urlMap[match.key] : null;
    };

    const svgUrl = findUrl(f => f.key.endsWith(".svg"));
    const pngUrl = findUrl(f => f.key.endsWith(".png"));
    const webpUrl = findUrl(f => f.key.endsWith(".webp"));
    const aiUrl = findUrl(f => f.key.endsWith(".ai"));
    const cdrUrl = findUrl(f => f.key.endsWith(".cdr"));

    // ── 6. save to DB ─────────────────────────────────────────────────────────
    const logo = await prisma.logo.create({
      data: {
        logoName, slug, brand, website, category, industry, country,
        license, description, history, tags, brandColors, publishStatus,
        downloadCount, svgUrl, pngUrl, webpUrl, aiUrl, cdrUrl, svgContent,
        metaTitle, metaDescription, altText, focusKeywords,
        // ── File sizes ──────────────────────────────────────────────────────
        svgfilesize: formatSize(fileSizes.svg),
        pngfilesize: formatSize(fileSizes.png),
        aifilesize: formatSize(fileSizes.ai),
        cdrfilesize: formatSize(fileSizes.cdr),
      },
    });

    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Logo uploaded successfully: ${slug}`,
      },
    });

    return NextResponse.json({
      message: "Logo uploaded successfully!",
      logo,
      files: {
        public: publicFiles.map(f => ({ key: f.key, url: urlMap[f.key] })),
        private: privateFiles.map(f => ({ key: f.key, url: urlMap[f.key] })),
      },
    });

  } catch (error) {
    console.error("[upload-logo]", error);
    await prisma.log.create({
      data: {
        who: "api:upload-logo",
        content: `Upload error: ${error?.message}`,
      },
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}