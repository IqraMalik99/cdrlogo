import sharp from "sharp";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import * as mupdf from "mupdf";
import createDOMPurify from "dompurify";
import { JSDOM } from "jsdom";
import { fileTypeFromBuffer } from "file-type";

export const runtime = "nodejs";

// ── SECURITY CONFIG ──────────────────────────────────────────────────────
const MAX_SVG_SIZE = 3 * 1024 * 1024;   // 3 MB — plenty for a logo SVG
const MAX_AI_SIZE = 15 * 1024 * 1024;   // 15 MB — .ai/.pdf files are heavier

const window = new JSDOM("").window;
const DOMPurify = createDOMPurify(window);

// Route accepts either:
//   { type: "svg", svg: "<svg>...</svg>", filename }
//   { type: "ai",  ai: "<base64 .ai/.pdf data>", filename }
//
// SVG path:
//   svg (sanitized) → png (via sharp) → ai (svg wrapped in a PDF via svg-to-pdfkit)
//
// AI path:
//   ai (validated) → png (rasterized from the PDF-compatible .ai via mupdf, WITH alpha)
//                  → svg (rasterized PNG embedded as a base64 <image> inside
//                    an SVG wrapper — this is NOT a true vector trace, just a
//                    valid, openable .svg container around the raster preview)
//
// SECURITY MODEL (quarantine-equivalent):
// Nothing here ever gets written to disk or executed. Every incoming payload
// goes through: 1) size check  2) real byte/signature validation (never
// trust the client's claimed type or file extension)  3) sanitization
// (SVG only)  — and ONLY THEN is it handed to sharp / pdfkit / mupdf for
// processing. This mirrors a quarantine → scan → promote flow even though
// storage here is in-memory.

