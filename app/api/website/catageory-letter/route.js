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

  // Re-insert keys in alphabetic order: "0-9" first, then A-Z, "Other" last.
  // Plain Object.keys()/insertion order otherwise reflects whichever letter
  // was encountered first while looping over categories, not A-Z.
  const order = ["0-9", ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)), "Other"];
  const sortedGrouped = {};
  order.forEach((key) => {
    if (grouped[key]) sortedGrouped[key] = grouped[key];
  });

  return sortedGrouped;
}

export async function POST(req) {
  try {
    const { letter = "all" } = await req.json();

    const website = await prisma.website.findFirst();
    if (!website?.categories) return Response.json({});

    const clean = [...new Map(
      website.categories.map(c => [c.slug, c])
    ).values()];


    console.log("total categories in DB:", clean.length);

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

export async function PUT(req) {
  try {
    const { letter = "all", showAll = false } = await req.json();

    const website = await prisma.website.findFirst();
    if (!website?.categories) return Response.json({});

    const clean = [...new Map(
      website.categories.map(c => [c.slug, c])
    ).values()];

    console.log("total categories in DB:", clean.length);

    let visible = clean;

    // ── Public pages only see categories used by a published logo ──
    if (!showAll) {
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

      visible = clean.filter(c =>
        activeKeys.has(c.slug?.trim().toLowerCase()) ||
        activeKeys.has(c.name?.trim().toLowerCase())
      );
    }

    console.log("visible categories:", visible.length);

    const grouped = groupCategories(visible);

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