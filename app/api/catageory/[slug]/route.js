import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

const PAGE_SIZE = 12;

export async function GET(req, { params }) {
  try {
    const { slug } = await params;
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    if (!slug) {
      return NextResponse.json({ error: "Missing category slug" }, { status: 400 });
    }

    // resolve the display name for this slug from Website.categories,
    // since Logo.category may store slug or name — match against both
    const website = await prisma.website.findFirst({ select: { categories: true } });
    const catList = Array.isArray(website?.categories) ? website.categories : [];
    const catDef = catList.find(c => c.slug?.toLowerCase() === slug.toLowerCase());

    const targetSlug = slug.toLowerCase();
    const targetName = catDef?.name?.toLowerCase();

    // Logo.category casing isn't guaranteed, so filter in JS for accuracy
    const all = await prisma.logo.findMany({
      where: { publishStatus: "Published" },
      orderBy: { id: "desc" },
      select: {
        id: true,
        logoName: true,
        category: true,
        brandColors: true,
        webpUrl: true,
        slug: true,
      },
    });

    const matched = all.filter(l =>
      Array.isArray(l.category) &&
      l.category.some(c => {
        const norm = c.trim().toLowerCase();
        return norm === targetSlug || (targetName && norm === targetName);
      })
    );

    const totalCount = matched.length;
    const logos = matched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({
      logos,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      page,
      categoryName: catDef?.name ?? slug,
    });

  } catch (error) {
    console.error("[GET] category logos", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}