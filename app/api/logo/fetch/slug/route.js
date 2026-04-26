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

        // ONLY PUBLIC
        webpUrl: true,

        // optional safe preview
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

    return Response.json({
      success: true,
      data: logo,
    });

  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}