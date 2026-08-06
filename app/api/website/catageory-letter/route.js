import { prisma } from "../../../lib/prisma";

// helper: group categories
function groupCategories(categories = []) {
  const grouped = {};

  categories.forEach((cat) => {
    const name = cat.name || "";
    const firstChar = name[0]?.toUpperCase();

    const key =
      /[0-9]/.test(firstChar)
        ? "0-9"
        : /[A-Z]/.test(firstChar)
          ? firstChar
          : "Other";

    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(cat);
  });

  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => a.subname.localeCompare(b.subname));
  });

  const order = [
    "0-9",
    ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
    "Other",
  ];

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

    if (!website?.categories) {
      return Response.json({});
    }

    // Keep only ONE record per Main + Sub Category
    const uniqueCategories = [
      ...new Map(
        website.categories.map((c) => [
          `${c.name.trim().toLowerCase()}|${c.subname.trim().toLowerCase()}`,
          {
            name: c.name,
            subname: c.subname,
            slug: c.name,
          },
        ])
      ).values(),
    ];

    console.log("Unique categories:", uniqueCategories.length);

    // Published logos
    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
      },
      select: {
        category: true,
      },
    });

    // Active subcategories (handles both String[] and legacy string)
    const activeKeys = new Set();

    for (const logo of logos) {
      const cats = Array.isArray(logo.category)
        ? logo.category
        : typeof logo.category === "string"
        ? [logo.category]
        : [];

      for (const cat of cats) {
        if (typeof cat === "string" && cat.trim()) {
          activeKeys.add(cat.trim().toLowerCase());
        }
      }
    }

    // Match logo.category === website.subname
    const active = uniqueCategories.filter((cat) =>
      activeKeys.has(cat.subname.trim().toLowerCase())
    );

    // ✅ Dedupe down to ONE entry per main category name
    const activeMainCategories = [
      ...new Map(
        active.map((cat) => [cat.name.trim().toLowerCase(), cat])
      ).values(),
    ];

    const grouped = groupCategories(activeMainCategories);

    if (letter === "all") {
      return Response.json(grouped);
    }

    const key =
      letter === "0-9"
        ? "0-9"
        : letter.toUpperCase();

    return Response.json({
      [key]: grouped[key] || [],
    });

  } catch (error) {
    console.error("[POST] fetch categories", error);

    return Response.json(
      {
        error: "Failed to fetch categories",
      },
      {
        status: 500,
      }
    );
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