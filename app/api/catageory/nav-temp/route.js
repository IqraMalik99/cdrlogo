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
 * template-category scoping already happened before this runs.
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
 * Logo.category is a Prisma String[]. Returns true if "template" is one of
 * the elements (case-insensitive, trimmed). Defensive check kept after the
 * DB-level `has` filter in case of casing/whitespace drift in stored data.
 */
function isTemplateCategory(value) {
  if (!Array.isArray(value)) return false;
  return value.some((v) => String(v).toLowerCase().trim() === "template");
}

// --- Route handler -----------------------------------------------------------

export async function POST(req) {
  try {
    console.log("🔥 API HIT");

    const body = await req.json();
    console.log("📦 Request Body:", body);

    const {
      page = 1,
      limit = 12,
      search = "",
    } = body;

    // 1. Fetch ALL logos whose category array contains "template".
    //    category is Prisma String[] — use `has` for an exact element match
    //    at the DB level. isTemplateCategory below is a defensive re-check.
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

    const templateLogos = candidates.filter((logo) => isTemplateCategory(logo.category));
    console.log(`🏷️ Template-category logos found: ${templateLogos.length}`);

    // 2. Search step — only runs if `search` is non-empty. No search → no
    //    fuzzy logic at all, just paginate the template set directly.
    const trimmedSearch = String(search || "").trim();

    const finalResults = trimmedSearch
      ? searchFilter(templateLogos, trimmedSearch)
      : templateLogos;

    const total = finalResults.length;

    // 3. Paginate the (possibly search-filtered) template results.
    const skip = (Number(page) - 1) * Number(limit);
    const logos = finalResults.slice(skip, skip + Number(limit));

    console.log(`🖼️ Page ${page}: ${logos.length} logos / ${total} total (search: "${trimmedSearch || "(none)"}")`);

    return Response.json({
      logos,
      total,
      page: Number(page),
      limit: Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
    });
  } catch (err) {
    console.error("💥 ERROR:", err);
    return Response.json(
      { message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  }
}