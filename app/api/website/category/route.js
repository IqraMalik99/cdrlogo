import { prisma } from "../../../lib/prisma";

function slugify(str = "") {
  return str
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function POST(req) {
  try {
    const { name, slug: rawSlug, type, url = "" } = await req.json();

    if (!name?.trim()) {
      return Response.json({ message: "Name is required." }, { status: 400 });
    }

    const slug = rawSlug?.trim() ? slugify(rawSlug) : slugify(name);
    if (!slug) {
      return Response.json({ message: "Slug is required." }, { status: 400 });
    }

    if (!["brand", "template"].includes(type)) {
      return Response.json({ message: "Type must be brand or template." }, { status: 400 });
    }

    let website = await prisma.website.findFirst();
    if (!website) {
      website = await prisma.website.create({ data: { categories: [] } });
    }

    const categories = Array.isArray(website.categories) ? website.categories : [];

    if (categories.some(c => c.slug === slug)) {
      return Response.json(
        { message: "A category with that slug already exists." },
        { status: 409 }
      );
    }

    const newCategory = { name: name.trim(), slug, type, url: url.trim() };
    const updated = [...categories, newCategory];

    await prisma.website.update({
      where: { id: website.id },
      data: { categories: updated },
    });

    return Response.json({ success: true, category: newCategory }, { status: 201 });

  } catch (error) {
    console.error("[POST] create category", error);
    return Response.json({ message: "Failed to create category." }, { status: 500 });
  }
}