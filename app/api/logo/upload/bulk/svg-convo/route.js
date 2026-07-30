import sharp from "sharp";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import * as mupdf from "mupdf";
import sanitizeHtml from "sanitize-html";
import { fileTypeFromBuffer } from "file-type";

export const runtime = "nodejs";
export const maxDuration = 60;

// ── SECURITY CONFIG ──────────────────────────────────────────────────────
const MAX_SVG_SIZE = 3 * 1024 * 1024;   // 3 MB — plenty for a logo SVG
const MAX_AI_SIZE = 15 * 1024 * 1024;   // 15 MB — .ai/.pdf files are heavier
const MAX_OUTPUT_DIMENSION = 2000;      // px — hard ceiling on rasterized output

// Route now accepts multipart/form-data (like /api/logo/upload/single),
// NOT JSON+base64. This avoids ~33% base64 inflation and keeps request
// bodies as close as possible to Vercel's 4.5MB function payload limit.
//
// Expected fields:
//   type      : "svg" | "ai"
//   file      : the raw .svg or .ai/.pdf File
//   filename  : desired output filename (no extension)
//
// SVG path:
//   svg (sanitized) → png (via sharp, capped resolution) → ai (svg wrapped
//   in a PDF via svg-to-pdfkit)
//
// AI path:
//   ai (validated) → png (rasterized from the PDF-compatible .ai via mupdf,
//                    WITH alpha, capped resolution)
//                  → svg (rasterized PNG embedded as a base64 <image> inside
//                    an SVG wrapper — NOT a true vector trace)
//
// SECURITY MODEL (quarantine-equivalent):
// Nothing here ever gets written to disk or executed. Every incoming payload
// goes through: 1) size check  2) real byte/signature validation (never
// trust the client's claimed type or file extension)  3) sanitization
// (SVG only) — and ONLY THEN is it handed to sharp / pdfkit / mupdf.

export async function POST(req) {
  try {
    console.log("[convert] Request received");

    const formData = await req.formData();
    const rawFilename = formData.get("filename")?.toString() || "logo";
    const filename = rawFilename.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 100) || "logo";
    const type = formData.get("type")?.toString() === "ai" ? "ai" : "svg";
    const file = formData.get("file");

    console.log(`[convert] type: "${type}", filename: "${filename}"`);

    if (!file || typeof file === "string") {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    if (type === "svg") {
      return await handleSvgSource(file, filename);
    } else {
      return await handleAiSource(file, filename);
    }
  } catch (err) {
    console.error("[convert] Top-level conversion error:", {
      message: err.message,
      stack: err.stack,
      name: err.name,
    });
    return Response.json(
      { error: err.message || "Conversion failed" },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// VALIDATION + SANITIZATION HELPERS
// ────────────────────────────────────────────────────────────────────────

/**
 * Strict SVG sanitizer using sanitize-html (no jsdom dependency — avoids
 * the ERR_REQUIRE_ESM crash from isomorphic-dompurify's jsdom chain on
 * Vercel/Turbopack builds).
 */
function sanitizeSvg(svgString) {
  const clean = sanitizeHtml(svgString, {
    allowedTags: [
      "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline",
      "polygon", "text", "tspan", "textPath", "defs", "symbol", "use",
      "clipPath", "mask", "pattern", "marker", "linearGradient",
      "radialGradient", "stop", "filter", "feGaussianBlur", "feOffset",
      "feBlend", "feColorMatrix", "feComposite", "feFlood", "feMerge",
      "feMergeNode", "feMorphology", "feTile", "feTurbulence",
      "feDisplacementMap", "feDropShadow", "title", "desc", "style",
      "image", "switch",
    ],
    allowedAttributes: false,
    disallowedTagsMode: "discard",
    exclusiveFilter: (frame) => {
      const tag = frame.tag?.toLowerCase();
      return tag === "script" || tag === "foreignobject";
    },
    allowedSchemes: ["data", "http", "https"],
    parser: { lowerCaseAttributeNames: false },
  });

  if (!clean || clean.trim().length === 0) {
    throw new Error("SVG failed sanitization (empty or fully stripped as malicious)");
  }

  let safe = clean
    .replace(/\son\w+\s*=\s*"(?:[^"\\]|\\.)*"/gi, "")
    .replace(/\son\w+\s*=\s*'(?:[^'\\]|\\.)*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/javascript\s*:/gi, "");

  const lower = safe.toLowerCase();
  if (lower.includes("<script") || lower.includes("javascript:")) {
    throw new Error("SVG rejected: potentially malicious content detected");
  }

  safe = safe.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
    const safeCss = css
      .replace(/@import[^;]*;?/gi, "")
      .replace(/expression\s*\([^)]*\)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/behavior\s*:[^;]*;?/gi, "")
      .replace(/-moz-binding\s*:[^;]*;?/gi, "");
    return match.replace(css, safeCss);
  });

  return safe;
}

