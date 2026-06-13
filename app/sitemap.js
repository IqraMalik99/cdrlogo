import { prisma } from "./lib/prisma";

export const revalidate = 3600;

export default async function sitemap() {
  const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://cdrlogo.com").replace(/\/$/, "");

  const [logos, blogs] = await Promise.all([
    prisma.logo.findMany({
      where: { publishStatus: "Published" },
      select: { slug: true, updatedAt: true, category: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.blog.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  // -------------------------------
  // SAFE CATEGORY EXTRACTION
  // -------------------------------
  const categories = [
    ...new Set(
      logos
        .map(l => l.category)
        .filter(cat => typeof cat === "string" && cat.trim() !== "")
    )
  ];

  // -------------------------------
  // STATIC + IMPORTANT ROUTES
  // -------------------------------
  const staticRoutes = [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1.0,
    },
    {
      url: `${baseUrl}/blog`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/brands`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/category`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/contact-us`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.4,
    },
    {
      url: `${baseUrl}/request`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },

    // 🔥 FORCE IMPORTANT PAGES (EVEN IF DYNAMIC)
    {
      url: `${baseUrl}/about-us`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.7,
    },
    {
      url: `${baseUrl}/terms-of-service`,
      lastModified: new Date(),
      changeFrequency: "yearly",
      priority: 0.3,
    },
  ];

  // -------------------------------
  // CATEGORY ROUTES (NO /search)
  // -------------------------------
  const categoryRoutes = categories.map(cat => ({
    url: `${baseUrl}/category/${encodeURIComponent(cat.toLowerCase())}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.7,
  }));

  // -------------------------------
  // LOGO ROUTES
  // -------------------------------
  const logoRoutes = logos
    .filter(l => typeof l.slug === "string" && l.slug.trim() !== "")
    .map(l => ({
      url: `${baseUrl}/logo/${l.slug.replace(/^\/+/, "").trim()}`,
      lastModified: l.updatedAt || new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    }));

  // -------------------------------
  // BLOG ROUTES
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
  // FINAL OUTPUT
  // -------------------------------
  const allRoutes = [
    ...staticRoutes,
    ...categoryRoutes,
    ...logoRoutes,
    ...blogRoutes,
  ];

  return allRoutes.filter(r => r.url && typeof r.url === "string");
}