// app/api/logo/fetch/slug/route.js
import { prisma } from "../../../../lib/prisma";

export async function POST(req) {
  try {
    const { slug } = await req.json();
    if (!slug) return new Response("Slug is required", { status: 400 });

    const logo = await prisma.logo.findUnique({
      where: { slug },
      select: {
        id: true, logoName: true, slug: true, brand: true, website: true,
        category: true, industry: true, country: true, license: true,
        description: true, history: true, tags: true, brandColors: true,
        webpUrl: true, svgContent: true, metaTitle: true, metaDescription: true,
        altText: true, focusKeywords: true, publishStatus: true,
        downloadedNumberByPeople: true, svgfilesize: true, pngfilesize: true,
        aifilesize: true, cdrfilesize: true, createdAt: true, updatedAt: true,
      },
    });

    if (!logo) return new Response("Logo not found", { status: 404 });

    const published = { in: ["published", "Published"] };
    const logoTags = Array.isArray(logo.tags) ? logo.tags : [];

    // 1. By brand name
    const byName = logo.brand ? await prisma.logo.findMany({
      where: { brand: logo.brand, slug: { not: slug }, publishStatus: published },
      select: { slug: true, logoName: true, brand: true, webpUrl: true, brandColors: true, downloadedNumberByPeople: true },
      take: 5,
      orderBy: { downloadedNumberByPeople: "desc" },
    }) : [];

    const usedSlugs = new Set(byName.map(l => l.slug));

    // 2. By category
    const rem1 = 5 - byName.length;
    const byCategory = rem1 > 0 ? await prisma.logo.findMany({
      where: {
        category: logo.category, slug: { not: slug }, publishStatus: published,
        NOT: { slug: { in: [...usedSlugs] } },
      },
      select: { slug: true, logoName: true, brand: true, webpUrl: true, brandColors: true, downloadedNumberByPeople: true },
      take: rem1,
      orderBy: { downloadedNumberByPeople: "desc" },
    }) : [];

    byCategory.forEach(l => usedSlugs.add(l.slug));

    // 3. By tags
    const rem2 = 5 - byName.length - byCategory.length;
    let byTags = [];
    if (rem2 > 0 && logoTags.length > 0) {
      const candidates = await prisma.logo.findMany({
        where: { slug: { not: slug }, publishStatus: published, NOT: { slug: { in: [...usedSlugs] } } },
        select: { slug: true, logoName: true, brand: true, webpUrl: true, brandColors: true, downloadedNumberByPeople: true, tags: true },
        orderBy: { downloadedNumberByPeople: "desc" },
        take: rem2 * 10,
      });
      byTags = candidates
        .filter(l => (Array.isArray(l.tags) ? l.tags : []).some(t => logoTags.includes(t)))
        .slice(0, rem2);
    }

    const related = [...byName, ...byCategory, ...byTags];

    return Response.json({ success: true, data: logo, related });

  } catch (err) {
    console.error(err);
    return new Response("Server error", { status: 500 });
  }
}