async function validateAiBuffer(buffer) {
  const detected = await fileTypeFromBuffer(buffer);
  const isPdfSignature = buffer.slice(0, 5).toString("ascii") === "%PDF-";

  if (!isPdfSignature && detected?.mime !== "application/pdf") {
    throw new Error(
      "Invalid AI file: file content is not a recognized PDF-compatible .ai/.pdf (signature check failed)"
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// SVG → SVG + PNG + AI
// ────────────────────────────────────────────────────────────────────────
async function handleSvgSource(file, filename) {
  if (file.size > MAX_SVG_SIZE) {
    console.warn(`[convert:svg] Rejected: SVG size ${file.size} exceeds limit`);
    return Response.json(
      { error: `SVG too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max allowed is ${MAX_SVG_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const svg = await file.text();

  if (!svg.trim().toLowerCase().includes("<svg")) {
    return Response.json({ error: "Invalid SVG: no <svg> root element found" }, { status: 400 });
  }

  console.log(`[convert:svg] SVG length: ${svg.length} chars`);

  let cleanSvg;
  try {
    cleanSvg = sanitizeSvg(svg);
    console.log("[convert:svg] Sanitization passed");
  } catch (err) {
    console.error("[convert:svg] Sanitization FAILED:", err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }

  const svgBuffer = Buffer.from(cleanSvg, "utf-8");

  // --- PNG conversion (capped resolution — prevents OOM on huge viewBoxes) ---
  let pngBuffer;
  try {
    console.log("[convert:svg] Starting PNG conversion via sharp...");

    const probe = await sharp(svgBuffer).metadata();
    const intrinsicW = probe.width || 1000;
    const intrinsicH = probe.height || 1000;
    const longestSide = Math.max(intrinsicW, intrinsicH);

    const desiredDensity = 300;
    const projectedLongestSide = longestSide * (desiredDensity / 72);
    const density = projectedLongestSide > MAX_OUTPUT_DIMENSION
      ? Math.max(72, Math.floor((MAX_OUTPUT_DIMENSION / longestSide) * 72))
      : desiredDensity;

    console.log(`[convert:svg] intrinsic ${intrinsicW}x${intrinsicH}, density=${density}`);

    pngBuffer = await sharp(svgBuffer, { density })
      .resize({
        width: MAX_OUTPUT_DIMENSION,
        height: MAX_OUTPUT_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .ensureAlpha()
      .png({ compressionLevel: 9 })
      .toBuffer();

    console.log(`[convert:svg] PNG conversion succeeded, size: ${pngBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:svg] PNG conversion FAILED:", { message: err.message });
    throw new Error(`PNG conversion failed: ${err.message}`);
  }

  // --- AI (PDF-wrapped) conversion ---
  let aiBuffer;
  try {
    console.log("[convert:svg] Starting AI/PDF conversion via svg-to-pdfkit...");
    aiBuffer = await svgToAiBuffer(cleanSvg);
    console.log(`[convert:svg] AI conversion succeeded, size: ${aiBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:svg] AI conversion FAILED:", { message: err.message });
    throw new Error(`AI conversion failed: ${err.message}`);
  }

  // --- Zipping ---
  let zipBuffer;
  try {
    console.log("[convert:svg] Building zip archive...");
    const zip = new JSZip();
    zip.file(`${filename}.svg`, svgBuffer);
    zip.file(`${filename}.png`, pngBuffer);
    zip.file(`${filename}.ai`, aiBuffer);
    zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    console.log(`[convert:svg] Zip built successfully, size: ${zipBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:svg] Zip creation FAILED:", { message: err.message });
    throw new Error(`Zip creation failed: ${err.message}`);
  }

  if (zipBuffer.length > 4.3 * 1024 * 1024) {
    console.warn(`[convert:svg] Zip response is ${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB — close to Vercel's 4.5MB limit`);
  }

  console.log("[convert:svg] Sending zip response");
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// AI → PNG + SVG (raster-wrapped) + AI (original passthrough)
// ────────────────────────────────────────────────────────────────────────
async function handleAiSource(file, filename) {
  if (file.size > MAX_AI_SIZE) {
    console.warn(`[convert:ai] Rejected: AI file size ${file.size} exceeds limit`);
    return Response.json(
      { error: `File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max allowed is ${MAX_AI_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const aiBuffer = Buffer.from(arrayBuffer);

  try {
    await validateAiBuffer(aiBuffer);
    console.log("[convert:ai] File signature validated as PDF-compatible");
  } catch (err) {
    console.error("[convert:ai] Validation FAILED:", err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }

  console.log(`[convert:ai] Decoded AI buffer, size: ${aiBuffer.length} bytes`);

  // --- PNG conversion (rasterize via mupdf, capped resolution) ---
  let pngBuffer;
  let width;
  let height;
  try {
    console.log("[convert:ai] Rasterizing AI/PDF via mupdf...");
    const doc = mupdf.Document.openDocument(aiBuffer, "application/pdf");
    const pageCount = doc.countPages();
    if (pageCount < 1) {
      throw new Error("AI/PDF document has no pages");
    }
    const page = doc.loadPage(0);
    const bounds = page.getBounds();
    const pageWidthPt = bounds[2] - bounds[0];
    const pageHeightPt = bounds[3] - bounds[1];

    const dpi = 300;
    let scale = dpi / 72;
    const projectedLongest = Math.max(pageWidthPt, pageHeightPt) * scale;
    if (projectedLongest > MAX_OUTPUT_DIMENSION) {
      scale = MAX_OUTPUT_DIMENSION / Math.max(pageWidthPt, pageHeightPt);
    }

    const matrix = mupdf.Matrix.scale(scale, scale);
    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, true, true);
    pngBuffer = Buffer.from(pixmap.asPNG());

    width = Math.round(pageWidthPt * scale);
    height = Math.round(pageHeightPt * scale);

    console.log(`[convert:ai] PNG conversion succeeded, size: ${pngBuffer.length} bytes (${width}x${height})`);
  } catch (err) {
    console.error("[convert:ai] PNG conversion FAILED:", { message: err.message });
    throw new Error(`Could not rasterize the AI file (${err.message}).`);
  }

  // --- SVG (raster-wrapped, NOT a vector trace) ---
  let svgBuffer;
  try {
    console.log("[convert:ai] Building raster-wrapped SVG from PNG preview...");
    const base64Png = pngBuffer.toString("base64");
    const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <image x="0" y="0" width="${width}" height="${height}" href="data:image/png;base64,${base64Png}" />
</svg>`;
    svgBuffer = Buffer.from(svgString, "utf-8");
    console.log(`[convert:ai] Raster-wrapped SVG built, size: ${svgBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:ai] SVG wrapping FAILED:", { message: err.message });
    throw new Error(`SVG wrapping failed: ${err.message}`);
  }

  // --- Zipping ---
  let zipBuffer;
  try {
    console.log("[convert:ai] Building zip archive...");
    const zip = new JSZip();
    zip.file(`${filename}.svg`, svgBuffer);
    zip.file(`${filename}.png`, pngBuffer);
    zip.file(`${filename}.ai`, aiBuffer);
    zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    console.log(`[convert:ai] Zip built successfully, size: ${zipBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:ai] Zip creation FAILED:", { message: err.message });
    throw new Error(`Zip creation failed: ${err.message}`);
  }

  if (zipBuffer.length > 4.3 * 1024 * 1024) {
    console.warn(`[convert:ai] Zip response is ${(zipBuffer.length / 1024 / 1024).toFixed(2)}MB — close to Vercel's 4.5MB limit`);
  }

  console.log("[convert:ai] Sending zip response");
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  });
}

// ────────────────────────────────────────────────────────────────────────
// CLIENT-SIDE REFERENCE (page.jsx handleUpload) — not part of this route,
// kept here as a comment for reference only:
//
// async function handleUpload(e) {
//   e.preventDefault();
//   ...
//   const slug = slugify(logoName);
//   const convFd = new FormData();
//   convFd.append("type", sourceType);        // "svg" | "ai"
//   convFd.append("file", file);              // raw File object, no reading/base64
//   convFd.append("filename", slug);
//
//   setStep(sourceType === "svg" ? "Converting to PNG/AI…" : "Converting to PNG/SVG…");
//   const convRes = await fetch("/api/logo/upload/bulk/svg-convo", {
//     method: "POST",
//     body: convFd,                            // NOTE: no Content-Type header —
//   });                                        // browser sets multipart boundary automatically
//   if (!convRes.ok) {
//     const d = await convRes.json().catch(() => ({}));
//     throw new Error(d.error || "File conversion failed");
//   }
//   const zipBlob = await convRes.blob();
//   ...rest unchanged (upload zipBlob to /api/logo/upload/single)
// }
// ────────────────────────────────────────────────────────────────────────

function svgToAiBuffer(svgString) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [1000, 1000], autoFirstPage: false });
      const chunks = [];

      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      doc.addPage({ size: [1000, 1000] });

      SVGtoPDF(doc, svgString, 0, 0, {
        width: 1000,
        height: 1000,
        preserveAspectRatio: "xMidYMid meet",
        assumePt: true,
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}