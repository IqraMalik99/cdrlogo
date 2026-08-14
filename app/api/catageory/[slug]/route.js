import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const DEFAULT_PAGE_SIZE = 12;

// Normalizes a slug/category string for comparison:
//  - lowercase
//  - "&" and standalone "and" are treated as filler and dropped
//    ("advertising-and-marketing" and "advertising-marketing" and
//    "Advertising & Marketing" all normalize the same way)
//  - punctuation stripped, whitespace collapsed
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/-/g, " ")
    .replace(/&/g, " ")
    .replace(/\band\b/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function findLogosBySlug(slug, { page = 1, limit = DEFAULT_PAGE_SIZE } = {}) {
  const rawSearchTerm = String(slug || "").replace(/-/g, " ").trim();
  const normalizedSearch = normalize(slug);

  if (!normalizedSearch) {
    return { error: "Missing slug" };
  }

  const published = { in: ["published", "Published"] };

  // Step 1: slim projection — id + category only. Cheap to transfer and
  // cheap to filter, no matter how many logos exist.
  const candidates = await prisma.logo.findMany({
    where: {
      publishStatus: published,
      category: { isEmpty: false },
    },
    select: { id: true, category: true },
  });

  // Still an exact match — just exact on the *normalized* form, so filler
  // words/punctuation differences don't cause a miss.
  const matchesExact = (cats) =>
    Array.isArray(cats) && cats.some((cat) => normalize(cat) === normalizedSearch);

  const matched = candidates.filter((logo) => matchesExact(logo.category));

  // Display name uses the actual stored casing/wording from the first match.
  let categoryName = rawSearchTerm;
  for (const logo of matched) {
    const hit = (logo.category || []).find((cat) => normalize(cat) === normalizedSearch);
    if (hit) {
      categoryName = hit.trim();
      break;
    }
  }

  const safeLimit = Math.min(100, Math.max(1, Number(limit) || DEFAULT_PAGE_SIZE));
  const totalCount = matched.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / safeLimit));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * safeLimit;
  const pageIds = matched.slice(start, start + safeLimit).map((m) => m.id);

  if (!pageIds.length) {
    return {
      logos: [],
      totalCount,
      totalPages,
      page: safePage,
      limit: safeLimit,
      categoryName,
    };
  }

  // Step 2: fetch full rows only for the page being returned.
  const pageLogosUnordered = await prisma.logo.findMany({
    where: { id: { in: pageIds } },
  });

  // `findMany` with `id: { in: [...] }` doesn't guarantee result order
  // matches pageIds order, so re-sort to match the filtered/sorted order.
  const orderIndex = new Map(pageIds.map((id, i) => [id, i]));
  const pageLogos = pageLogosUnordered.sort(
    (a, b) => orderIndex.get(a.id) - orderIndex.get(b.id)
  );

  return {
    logos: pageLogos,
    totalCount,
    totalPages,
    page: safePage,
    limit: safeLimit,
    categoryName,
  };
}

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page") || 1;
    const limit = searchParams.get("limit") || DEFAULT_PAGE_SIZE;

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const result = await findLogosBySlug(slug, { page, limit });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    if (!result.logos.length) {
      return NextResponse.json(
        { logos: [], totalCount: 0, totalPages: 1, page: 1, categoryName: result.categoryName },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[GET] ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch logos" }, { status: 500 });
  }
}

export async function POST(req, { params }) {
  try {
    const { slug } = await params;
    let body = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const page = body.page || 1;
    const limit = body.limit || DEFAULT_PAGE_SIZE;

    console.log("[POST] slug:", slug, "page:", page);

    if (!slug) {
      return NextResponse.json({ error: "Missing slug" }, { status: 400 });
    }

    const result = await findLogosBySlug(slug, { page, limit });
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    console.log("[POST] matched logos count:", result.totalCount);

    if (!result.logos.length) {
      return NextResponse.json(
        { logos: [], totalCount: 0, totalPages: 1, page: 1, categoryName: result.categoryName },
        { status: 404 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[POST] ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch logos" }, { status: 500 });
  }
}