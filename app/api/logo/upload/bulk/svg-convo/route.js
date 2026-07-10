import sharp from "sharp";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import SVGtoPDF from "svg-to-pdfkit";
import * as mupdf from "mupdf";

export const runtime = "nodejs";

// ── Route accepts either:
//   { type: "svg", svg: "<svg>...</svg>", filename }
//   { type: "ai",  ai: "<base64 .ai/.pdf data>", filename }
//
// SVG path (unchanged from before):
//   svg (as-is) → png (via sharp) → ai (svg wrapped in a PDF via svg-to-pdfkit)
//
// AI path (fixed):
//   ai (as-is) → png (rasterized from the PDF-compatible .ai via mupdf)
//              → svg (the rasterized PNG embedded as a base64 <image> inside
//                an SVG wrapper — this is NOT a true vector trace, just a
//                valid, openable .svg container around the raster preview.
//                Real AI→vector-SVG needs actual path extraction, which this
//                route does not attempt.)
//
// NOTE ON THE FIX: sharp (via libvips) does NOT support PDF input in its
// standard prebuilt binaries, so `sharp(aiBuffer, ...)` on a .ai/.pdf file
// was silently throwing on every request — that's why "ai to all" never
// worked while "svg to all" (which never asked sharp to read a PDF) did.
// mupdf is a pure WASM PDF/AI renderer with no native system dependencies,
// so it works the same in local dev and on serverless hosts.

export async function POST(req) {
  try {
    console.log("[convert] Request received");

    const body = await req.json();
    const { filename = "logo" } = body;
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
      { error: err.message || "Conversion failed", detail: err.stack },
      { status: 500 }
    );
  }
}

// ────────────────────────────────────────────────────────────────────────
// SVG → SVG + PNG + AI   (UNCHANGED)
// ────────────────────────────────────────────────────────────────────────
async function handleSvgSource(body, filename) {
  const { svg } = body;

  if (!svg || typeof svg !== "string") {
    console.error("[convert:svg] No SVG content provided in request body");
    return Response.json({ error: "No SVG content provided" }, { status: 400 });
  }

  console.log(`[convert:svg] SVG length: ${svg.length} chars`);
  const svgBuffer = Buffer.from(svg, "utf-8");

  // --- PNG conversion ---
  let pngBuffer;
  try {
    console.log("[convert:svg] Starting PNG conversion via sharp...");
    pngBuffer = await sharp(svgBuffer, { density: 300 }).png().toBuffer();
    console.log(`[convert:svg] PNG conversion succeeded, size: ${pngBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:svg] PNG conversion FAILED:", { message: err.message, stack: err.stack });
    throw new Error(`PNG conversion failed: ${err.message}`);
  }

  // --- AI (PDF-wrapped) conversion ---
  let aiBuffer;
  try {
    console.log("[convert:svg] Starting AI/PDF conversion via svg-to-pdfkit...");
    aiBuffer = await svgToAiBuffer(svg);
    console.log(`[convert:svg] AI conversion succeeded, size: ${aiBuffer.length} bytes`);
  } catch (err) {
    console.error("[convert:svg] AI conversion FAILED:", { message: err.message, stack: err.stack });
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
    console.error("[convert:svg] Zip creation FAILED:", { message: err.message, stack: err.stack });
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
// AI → PNG + SVG (raster-wrapped) + AI (original passthrough)   (FIXED)
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
  console.log(`[convert:ai] Decoded AI buffer, size: ${aiBuffer.length} bytes`);

  // --- PNG conversion (rasterize the PDF-compatible .ai file via mupdf) ---
  // sharp/libvips cannot read PDF input in its standard build, which is why
  // this step was failing before. mupdf is a WASM-based PDF renderer with
  // no native/system dependency, so it works in serverless environments too.
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

    const pixmap = page.toPixmap(matrix, mupdf.ColorSpace.DeviceRGB, false, true);
    pngBuffer = Buffer.from(pixmap.asPNG());

    width = Math.round(pageWidthPt * scale);
    height = Math.round(pageHeightPt * scale);

    console.log(`[convert:ai] PNG conversion succeeded, size: ${pngBuffer.length} bytes (${width}x${height})`);
  } catch (err) {
    console.error("[convert:ai] PNG conversion FAILED:", { message: err.message, stack: err.stack });
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
    console.error("[convert:ai] SVG wrapping FAILED:", { message: err.message, stack: err.stack });
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
    console.error("[convert:ai] Zip creation FAILED:", { message: err.message, stack: err.stack });
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