import { prisma } from "../../../../lib/prisma";

export async function POST(req) {
  try {
    const { slug } = await req.json();

    if (!slug) {
      return new Response("Slug is required", { status: 400 });
    }

    const logo = await prisma.logo.findUnique({
      where: { slug },
      select: {
        id: true,
        logoName: true,
        slug: true,
        brand: true,
        website: true,
        category: true,
        industry: true,
        country: true,
        license: true,
        description: true,
        history: true,
        tags: true,
        brandColors: true,
        webpUrl: true,
        svgContent: true,
        metaTitle: true,
        metaDescription: true,
        altText: true,
        focusKeywords: true,
        publishStatus: true,
        downloadedNumberByPeople: true,
        svgfilesize: true,
        pngfilesize: true,
        aifilesize: true,
        cdrfilesize: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!logo) {
      return new Response("Logo not found", { status: 404 });
    }

    // ── Fetch related logos from same category ────────────────────────────
    const related = await prisma.logo.findMany({
      where: {
        category: logo.category,
        slug: { not: slug },                               // ✅ exclude current
        publishStatus: { in: ["published", "Published"] }, // ✅ both casings
      },
      select: {
        slug: true,
        logoName: true,
        brand: true,
        webpUrl: true,
        brandColors: true,
        downloadedNumberByPeople: true,
      },
      take: 5,
      orderBy: { downloadedNumberByPeople: "desc" },
    });

    return Response.json({
      success: true,
      data: logo,
      related,
    });

  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}