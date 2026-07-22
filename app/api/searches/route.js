import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function normalize(str = "") {
  return String(str).toLowerCase().trim();
}

// ── Levenshtein — used for fuzzy name matching (typo tolerance) ─────────────
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

function exactMatch(query, target) {
  return normalize(target) === normalize(query);
}

function substringMatch(query, target) {
  const q = normalize(query);
  const t = normalize(target);
  if (!q || !t) return false;
  return t.includes(q); // target must contain the FULL query
}

// Fuzzy match against the logo name — typo tolerance scales with query length
// so short queries ("hp", "bp") never fuzz into unrelated names.
function fuzzyNameMatch(query, name) {
  const q = normalize(query);
  const n = normalize(name);
  if (!q || !n) return false;
  if (q.length < 4) return false; // too short to safely fuzz

  const maxDistance = q.length >= 8 ? 2 : 1;

  // Compare against the full name, and against each individual word in the
  // name (handles multi-word logo names like "Coca Cola" matching "coca").
  if (levenshtein(q, n) <= maxDistance) return true;

  const words = n.split(/\s+/).filter(Boolean);
  return words.some((w) => w.length >= 4 && levenshtein(q, w) <= maxDistance);
}

// ── Tag match — fallback only, used when no name-based match is found ──────
function tagMatch(query, tags) {
  const q = normalize(query);
  if (!q || !Array.isArray(tags)) return false;

  return tags.some((tag) => {
    const t = normalize(tag);
    if (!t) return false;
    return t.includes(q) || q.includes(t);
  });
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

    let scored = logos
      .map((logo) => {
        let score = 0;
        const name = logo.logoName || "";

        // Priority 1 — exact name match
        if (exactMatch(query, name)) {
          score = 1000;
        }
        // Priority 2 — partial (substring) name match
        else if (substringMatch(query, name)) {
          score = 500;
        }
        // Priority 3 — fuzzy name match (typo tolerance)
        else if (fuzzyNameMatch(query, name)) {
          score = 100;
        }

        return { ...logo, score };
      })
      .filter((l) => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);

    // ── Fallback — nothing matched by name, try tags ONCE (no further retries) ──
    if (scored.length === 0) {
      scored = logos
        .map((logo) => ({ ...logo, score: tagMatch(query, logo.tags) ? 50 : 0 }))
        .filter((l) => l.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 20);
    }

    return NextResponse.json({ results: scored });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}