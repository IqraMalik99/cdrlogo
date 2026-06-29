import { NextResponse } from "next/server";
import {prisma} from "../../../lib/prisma"




export async function POST(req) {
  try {
    const body = await req.json();
    const { categories, mode = "merge" } = body;

    if (!Array.isArray(categories) || categories.length === 0) {
      return NextResponse.json(
        { error: "`categories` must be a non-empty array of { name, slug, type }" },
        { status: 400 }
      );
    }

    // Basic shape validation on every item
    for (const c of categories) {
      if (!c || typeof c !== "object" || !c.name || !c.slug || !c.type) {
        return NextResponse.json(
          { error: "Each category needs name, slug, and type", invalidItem: c },
          { status: 400 }
        );
      }
    }

    // Always use the first Website row
    const website = await prisma.website.findFirst();

    if (!website) {
      return NextResponse.json(
        { error: "No Website row found. Create one first." },
        { status: 404 }
      );
    }

    const existing = Array.isArray(website.categories) ? website.categories : [];

    let updatedCategories;

    if (mode === "replace") {
      updatedCategories = categories;
    } else {
      // merge: index existing by slug, upsert incoming on top
      const bySlug = new Map(existing.map((c) => [c.slug, c]));
      for (const incoming of categories) {
        bySlug.set(incoming.slug, { ...bySlug.get(incoming.slug), ...incoming });
      }
      updatedCategories = Array.from(bySlug.values());
    }

    const updated = await prisma.website.update({
      where: { id: website.id },
      data: { categories: updatedCategories },
    });

    return NextResponse.json({
      success: true,
      mode,
      websiteId: updated.id,
      totalCategories: updatedCategories.length,
      addedOrUpdated: categories.length,
    });
  } catch (err) {
    console.error("Error updating categories:", err);
    return NextResponse.json(
      { error: "Failed to update categories", details: err.message },
      { status: 500 }
    );
  }
}

// GET to inspect current categories
export async function GET() {
  try {
    const website = await prisma.website.findFirst();

    if (!website) {
      return NextResponse.json({ error: "No Website row found" }, { status: 404 });
    }

    return NextResponse.json({
      websiteId: website.id,
      categories: website.categories || [],
    });
  } catch (err) {
    console.error("Error fetching categories:", err);
    return NextResponse.json(
      { error: "Failed to fetch categories", details: err.message },
      { status: 500 }
    );
  }
}