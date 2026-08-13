import { prisma } from "../../../lib/prisma";

// --- Fuzzy helpers -----------------------------------------------------------

function isLooseMatch(query, target) {
  if (!query) return true;
  if (!target) return false;
  return target.toLowerCase().includes(query.toLowerCase().trim());
}

function searchFilter(logos, query) {
  const q = (query || "").trim();
  if (!q) return logos;
  return logos.filter(
    (logo) =>
      isLooseMatch(q, logo.logoName ?? "") ||
      isLooseMatch(q, logo.description ?? "")
  );
}

// --- Category helpers ---------------------------------------------------------

function isTemplateCategory(value) {
  if (value == null) return false;

  if (Array.isArray(value)) {
    return value.some((v) => String(v).toLowerCase().trim() === "template");
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.some((v) => String(v).toLowerCase().trim() === "template");
        }
      } catch {
        // not valid JSON — fall through to plain string check
      }
    }
    return trimmed.toLowerCase() === "template";
  }

  return false;
}

// --- Route handler -----------------------------------------------------------

export async function POST(req) {
  try {
    console.log("🔥 API HIT");

    const body = await req.json();
    console.log("📦 Request Body:", body);

    const { page = 1, search = "" } = body;

    const website = await prisma.website.findFirst({
      select: { limit: true },
    });
    const limitNum = Math.max(1, Number(website?.limit) || 8);
    console.log(`📦 Limit: ${limitNum}`);

    // Query only logos whose category array contains "template"
    const candidates = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
        category: { has: "template" },
      },
      select: {
        id: true,
        slug: true,
        logoName: true,
        category: true,
        description: true,
        brandColors: true,
        webpUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Defensive re-check in JS, in case category is stored as a stringified
    // array / plain string rather than a native array (same tolerance as before)
    const templateLogos = candidates.filter((logo) =>
      isTemplateCategory(logo.category)
    );
    console.log(`🏷️ Template logos found: ${templateLogos.length}`);

    const trimmedSearch = String(search || "").trim();

    const finalResults = trimmedSearch
      ? searchFilter(templateLogos, trimmedSearch)
      : templateLogos;

    const total = finalResults.length;

    const pageNum = Math.max(1, Number(page) || 1);
    const skip = (pageNum - 1) * limitNum;
    const logos = finalResults.slice(skip, skip + limitNum);

    console.log(`🖼️ Page ${pageNum}: ${logos.length} logos / ${total} total (search: "${trimmedSearch || "(none)"}")`);

    return Response.json({
      logos,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error("💥 ERROR:", err);
    return Response.json(
      { message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  }
}