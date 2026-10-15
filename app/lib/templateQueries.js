import { prisma } from "./prisma";
import { TEMPLATE_CATEGORIES } from "./templateCategories";

const PUBLISHED = "Published";

export async function getTemplateCategoryCounts() {
  const rows = await prisma.logo.groupBy({
    by: ["templateCategory"],
    where: { templateCategory: { not: "" }, publishStatus: PUBLISHED },
    _count: { _all: true },
  });
  const map = new Map(rows.map((r) => [r.templateCategory, r._count._all]));
  return TEMPLATE_CATEGORIES.map((c) => ({
    id: c.id, name: c.name, intro: c.intro, count: map.get(c.id) || 0,
  }));
}

export async function getTemplateLogos({ categoryId, page = 1, limit = 48 }) {
  const where = { templateCategory: categoryId, publishStatus: PUBLISHED };
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