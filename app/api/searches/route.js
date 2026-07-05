import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function normalize(str = "") {
  return String(str).toLowerCase().trim();
}

// ── Levenshtein (kept ONLY for category — the lowest priority tier) ──────────
function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => []);
  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + 1);
    }
  }
  return matrix[b.length][a.length];
}

// Only used for category fuzz — strict: only long queries (6+ chars) get
// a tiny amount of typo tolerance, and only against whole-word category values.
function fuzzyCategoryMatch(query, category) {
  const q = normalize(query);
  if (q.length < 6) return false; // short queries never fuzz — avoids false positives
  const c = normalize(category);
  if (!c) return false;
  return levenshtein(q, c) <= 1; // max 1 typo, whole-string compare only
}

// ── Exact / substring matches (used for title, tags) — NO fuzz, NO tiny-word bugs ──
function exactMatch(query, target) {
  return normalize(target) === normalize(query);
}

function substringMatch(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return false;
  return t.includes(q); // target must contain the FULL query — not the reverse
}

function toTagArray(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => typeof t === "string");
}

function toCategoryArray(category) {
  if (!Array.isArray(category)) return [];
  return category.filter((c) => typeof c === "string");
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    if (!query || !normalize(query)) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const logos = await prisma.logo.findMany({
      where: { publishStatus: "Published" },
      select: {
        id: true,
        logoName: true,
        category: true,
        brand: true,
        description: true,
        tags: true,
        webpUrl: true,
        slug: true,
      },
    });

    const scored = logos
      .map((logo) => {
        let score = 0;
        const name = logo.logoName || "";
        const tags = toTagArray(logo.tags);
        const categories = toCategoryArray(logo.category);

        // Priority 1 — exact title match
        if (exactMatch(query, name)) {
          score = 1000;
        }
        // Priority 2 — partial (substring) title match
        else if (substringMatch(query, name)) {
          score = 500;
        }
        // Priority 3 — tags match (exact or substring, no fuzz)
        else if (tags.some((tag) => exactMatch(query, tag) || substringMatch(query, tag))) {
          score = 200;
        }
        // Priority 4 — category match (substring first, tiny fuzz only as last resort)
        else if (
          categories.some(
            (cat) => substringMatch(query, cat) || fuzzyCategoryMatch(query, cat)
          )
        ) {
          score = 50;
        }

        return { ...logo, score };
      })
      .filter((l) => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    return NextResponse.json({ results: scored });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}