import { prisma } from "../../../lib/prisma";

// --- Fuzzy helpers -----------------------------------------------------------

/**
 * Returns true when `query` is found "loosely" inside `target` — a partial,
 * substring-style match. Even a half-typed word matches as long as its
 * characters appear as a contiguous run inside the target (case-insensitive).
 *
 * Examples: "log" matches "Logo", "nik" matches "Nike", "desc" matches
 * "description text here".
 */
function isLooseMatch(query, target) {
  if (!query) return true;
  if (!target) return false;
  return target.toLowerCase().includes(query.toLowerCase().trim());
}

/**
 * Post-filter an array of logo objects by loose/partial search on
 * logoName + description only. Category is never touched here — the
 * non-template-category scoping already happened before this runs.
 */
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

/**
 * Logo.category is a Prisma String, but tolerate it occasionally holding a
 * JSON-stringified array (e.g. '["template","other"]') instead of a plain
 * string. Returns true if "template" is present either way.
 */
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

    // Limit ab frontend se nahi, DB (Website.LogoLimit) se aayega
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

    const nonTemplateLogos = candidates.filter((logo) => !isTemplateCategory(logo.category));
    console.log(`🏷️ Non-template-category logos found: ${nonTemplateLogos.length}`);

    // 2. Search step — only runs if `search` is non-empty. No search → no
    //    fuzzy logic at all, just paginate the non-template set directly.
    const trimmedSearch = String(search || "").trim();

    const finalResults = trimmedSearch
      ? searchFilter(nonTemplateLogos, trimmedSearch)
      : nonTemplateLogos;

    const total = finalResults.length;

    // 3. Paginate the (possibly search-filtered) non-template results.
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