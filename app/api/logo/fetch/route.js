import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();

    let letter   = body.letter?.toLowerCase()?.trim();
    let category = body.category?.toLowerCase()?.trim();
    let page     = Math.max(1, Number(body.page) || 1);

    // Page size ab hardcoded nahi, DB (Website.limit) se aayega
    const website = await prisma.website.findFirst({
      select: { limit: true },
    });
    const PAGE_SIZE = Math.max(1, Number(website?.limit) || 24);

    const where = { publishStatus: "Published" };

    if (letter && letter !== "all" && letter !== "0-9") {
      where.logoName = {
        startsWith: letter,
        mode: "insensitive",
      };
    }

    const isNumericLetter = letter === "0-9";

    if (!isNumericLetter && (!category || category === "all")) {
      // ── fast path: DB does filtering + pagination, no JS post-filter needed ──
      const [logos, totalCount] = await Promise.all([
        prisma.logo.findMany({
          where,
          orderBy: { id: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          select: {
            id: true,
            logoName: true,
            category: true,
            brandColors: true,
            webpUrl: true,
            slug: true,
          },
        }),
        prisma.logo.count({ where }),
      ]);

      return NextResponse.json({
        logos,
        totalCount,
        totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
        page,
      });
    }

    // ── slow path: 0-9 letter and/or category need JS filtering,
    // so fetch all matches first, then paginate manually ──
    let all = await prisma.logo.findMany({
      where,
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

    if (isNumericLetter) {
      all = all.filter(l => /^[0-9]/.test(l.logoName));
    }

    if (category && category !== "all") {
      all = all.filter(l =>
        Array.isArray(l.category) &&
        l.category.some(c => c.toLowerCase().trim() === category)
      );
    }

    const totalCount = all.length;
    const logos = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return NextResponse.json({
      logos,
      totalCount,
      totalPages: Math.max(1, Math.ceil(totalCount / PAGE_SIZE)),
      page,
    });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}