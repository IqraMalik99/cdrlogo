// ─────────────────────────────────────────────────────────────────────────────
// app/api/logo/fetch/slug/route.js
// Returns the full logo record (all schema fields) + up-to-24 related logos.
// ─────────────────────────────────────────────────────────────────────────────
import { prisma } from "../../../../lib/prisma";

const MIN_RELATED = 12;
const MAX_RELATED = 24;

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

        imageObjectSchema: true,
        breadcrumbSchema: true,
        faqSchema: true,
        downloadedNumberByPeople: true,
        // ── Timestamps ──────────────────────────────────────────────────────
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!logo) {
      console.log(`[fetch/slug] ✗ no logo found for slug "${slug}"`);
      return Response.json({ success: false, error: "Logo not found" }, { status: 404 });
    }

    console.log(
      `[fetch/slug] ✓ found logo: id=${logo.id} brand="${logo.brand}" category=${JSON.stringify(
        logo.category
      )} tags=${JSON.stringify(logo.tags)}`
    );

    const published = { in: ["published", "Published"] };
    const logoTags = Array.isArray(logo.tags) ? logo.tags : [];
    const logoCategories = Array.isArray(logo.category) ? logo.category : [];

    // ── Related: 1. same brand (case-insensitive) ───────────────────────────
    const byName = logo.brand
      ? await prisma.logo.findMany({
        where: {
          brand: { equals: logo.brand, mode: "insensitive" }, // ← fuzzy/case-insensitive fix
          slug: { not: slug },
          publishStatus: published,
        },
        select: {
          slug: true, logoName: true, brand: true,
          webpUrl: true,
        },
        take: MAX_RELATED,
        orderBy: { downloadedNumberByPeople: "desc" },
      })
      : [];

    console.log(
      `[fetch/slug] step 1 (same brand, case-insensitive): matched ${byName.length} → ${byName
        .map((l) => l.slug)
        .join(", ") || "(none)"}`
    );

    const usedSlugs = new Set(byName.map((l) => l.slug));

    // ── Related: 2. overlapping category (hasSome, not exact-array equals) ──
    const rem1 = MAX_RELATED - byName.length;
    const byCategory =
      rem1 > 0 && logoCategories.length > 0
        ? await prisma.logo.findMany({
          where: {
            category: { hasSome: logoCategories }, // ← fixed: any overlap, not exact array match
            slug: { not: slug },
            publishStatus: published,
            NOT: { slug: { in: [...usedSlugs] } },
          },
          select: {
            slug: true, logoName: true, brand: true,
            webpUrl: true,
          },
          take: rem1,
          orderBy: { downloadedNumberByPeople: "desc" },
        })
        : [];

    console.log(
      `[fetch/slug] step 2 (overlapping category, hasSome): matched ${byCategory.length} → ${byCategory
        .map((l) => l.slug)
        .join(", ") || "(none)"}`
    );

    byCategory.forEach((l) => usedSlugs.add(l.slug));

    // ── Related: 3. overlapping tags (case-insensitive fuzzy compare) ───────
    const rem2 = MAX_RELATED - byName.length - byCategory.length;
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
          webpUrl: true,
          tags: true,
        },
        orderBy: { downloadedNumberByPeople: "desc" },
        take: rem2 * 10,
      });

      const normLogoTags = logoTags.map((t) => String(t).trim().toLowerCase());

      byTags = candidates
        .filter((l) => {
          const candidateTags = (Array.isArray(l.tags) ? l.tags : []).map((t) =>
            String(t).trim().toLowerCase()
          );
          return candidateTags.some((t) => normLogoTags.includes(t)); // ← fuzzy/case-insensitive tag match
        })
        .slice(0, rem2);
    }

    console.log(
      `[fetch/slug] step 3 (overlapping tags, case-insensitive): matched ${byTags.length} → ${byTags
        .map((l) => l.slug)
        .join(", ") || "(none)"}`
    );

    byTags.forEach((l) => usedSlugs.add(l.slug));

    let related = [...byName, ...byCategory, ...byTags];

    // ── Related: 4. fallback fill — top up to MIN_RELATED if still short ────
    const rem3 = MIN_RELATED - related.length;
    let byFallback = [];
    if (rem3 > 0) {
      byFallback = await prisma.logo.findMany({
        where: {
          slug: { not: slug },
          publishStatus: published,
          NOT: { slug: { in: [...usedSlugs] } },
        },
        select: {
          slug: true, logoName: true, brand: true,
          webpUrl: true,
        },
        take: rem3,
        orderBy: { downloadedNumberByPeople: "desc" },
      });

      console.log(
        `[fetch/slug] step 4 (fallback fill to reach ${MIN_RELATED}): matched ${byFallback.length} → ${byFallback
          .map((l) => l.slug)
          .join(", ") || "(none)"}`
      );

      related = [...related, ...byFallback];
    }

    console.log(
      `[fetch/slug] ── total related: ${related.length}/${MAX_RELATED} (min target ${MIN_RELATED}) → ${related
        .map((l) => l.slug)
        .join(", ") || "(none)"
      }\n`
    );

    return Response.json({ success: true, data: logo, related });
  } catch (err) {
    console.error("[fetch/slug] ✗ ERROR:", err);
    return Response.json(
      { success: false, error: "Server error", message: err.message },
      { status: 500 }
    );
  }
}