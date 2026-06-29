// ─────────────────────────────────────────────────────────────────────────────
// app/api/logo/fetch/slug/route.js
// Returns the full logo record (all schema fields) + up-to-5 related logos.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "../../../../lib/prisma";

export async function POST(req) {
  try {
    const { slug } = await req.json();
    if (!slug) {
      return Response.json({ success: false, error: "Slug is required" }, { status: 400 });
    }

    const logo = await prisma.logo.findUnique({
      where: { slug },
      select: {
        // ── Core identity ───────────────────────────────────────────────────
        id: true,
        logoName: true,
        slug: true,
        brand: true,
        website: true,

        // ── Classification ──────────────────────────────────────────────────
        category: true,
        industry: true,
        country: true,
        license: true,

        // ── Content ─────────────────────────────────────────────────────────
        description: true,
        history: true,

        // ── Taxonomy ────────────────────────────────────────────────────────
        tags: true,
        brandColors: true,

        // ── File URLs ───────────────────────────────────────────────────────
        webpUrl: true,   // public CDN preview
        svgUrl: true,
        pngUrl: true,
        aiUrl: true,
        cdrUrl: true,

        // ── File sizes ──────────────────────────────────────────────────────
        svgfilesize: true,
        pngfilesize: true,
        aifilesize: true,
        cdrfilesize: true,

        // ── SVG source ──────────────────────────────────────────────────────
        svgContent: true,

        // ── Core SEO ────────────────────────────────────────────────────────
        metaTitle: true,
        metaDescription: true,
        altText: true,

        // ── Extended SEO: canonical + OG + Twitter ──────────────────────────
        canonicalUrl: true,
        ogTitle: true,
        ogDescription: true,
        ogImageUrl: true,
        ogType: true,
        twitterTitle: true,
        twitterDescription: true,
        twitterImage: true,
        twitterCardType: true,

        // ── Publishing ──────────────────────────────────────────────────────
        publishStatus: true,
        downloadCount: true,
        downloadedNumberByPeople: true,

        imageObjectSchema: true,
        breadcrumbSchema: true,
        faqSchema: true,

        // ── Timestamps ──────────────────────────────────────────────────────
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!logo) {
      return Response.json({ success: false, error: "Logo not found" }, { status: 404 });
    }

    const published = { in: ["published", "Published"] };
    const logoTags = Array.isArray(logo.tags) ? logo.tags : [];

    // ── Related: 1. same brand ───────────────────────────────────────────────
    const byName = logo.brand
      ? await prisma.logo.findMany({
        where: { brand: logo.brand, slug: { not: slug }, publishStatus: published },
        select: {
          slug: true, logoName: true, brand: true,
          webpUrl: true, brandColors: true, downloadedNumberByPeople: true,
        },
        take: 5,
        orderBy: { downloadedNumberByPeople: "desc" },
      })
      : [];

    const usedSlugs = new Set(byName.map(l => l.slug));

    // ── Related: 2. same category ────────────────────────────────────────────
    //    category is Prisma String[] — equals here matches the exact same
    //    array (same elements, same order) as the original logo's category.
    const rem1 = 5 - byName.length;
    const byCategory = rem1 > 0
      ? await prisma.logo.findMany({
        where: {
          category: { equals: logo.category },
          slug: { not: slug },
          publishStatus: published,
          NOT: { slug: { in: [...usedSlugs] } },
        },
        select: {
          slug: true, logoName: true, brand: true,
          webpUrl: true, brandColors: true, downloadedNumberByPeople: true,
        },
        take: rem1,
        orderBy: { downloadedNumberByPeople: "desc" },
      })
      : [];

    byCategory.forEach(l => usedSlugs.add(l.slug));

    // ── Related: 3. overlapping tags ─────────────────────────────────────────
    const rem2 = 5 - byName.length - byCategory.length;
    let byTags = [];
    if (rem2 > 0 && logoTags.length > 0) {
      const candidates = await prisma.logo.findMany({
        where: {
          slug: { not: slug },
          publishStatus: published,
          NOT: { slug: { in: [...usedSlugs] } },
        },
        select: {
          slug: true, logoName: true, brand: true,
          webpUrl: true, brandColors: true, downloadedNumberByPeople: true,
          tags: true,
        },
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
    console.error("[fetch/slug]", err);
    return Response.json(
      { success: false, error: "Server error", message: err.message },
      { status: 500 }
    );
  }
}