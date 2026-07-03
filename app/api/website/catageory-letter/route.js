import { prisma } from "../../../lib/prisma";

// helper: group categories
function groupCategories(categories = []) {
  const grouped = {};

  categories.forEach((cat) => {
    const name = cat.name || "";
    const firstChar = name[0]?.toUpperCase();

    const key =
      /[0-9]/.test(firstChar) ? "0-9" :
      /[A-Z]/.test(firstChar) ? firstChar :
      "Other";

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(cat);
  });

  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  return grouped;
}

export async function POST(req) {
  try {
    const { letter = "all" } = await req.json();

    const website = await prisma.website.findFirst();
    if (!website?.categories) return Response.json({});

    const clean = [...new Map(
      website.categories.map(c => [c.slug, c])
    ).values()];

    // ── keep only categories actually used by a published logo ──
    const logos = await prisma.logo.findMany({
      where: { publishStatus: "Published" },
      select: { category: true },
    });

    const activeKeys = new Set();
    for (const logo of logos) {
      if (!Array.isArray(logo.category)) continue;
      for (const cat of logo.category) {
        if (typeof cat === "string" && cat.trim()) {
          activeKeys.add(cat.trim().toLowerCase());
        }
      }
    }

    const active = clean.filter(c =>
      activeKeys.has(c.slug?.trim().toLowerCase()) ||
      activeKeys.has(c.name?.trim().toLowerCase())
    );

    const grouped = groupCategories(active);

    if (letter === "all") {
      return Response.json(grouped);
    }

    const key = letter === "0-9" ? "0-9" : letter.toUpperCase();
    return Response.json({ [key]: grouped[key] || [] });

  } catch (error) {
    console.error("[POST] fetch categories", error);
    return Response.json({ error: "Failed to fetch categories" }, { status: 500 });
  }
}