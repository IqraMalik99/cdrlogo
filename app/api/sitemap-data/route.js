import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function GET() {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://www.cdrlogo.com").replace(/\/$/, "");

  const [logos, blogs] = await Promise.all([
    prisma.logo.findMany({
      where: { publishStatus: "Published" },
      select: { slug: true, updatedAt: true, category: true, webpUrl: true, logoName: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.blog.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // -------------------------------
  // CATEGORY EXTRACTION + REAL LASTMOD  ← CHANGED (this whole block)
  // -------------------------------
  const excludedCategories = ["template"];
  const categoryLastMod = {}; // ← ADDED: slug -> most recent Date across its logos

  logos.forEach((l) => {
    const cats = Array.isArray(l.category) ? l.category : [];
    cats.forEach((c) => {
      const slug = String(c).trim().toLowerCase().replace(/\s+/g, "-");
      if (!slug || excludedCategories.includes(slug)) return;

      const updated = l.updatedAt ? new Date(l.updatedAt) : null;
      if (updated && (!categoryLastMod[slug] || updated > categoryLastMod[slug])) {
        categoryLastMod[slug] = updated; // ← ADDED: keep the newest updatedAt per category
      }
    });
  });

  const categories = Object.keys(categoryLastMod); // ← CHANGED: derived from categoryLastMod instead of a separate Set

  const staticRoutes = [
    { url: baseUrl, lastModified: new Date(), changeFrequency: "daily", priority: 1.0 },
    { url: `${baseUrl}/blog`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/brands`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/categories`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/logo-templates`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/about-us`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
    { url: `${baseUrl}/all-logos`, lastModified: new Date(), changeFrequency: "daily", priority: 0.8 },
  ];

  // -------------------------------
  // CATEGORY ROUTES (real lastmod now)  ← CHANGED
  // -------------------------------
  const categoryRoutes = categories.map((cat) => ({
    url: `${baseUrl}/categories/logos/${encodeURIComponent(cat)}`,
    lastModified: categoryLastMod[cat] || new Date(), // ← CHANGED: was new Date() hardcoded
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // -------------------------------
  // LOGO ROUTES (unchanged)
  // -------------------------------
  const logoRoutes = logos
    .filter(l => typeof l.slug === "string" && l.slug.trim() !== "")
    .map(l => ({
      url: `${baseUrl}/logo/${l.slug.replace(/^\/+/, "").trim()}`,
      lastModified: l.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
      image: l.webpUrl || null,
      imageTitle: l.logoName || null,
    }));

  // -------------------------------
  // BLOG ROUTES (unchanged)
  // -------------------------------
  const blogRoutes = blogs
    .filter(b => typeof b.slug === "string" && b.slug.trim() !== "")
    .map(b => ({
      url: `${baseUrl}/blog/${b.slug.replace(/^\/+/, "").trim()}`,
      lastModified: b.updatedAt || new Date(),
      changeFrequency: "monthly",
      priority: 0.6,
    }));

  // -------------------------------
  // FINAL OUTPUT (unchanged)
  // -------------------------------
  const allRoutes = [
    ...staticRoutes,
    ...categoryRoutes,
    ...logoRoutes,
    ...blogRoutes,
  ];

  return NextResponse.json(allRoutes.filter(r => r.url && typeof r.url === "string"));
}