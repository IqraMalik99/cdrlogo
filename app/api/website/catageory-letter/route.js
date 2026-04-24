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

  // sort properly by name (NOT object)
  Object.keys(grouped).forEach((key) => {
    grouped[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  return grouped;
}

export async function POST(req) {
  try {
    const { letter = "all" } = await req.json();

    const website = await prisma.website.findFirst();

    if (!website?.categories) {
      return Response.json({});
    }

    const clean = [...new Map(
      website.categories.map(c => [c.slug, c])
    ).values()];

    const grouped = groupCategories(clean);

    if (letter === "all") {
      return Response.json(grouped);
    }

    const key = letter === "0-9" ? "0-9" : letter.toUpperCase();

    return Response.json({
      [key]: grouped[key] || [],
    });

  } catch (error) {
    return Response.json(
      { error: "Failed to fetch categories" },
      { status: 500 }
    );
  }
}


export async function PATCH(req) {
  try {
    const { name, slug, type } = await req.json();
 
    if (!name?.trim()) return Response.json({ message: "Name is required."             }, { status: 400 });
    if (!slug?.trim()) return Response.json({ message: "Slug is required."             }, { status: 400 });
    if (!["brand", "template"].includes(type))
      return Response.json({ message: "Type must be brand or template."}, { status: 400 });
 
    const website    = await prisma.website.findFirst();
    if (!website)    return Response.json({ message: "Website not found."              }, { status: 404 });
 
    const categories = Array.isArray(website.categories) ? website.categories : [];
 
    if (categories.some(c => c.slug === slug))
      return Response.json({ message: "A category with that slug already exists."     }, { status: 409 });
 
    const updated = [...categories, { name: name.trim(), slug: slug.trim(), type }];
 
    await prisma.website.update({ where: { id: website.id }, data: { categories: updated } });
 
    return Response.json({ success: true, category: { name: name.trim(), slug: slug.trim(), type } });
 
  } catch (error) {
    console.error("[PATCH] add category", error);
    return Response.json({ message: "Failed to add category." }, { status: 500 });
  }
}