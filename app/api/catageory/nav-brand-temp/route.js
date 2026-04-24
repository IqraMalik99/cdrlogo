import { prisma } from "../../../lib/prisma";

// --- Fuzzy helpers -----------------------------------------------------------

/**
 * Levenshtein distance between two strings (case-insensitive).
 */
function levenshtein(a, b) {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

/**
 * Returns true when the query is "close enough" to the target.
 * Threshold scales with query length so short words are stricter.
 */
function isFuzzyMatch(query, target) {
  query  = query.toLowerCase().trim();
  target = target.toLowerCase();

  if (target.includes(query)) return true;          // exact substring wins immediately

  const maxDist = query.length <= 4 ? 1             // "cat"  → 1 typo allowed
                : query.length <= 7 ? 2             // "fason" → 2 typos allowed
                : 3;                                // longer → 3 typos allowed

  // Check against every word in the target so "Nike Air" matches "Aor"
  return target.split(/\s+/).some(
    (word) => levenshtein(query, word) <= maxDist
  );
}

/**
 * Post-filter an array of logo objects by fuzzy query.
 */
function fuzzyFilter(logos, query) {
  if (!query || !query.trim()) return logos;
  return logos.filter(
    (logo) =>
      isFuzzyMatch(query, logo.logoName ?? "") ||
      isFuzzyMatch(query, logo.category ?? "")
  );
}

// --- Route handler -----------------------------------------------------------

export async function POST(req) {
  try {
    console.log("🔥 API HIT");

    const body = await req.json();
    console.log("📦 Request Body:", body);

    const {
      type,
      page     = 1,
      limit    = 12,
      category = "All",
      search   = "",
    } = body;

    if (!type) {
      return Response.json({ message: "Type is required" }, { status: 400 });
    }

    // 1. Fetch website → categories
    const website = await prisma.website.findFirst();
    if (!website) {
      return Response.json({ message: "Website not found" }, { status: 404 });
    }

    const categories         = Array.isArray(website.categories) ? website.categories : [];
    const filteredCategories = categories.filter((cat) => cat.type === type);
    const allSlugs           = filteredCategories.map((cat) => cat.name);

    console.log("🏷️ Category Slugs:", allSlugs);

    // 2. Base Prisma where clause (no search filter — fuzzy runs in JS)
    const where = {
      publishStatus: "Published",
      category: {
        in: category === "All" ? allSlugs : [category],
      },
    };

    // 3. When there is a search term, fetch ALL matching candidates from DB
    //    and apply fuzzy filtering in JS; otherwise paginate directly in DB.
    let logos, total;
    const trimmedSearch = search.trim();

    if (trimmedSearch) {
      // Pull every published logo in scope (no pagination yet — fuzzy needs all rows)
      const candidates = await prisma.logo.findMany({
        where,
        select: {
          id:          true,
          logoName:    true,
          category:    true,
          brandColors: true,
          webpUrl:     true,
          createdAt:   true,
        },
        orderBy: { createdAt: "desc" },
      });

      // Fuzzy-filter in JS
      const fuzzyResults = fuzzyFilter(candidates, trimmedSearch);

      total = fuzzyResults.length;

      // Paginate the fuzzy results manually
      const skip = (Number(page) - 1) * Number(limit);
      logos = fuzzyResults.slice(skip, skip + Number(limit));
    } else {
      // No search → pure DB pagination (fast)
      const skip = (Number(page) - 1) * Number(limit);

      [total, logos] = await Promise.all([
        prisma.logo.count({ where }),
        prisma.logo.findMany({
          where,
          select: {
            id:          true,
            logoName:    true,
            category:    true,
            brandColors: true,
            webpUrl:     true,
            createdAt:   true,
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: Number(limit),
        }),
      ]);
    }

    // 4. Category list for filter tabs (always unfiltered by search)
    const categoryList = [
      "All",
      ...new Set(
        (
          await prisma.logo.findMany({
            where: { publishStatus: "Published", category: { in: allSlugs } },
            select: { category: true },
            distinct: ["category"],
          })
        ).map((l) => l.category)
      ),
    ];

    console.log(`🖼️ Page ${page}: ${logos.length} logos / ${total} total`);

    return Response.json({
      logos,
      total,
      page:       Number(page),
      limit:      Number(limit),
      totalPages: Math.ceil(total / Number(limit)),
      categories: categoryList,
    });
  } catch (err) {
    console.error("💥 ERROR:", err);
    return Response.json(
      { message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  }
}