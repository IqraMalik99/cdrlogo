import { prisma } from "./prisma";
import { TEMPLATE_CATEGORIES } from "./templateCategories";

const PUBLISHED = "Published";

const publishedFilter = { publishStatus: { equals: PUBLISHED, mode: "insensitive" } };

export async function getTemplateCategoryCounts() {
  const rows = await prisma.logo.groupBy({
    by: ["templateCategory"],
    where: { templateCategory: { not: "" }, ...publishedFilter },
    _count: { _all: true },
  });

  // normalize ids so "Food-Dining " and "food-dining" count together
  const map = new Map();
  for (const r of rows) {
    const key = String(r.templateCategory || "").trim().toLowerCase();
    map.set(key, (map.get(key) || 0) + r._count._all);
  }

  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id, name: c.name, intro: c.intro, count: map.get(c.id) || 0,
  }));
}

export async function getTemplateLogos({ categoryId, page = 1, limit = 48 }) {
  const where = {
    templateCategory: { equals: categoryId, mode: "insensitive" },
    ...publishedFilter,
  };
  const [logos, total] = await Promise.all([
    prisma.logo.findMany({
      where,
      select: { slug: true, logoName: true, webpUrl: true, altText: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.logo.count({ where }),
  ]);
  return { logos, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
}

// Debug helper: template logos that are not counted anywhere
export async function getUncountedTemplateStats() {
  const [unassigned, notPublished] = await Promise.all([
    prisma.logo.count({ where: { category: { has: "template" }, templateCategory: "" } }),
    prisma.logo.count({
      where: {
        templateCategory: { not: "" },
        NOT: publishedFilter,
      },
    }),
  ]);
  return { unassigned, notPublished };
}