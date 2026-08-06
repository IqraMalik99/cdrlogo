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

/**
 * Returns true if the FIRST item of logo.category starts with "other"
 * (case-insensitive). Tolerates the same array / JSON-stringified-array /
 * plain-string shapes as isTemplateCategory.
 */
function firstCategoryStartsWithOther(value) {
  let firstItem = null;

  if (Array.isArray(value)) {
    firstItem = value[0];
  } else if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) firstItem = parsed[0];
      } catch {
        firstItem = trimmed;
      }
    } else {
      firstItem = trimmed;
    }
  }

  if (firstItem == null) return false;
  return String(firstItem).trim().toLowerCase().startsWith("other");
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

    const candidates = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
        NOT: {
          category: { has: "template" },
        },
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

    const nonTemplateLogos = candidates.filter(
      (logo) =>
        !isTemplateCategory(logo.category) &&
        !firstCategoryStartsWithOther(logo.category)
    );
    console.log(`🏷️ Non-template, non-"other"-first logos found: ${nonTemplateLogos.length}`);

    const trimmedSearch = String(search || "").trim();

    const finalResults = trimmedSearch
      ? searchFilter(nonTemplateLogos, trimmedSearch)
      : nonTemplateLogos;

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