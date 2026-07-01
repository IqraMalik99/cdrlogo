import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

function normalize(str = "") {
  return String(str).toLowerCase().trim();
}

// split into normalized alphanumeric words
function toWords(str = "") {
  return normalize(str)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

// dynamic typo tolerance: stricter for short words, looser for long ones
function threshold(len) {
  if (len <= 3) return 0;   // no fuzz on tiny words, avoid false positives
  if (len <= 5) return 1;
  return 2;
}

// lightweight levenshtein (no libs)
function levenshtein(a, b) {
  const matrix = Array.from({ length: b.length + 1 }, () => []);

  for (let i = 0; i <= b.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

// word-level fuzzy match: query word vs single target word
function wordMatch(q, w) {
  if (!w) return false;
  if (w.includes(q) || q.includes(w)) return true;
  return levenshtein(q, w) <= threshold(Math.max(q.length, w.length));
}

// query can be multi-word ("drgn logo") — every query word must
// fuzzy-match at least one word in the target
function isMatch(query, target) {
  const qWords = toWords(query);
  const tWords = toWords(target);
  if (qWords.length === 0 || tWords.length === 0) return false;

  return qWords.every((qw) => tWords.some((tw) => wordMatch(qw, tw)));
}

// tags is stored as Json, expected shape: ["graphics", "fashion"]
// guard against null / bad data / non-string entries from older rows
function toTagArray(tags) {
  if (!Array.isArray(tags)) return [];
  return tags.filter((t) => typeof t === "string");
}

// true if ANY tag in the array matches the query
function isTagMatch(query, tags) {
  return toTagArray(tags).some((tag) => isMatch(query, tag));
}

export async function POST(req) {
  try {
    const { query } = await req.json();

    if (!query) {
      return NextResponse.json({ error: "query is required" }, { status: 400 });
    }

    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
      },
      select: {
        id: true,
        logoName: true,
        category: true,
        brand: true,
        description: true,
        tags: true,
        webpUrl: true,
        slug: true
      },
    });

    const scored = logos
      .map((logo) => {
        let score = 0;

        // 🥇 highest priority: name
        if (isMatch(query, logo.logoName)) score += 100;

        // 🥈 category
        if (isMatch(query, logo.category)) score += 70;

        // 🥉 brand/company
        if (isMatch(query, logo.brand)) score += 50;

        // tags — same priority tier as brand
        if (isTagMatch(query, logo.tags)) score += 50;

        // low priority: description
        // if (isMatch(query, logo.description)) score += 20;

        return { ...logo, score };
      })
      .filter((l) => l.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20); // top results

    return NextResponse.json({
      results: scored,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500 }
    );
  }
}