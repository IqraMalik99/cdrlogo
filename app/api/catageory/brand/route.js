import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const [logos, website] = await Promise.all([
      prisma.logo.findMany({
        where: { publishStatus: "Published" },
        select: { category: true },
      }),
      prisma.website.findFirst({ select: { categories: true } }),
    ]);

    // ── count how many published logos use each SUBcategory value ──
    const subCategoryCount = {};
    for (const logo of logos) {
      const cats = Array.isArray(logo.category)
        ? logo.category
        : typeof logo.category === "string"
        ? [logo.category]
        : [];
      for (const cat of cats) {
        if (!cat || cat.toLowerCase() === "template") continue; // skip template
        const key = cat.trim().toLowerCase();
        subCategoryCount[key] = (subCategoryCount[key] || 0) + 1;
      }
    }

    const categories = Array.isArray(website?.categories) ? website.categories : [];

    // ── group by MAIN name, dedupe, sum counts across all its subnames, collect images ──
    const groupedByName = new Map();

    for (const c of categories) {
      const name = c?.name?.trim();
      if (!name) continue;
      const key = name.toLowerCase();

      if (!groupedByName.has(key)) {
        groupedByName.set(key, { name, count: 0, images: [], seenImages: new Set() });
      }
      const group = groupedByName.get(key);

      // sum published-logo count for this subname into the main category's total
      const subKey = (c.subname || "").trim().toLowerCase();
      if (subKey) {
        group.count += subCategoryCount[subKey] || 0;
      }

      // collect image url (string, per your sample data) — dedupe + skip empty
      const url = typeof c.url === "string" ? c.url.trim() : "";
      if (url && !group.seenImages.has(url)) {
        group.seenImages.add(url);
        group.images.push(url);
      }
    }

    const formatted = Array.from(groupedByName.values()).map(({ name, count, images }) => ({
      name,
      count,
      images,
    }));

    return NextResponse.json({ categories: formatted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}