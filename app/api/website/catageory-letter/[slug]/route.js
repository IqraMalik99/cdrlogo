import {prisma} from "../../../../lib/prisma";

export async function PUT(req, context) {
  try {
     const { params } = context;
    const { slug: oldSlug } = await params
    console.log("PUT /api/website/catageory-letter/:slug", { oldSlug });

    const { name, slug: newSlug, type } = await req.json();
 
    if (!name?.trim())    return Response.json({ message: "Name is required."  }, { status: 400 });
    if (!newSlug?.trim()) return Response.json({ message: "Slug is required."  }, { status: 400 });
    if (!["brand", "template"].includes(type))
      return Response.json({ message: "Type must be brand or template." }, { status: 400 });
 
    const website = await prisma.website.findFirst();
 
    if (!website) {
      return Response.json({ message: "Website record not found." }, { status: 404 });
    }
 
    const categories = Array.isArray(website.categories) ? website.categories : [];
 
    // Make sure the category we're editing actually exists
    const exists = categories.some(c => c.slug === oldSlug);
    if (!exists) {
      return Response.json({ message: "Category not found." }, { status: 404 });
    }
 
    // If slug is changing, make sure the new slug isn't already taken
    if (newSlug !== oldSlug && categories.some(c => c.slug === newSlug)) {
      return Response.json({ message: "A category with that slug already exists." }, { status: 409 });
    }
 
    // Replace the matched entry in place (keeps order)
    const updated = categories.map(c =>
      c.slug === oldSlug
        ? { ...c, name: name.trim(), slug: newSlug.trim(), type }
        : c
    );
 
    await prisma.website.update({
      where: { id: website.id },
      data:  { categories: updated },
    });
 
    return Response.json({ success: true, category: { name: name.trim(), slug: newSlug.trim(), type } });
 
  } catch (error) {
    console.error("[PUT /api/admin/categories/:slug]", error);
    return Response.json({ message: "Failed to update category." }, { status: 500 });
  }
}
 
// ── DELETE /api/admin/categories/:slug ───────────────────────────────────────
export async function DELETE(_req, context) {
  try {
    const { params } = context;
      const { slug: oldSlug } = await params

    const website = await prisma.website.findFirst();

    if (!website) {
      return Response.json(
        { message: "Website record not found." },
        { status: 404 }
      );
    }

    const categories = Array.isArray(website.categories)
      ? website.categories
      : [];

    // ✅ check existence
    const exists = categories.some(c => c.slug === oldSlug);
    if (!exists) {
      return Response.json(
        { message: "Category not found." },
        { status: 404 }
      );
    }

    // ✅ remove category
    const updated = categories.filter(c => c.slug !== oldSlug);

    await prisma.website.update({
      where: { id: website.id },
      data: { categories: updated },
    });

    return Response.json({
      success: true,
      deleted: oldSlug,
    });

  } catch (error) {
    console.error("[DELETE /api/admin/categories/:slug]", error);
    return Response.json(
      { message: "Failed to delete category." },
      { status: 500 }
    );
  }
}