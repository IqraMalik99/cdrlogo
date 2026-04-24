import { prisma } from "../../lib/prisma";

// ✅ CREATE or UPDATE (singleton)
export async function POST(req) {
  try {
    const body = await req.json();
    const { categories, navItems } = body;

    // 🔒 validation: categories must be array of objects
    if (
      !Array.isArray(categories) ||
      categories.length === 0 ||
      !categories.every(c => c.name && c.slug)
    ) {
      return Response.json(
        { error: "categories must be array of {name, slug}" },
        { status: 400 }
      );
    }

    // 🔒 validation: navItems must be array
    // if (!Array.isArray(navItems)) {
    //   return Response.json(
    //     { error: "navItems must be an array" },
    //     { status: 400 }
    //   );
    // }

    // 🔥 singleton fetch
    const existing = await prisma.website.findFirst();

    let website;

    if (existing) {
      // ✅ update
      website = await prisma.website.update({
        where: { id: existing.id },
        data: {
          categories
        },
      });
    } else {
      // ✅ create
      website = await prisma.website.create({
        data: {
          categories,
          navItems,
        },
      });
    }

    return Response.json({
      success: true,
      data: website,
    });

  } catch (error) {
    console.error("POST ERROR:", error);

    return Response.json(
      { error: "Operation failed" },
      { status: 500 }
    );
  }
}

// ✅ GET single website config
export async function GET() {
  try {
    const website = await prisma.website.findFirst({
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      success: true,
      data: website ?? null,
    });

  } catch (error) {
    console.error("GET ERROR:", error);

    return Response.json(
      { error: "Failed to fetch website" },
      { status: 500 }
    );
  }
}