export async function POST(req) {
  try {
    console.log("[convert] Request received");

    const body = await req.json();
    const rawFilename = typeof body.filename === "string" ? body.filename : "logo";
    // Prevent path traversal / weird characters in the output filename
    const filename = rawFilename.replace(/[^a-zA-Z0-9_\-]/g, "_").slice(0, 100) || "logo";
    const type = body.type === "ai" ? "ai" : "svg"; // default to svg for back-compat

    console.log(`[convert] type: "${type}", filename: "${filename}"`);

    if (type === "svg") {
      return await handleSvgSource(body, filename);
    } else {
      return await handleAiSource(body, filename);
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
 * Strict SVG sanitizer. Strips <script>, event handler attributes
 * (onload/onerror/onclick/...), <foreignObject>, external references via
 * xlink:href to remote/script urls, and anything DOMPurify's SVG profile
 * doesn't recognize. This runs BEFORE the SVG ever touches sharp, pdfkit,
 * or gets written into the output zip.
 */
function sanitizeSvg(svgString) {
  // IMPORTANT: we do NOT forbid <style> here. Most logo SVGs define their
  // colors via CSS classes in a <style> block (e.g. .cls-1{fill:#3498db}).
  // Removing the whole tag strips all color information and every shape
  // falls back to SVG's default fill, which is black — that was the cause
  // of logos turning solid black after sanitization. Instead we keep
  // <style>, let DOMPurify sanitize it normally, and additionally scrub
  // only the genuinely dangerous constructs from its contents below.
  const clean = DOMPurify.sanitize(svgString, {
    USE_PROFILES: { svg: true, svgFilters: true },
    FORBID_TAGS: ["script", "foreignObject"],
    FORBID_ATTR: [
      "onload", "onerror", "onclick", "onmouseover", "onmouseout",
      "onfocus", "onblur", "onbegin", "onend", "onrepeat",
    ],
  });

  if (!clean || clean.trim().length === 0) {
    throw new Error("SVG failed sanitization (empty or fully stripped as malicious)");
  }

  // Extra belt-and-suspenders check: reject if anything script-like slipped through
  const lower = clean.toLowerCase();
  if (lower.includes("<script") || lower.includes("javascript:")) {
    throw new Error("SVG rejected: potentially malicious content detected");
  }

  // Scrub dangerous CSS constructs from any remaining <style> blocks
  // WITHOUT deleting the block itself, so legitimate fill/stroke/color
  // rules survive.
  const sanitizedStyles = clean.replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, (match, css) => {
    const safeCss = css
      .replace(/@import[^;]*;?/gi, "")
      .replace(/expression\s*\([^)]*\)/gi, "")
      .replace(/javascript\s*:/gi, "")
      .replace(/behavior\s*:[^;]*;?/gi, "")
      .replace(/-moz-binding\s*:[^;]*;?/gi, "");
    return match.replace(css, safeCss);
  });

  return sanitizedStyles;
}

/**
 * Validates that the decoded AI/PDF buffer is ACTUALLY a PDF-compatible
 * file by checking its real magic bytes/signature — never trust the
 * filename, extension, or client-supplied MIME type.
 */
async function validateAiBuffer(buffer) {
  const detected = await fileTypeFromBuffer(buffer);

  // .ai files saved in "PDF-compatible" mode are real PDFs under the hood,
  // which is the only kind this route (and mupdf) can actually open.
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
async function handleSvgSource(body, filename) {
  const { svg } = body;

  if (!svg || typeof svg !== "string") {
    console.error("[convert:svg] No SVG content provided in request body");
    return Response.json({ error: "No SVG content provided" }, { status: 400 });
  }

  const incomingSize = Buffer.byteLength(svg, "utf-8");
  if (incomingSize > MAX_SVG_SIZE) {
    console.warn(`[convert:svg] Rejected: SVG size ${incomingSize} exceeds limit`);
    return Response.json(
      { error: `SVG too large (${(incomingSize / 1024 / 1024).toFixed(2)}MB). Max allowed is ${MAX_SVG_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  // Must look like an SVG before we even attempt to sanitize/parse it
  if (!svg.trim().toLowerCase().includes("<svg")) {
    return Response.json({ error: "Invalid SVG: no <svg> root element found" }, { status: 400 });
  }

  console.log(`[convert:svg] SVG length: ${svg.length} chars`);

  // ── SANITIZE FIRST — nothing downstream ever sees the raw input ──
  let cleanSvg;
  try {
    cleanSvg = sanitizeSvg(svg);
    console.log("[convert:svg] Sanitization passed");
  } catch (err) {
    console.error("[convert:svg] Sanitization FAILED:", err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }

  const svgBuffer = Buffer.from(cleanSvg, "utf-8");

  // --- PNG conversion (transparency preserved — sharp keeps alpha by default,
  //     we just make sure we never call .flatten(), which would force a
  //     solid background) ---
  let pngBuffer;
  try {
    console.log("[convert:svg] Starting PNG conversion via sharp...");
    pngBuffer = await sharp(svgBuffer, { density: 300 })
      .ensureAlpha()          // guarantee an alpha channel is present
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

  // --- Zipping (sanitized SVG only — never the original raw upload) ---
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
async function handleAiSource(body, filename) {
  const { ai } = body;

  if (!ai || typeof ai !== "string") {
    console.error("[convert:ai] No AI file content provided in request body");
    return Response.json({ error: "No AI file content provided" }, { status: 400 });
  }

  // Accept either a raw base64 string or a data URL (data:application/pdf;base64,....)
  let base64Data = ai;
  const commaIdx = ai.indexOf(",");
  if (ai.startsWith("data:") && commaIdx !== -1) {
    base64Data = ai.slice(commaIdx + 1);
  }

  let aiBuffer;
  try {
    aiBuffer = Buffer.from(base64Data, "base64");
  } catch (err) {
    console.error("[convert:ai] Failed to decode base64 AI data:", err.message);
    return Response.json({ error: "Invalid AI file data (expected base64)" }, { status: 400 });
  }

  if (aiBuffer.length > MAX_AI_SIZE) {
    console.warn(`[convert:ai] Rejected: AI file size ${aiBuffer.length} exceeds limit`);
    return Response.json(
      { error: `File too large (${(aiBuffer.length / 1024 / 1024).toFixed(2)}MB). Max allowed is ${MAX_AI_SIZE / 1024 / 1024}MB.` },
      { status: 413 }
    );
  }

  // ── VALIDATE REAL FILE SIGNATURE — never trust extension/claimed type ──
  try {
    await validateAiBuffer(aiBuffer);
    console.log("[convert:ai] File signature validated as PDF-compatible");
  } catch (err) {
    console.error("[convert:ai] Validation FAILED:", err.message);
    return Response.json({ error: err.message }, { status: 400 });
  }

  console.log(`[convert:ai] Decoded AI buffer, size: ${aiBuffer.length} bytes`);

  // --- PNG conversion (rasterize the PDF-compatible .ai file via mupdf) ---
  // FIX: the previous code passed `alpha = false` to toPixmap(), which forces
  // mupdf to flatten the render onto an opaque (white) background — that is
  // exactly why logos with no background were coming out with a white
  // background in the PNG. Passing `alpha = true` preserves transparency.
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
    const bounds = page.getBounds(); // [x0, y0, x1, y1] in points
    const pageWidthPt = bounds[2] - bounds[0];
    const pageHeightPt = bounds[3] - bounds[1];

    const dpi = 300;
    const scale = dpi / 72;
    const matrix = mupdf.Matrix.scale(scale, scale);

    // alpha = true  → keep transparency instead of flattening to white
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

  console.log("[convert:ai] Sending zip response");
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}.zip"`,
    },
  });
}

function svgToAiBuffer(svgString) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: [1000, 1000], autoFirstPage: false });
      const chunks = [];

      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => {
        console.log("[convert:svg] PDFDocument stream ended");
        resolve(Buffer.concat(chunks));
      });
      doc.on("error", (err) => {
        console.error("[convert:svg] PDFDocument stream error:", err);
        reject(err);
      });

      doc.addPage({ size: [1000, 1000] });

      console.log("[convert:svg] Calling SVGtoPDF...");
      SVGtoPDF(doc, svgString, 0, 0, {
        width: 1000,
        height: 1000,
        preserveAspectRatio: "xMidYMid meet",
        assumePt: true,
      });
      console.log("[convert:svg] SVGtoPDF call completed without throwing");

      doc.end();
    } catch (err) {
      console.error("[convert:svg] Synchronous error in svgToAiBuffer:", {
        message: err.message,
        stack: err.stack,
      });
      reject(err);
    }
  });
}