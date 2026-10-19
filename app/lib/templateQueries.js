import { prisma } from "./prisma";
import { TEMPLATE_CATEGORIES } from "./templateCategories";

const PUBLISHED = "Published";
const publishedFilter = { publishStatus: { equals: PUBLISHED, mode: "insensitive" } };

// Counts are done in JS from a single light query, so casing / stray
// whitespace in templateCategory can never cause a mismatch.
export async function getTemplateCategoryCounts() {
  const rows = await prisma.logo.findMany({
    where: { templateCategory: { not: "" }, ...publishedFilter },
    select: { templateCategory: true },
  });

  const map = new Map();
  for (const r of rows) {
    const key = String(r.templateCategory || "").trim().toLowerCase();
    if (key) map.set(key, (map.get(key) || 0) + 1);
  }

  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id,
    name: c.name,
    count: map.get(c.id) || 0,
  }));
}

export async function getTemplateLogos({ categoryId, page = 1, limit = 48 }) {
  const where = {
    templateCategory: { equals: String(categoryId).trim(), mode: "insensitive" },
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