import { prisma } from "../../../../lib/prisma";

function slugify(str = "") {
  return str
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function toWords(str = "") {
  return str
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s-]/g, "")
    .split(/[\s-]+/)
    .filter(Boolean);
}

// Levenshtein edit distance
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
}

// Similarity 0..1 between two words (1 = identical)
function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

// Score how well targetWords match a category name's words.
// Each target word is matched against its BEST word in the name; average the best scores.
function scoreMatch(targetWords, nameWords) {
  if (!targetWords.length || !nameWords.length) return 0;
  let total = 0;
  for (const tw of targetWords) {
    let best = 0;
    for (const nw of nameWords) {
      const s = wordSimilarity(tw, nw);
      if (s > best) best = s;
    }
    total += best;
  }
  return total / targetWords.length;
}

export async function GET(req, { params }) {
  try {
 console.log("🔥🔥🔥 GET HANDLER CALLED");
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const search = (searchParams.get("search") || "").trim().toLowerCase();
    const sort = searchParams.get("sort") || "az";
   console.log(`[GET] enter category group slug=${slug} search=${search} sort=${sort}`);
    const website = await prisma.website.findFirst();
    if (!website?.categories) {
      return Response.json({ error: "No categories configured" }, { status: 404 });
    }

    const targetSlug = slugify(slug);
    const targetWords = toWords(targetSlug);

    // Unique main category names present in the data
    const uniqueNames = [...new Set(website.categories.map((c) => c?.name).filter(Boolean))];

    // Score every main category name against the requested slug, fuzzy word-by-word
    let bestName = null;
    let bestScore = 0;
    for (const name of uniqueNames) {
      const nameWords = toWords(name);
      const score = scoreMatch(targetWords, nameWords);
      if (score > bestScore) {
        bestScore = score;
        bestName = name;
      }
    }

    // Threshold: require a reasonably confident match (tune if needed)
    const MIN_SCORE = 0.6;
    if (!bestName || bestScore < MIN_SCORE) {
      return Response.json({ error: "Category not found" }, { status: 404 });
    }

    const categoryName = bestName;

    const subMap = new Map();
    for (const c of website.categories) {
      if (c?.name !== categoryName) continue;
      const key = (c.subname || "").trim().toLowerCase();
      if (!key || subMap.has(key)) continue;
      subMap.set(key, {
        name: c.subname,
        slug: slugify(c.slug || c.subname),
      });
    }

    const logos = await prisma.logo.findMany({
      where: { publishStatus: "Published" },
      select: { category: true },
    });

    const countMap = new Map();
    for (const logo of logos) {
      const cats = Array.isArray(logo.category)
        ? logo.category
        : typeof logo.category === "string"
        ? [logo.category]
        : [];
      for (const cat of cats) {
        if (typeof cat !== "string" || !cat.trim()) continue;
        const key = cat.trim().toLowerCase();
        countMap.set(key, (countMap.get(key) || 0) + 1);
      }
    }

    let subcategories = Array.from(subMap.values()).map((s) => ({
      ...s,
      count: countMap.get(s.name.trim().toLowerCase()) || 0,
    }));

    // ── Fix: drop any subcategory with zero published logos ────────────────
    // Previously every subcategory from the taxonomy sheet was returned
    // regardless of whether any logo actually existed for it, so empty
    // subcategories showed up on the frontend. Only keep ones with count > 0.
    subcategories = subcategories.filter((s) => s.count > 0);

    const totalLogos = subcategories.reduce((sum, s) => sum + s.count, 0);

    if (search) {
      subcategories = subcategories.filter((s) => s.name.toLowerCase().includes(search));
    }

    subcategories.sort((a, b) =>
      sort === "count" ? b.count - a.count : a.name.localeCompare(b.name)
    );

    return Response.json({
      categoryName,
      slug: targetSlug,
      matchScore: bestScore, // handy for debugging fuzzy matches in dev
      totalLogos,
      totalSubcategories: subcategories.length,
      subcategories,
    });
  } catch (error) {
    console.error("[GET] category group", error);
    return Response.json({ error: "Failed to fetch category group" }, { status: 500 });
  }
}