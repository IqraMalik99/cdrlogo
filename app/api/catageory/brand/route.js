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

    // ── count how many published logos use each category name ──
    const categoryCount = {};
    for (const logo of logos) {
      for (const cat of logo.category) {
        if (cat.toLowerCase() === "template") continue; // skip template
        if (!categoryCount[cat]) categoryCount[cat] = 0;
        categoryCount[cat]++;
      }
    }

    // ── build a lookup of images per category, keyed by lowercased name/slug ──
    const categories = Array.isArray(website?.categories) ? website.categories : [];
    const imagesByKey = {};
    for (const c of categories) {
      const urls = Array.isArray(c.url) ? c.url : [];
      if (c.name)  imagesByKey[c.name.trim().toLowerCase()]  = urls;
      if (c.slug)  imagesByKey[c.slug.trim().toLowerCase()]  = urls;
    }

    const formatted = Object.entries(categoryCount).map(([name, count]) => ({
      name,
      count,
      images: imagesByKey[name.trim().toLowerCase()] || [],
    }));

    return NextResponse.json({ categories: formatted });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}