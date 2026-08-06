import { prisma } from "../../../lib/prisma";

const PAGE_SIZE = 12;

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

function wordSimilarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.9;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return 1 - dist / maxLen;
}

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

// Shared resolver: given a URL slug, find the closest real category value
// among PUBLISHED logos, then return paginated results for it.
async function resolveCategoryAndFetch(slug, page) {
  const targetSlug = slugify(slug);
  const targetWords = toWords(targetSlug);

  const logos = await prisma.logo.findMany({
    where: { publishStatus: "Published" }, // ✅ restored — only published logos count
    select: { category: true },
  });

  const uniqueCategories = new Set();
  for (const logo of logos) {
    const cats = Array.isArray(logo.category)
      ? logo.category
      : typeof logo.category === "string"
      ? [logo.category]
      : [];
    for (const cat of cats) {
      if (typeof cat === "string" && cat.trim()) {
        uniqueCategories.add(cat.trim());
      }
    }
  }

  let bestCategory = null;
  let bestScore = 0;
  for (const cat of uniqueCategories) {
    const nameWords = toWords(cat);
    const score = scoreMatch(targetWords, nameWords);
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }

  const MIN_SCORE = 0.6;
  if (!bestCategory || bestScore < MIN_SCORE) {
    return {
      status: 404,
      body: { logos: [], totalPages: 1, categoryName: slug.replace(/-/g, " "), matchScore: bestScore },
    };
  }

  const where = {
    publishStatus: "Published", 
    category: { has: bestCategory },
  };

  const totalCount = await prisma.logo.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  const results = await prisma.logo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  return {
    status: 200,
    body: {
      logos: results,
      totalPages,
      totalCount,
      categoryName: bestCategory,
      matchScore: bestScore,
    },
  };
}

// Used by page.jsx (SSR / generateMetadata) — plain GET, ?page= query param
export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

    const { status, body } = await resolveCategoryAndFetch(slug, page);
    return Response.json(body, { status });
  } catch (error) {
    console.error("[GET] category logos", error);
    return Response.json({ error: "Failed to fetch logos" }, { status: 500 });
  }
}

// Used by Client.jsx for pagination clicks — page in the POST body
export async function POST(req, { params }) {
  try {
    const { slug } = await params;
    const body = await req.json().catch(() => ({}));
    const page = Math.max(1, parseInt(body.page || 1, 10));

    const { status, body: resBody } = await resolveCategoryAndFetch(slug, page);
    return Response.json(resBody, { status });
  } catch (error) {
    console.error("[POST] category logos", error);
    return Response.json({ error: "Failed to fetch logos" }, { status: 500 });
  }
}