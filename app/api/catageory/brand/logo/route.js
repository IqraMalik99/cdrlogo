import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";


export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const slug = searchParams.get("slug");
    const page = parseInt(searchParams.get("page") || "1", 10);

    console.log("[get-brand] slug:", slug, "page:", page);

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    const searchTerm = slug.replace(/-/g, " ").trim();

    console.log("[get-brand] searchTerm:", searchTerm);

    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
        brand: {
          equals: searchTerm,
          mode: "insensitive",
        },
      },
    });

    console.log("[get-brand] matched logos count:", logos.length);

    if (!logos.length) {
      return NextResponse.json(
        {
          logos: [],
          totalPages: 1,
          totalCount: 0,
          categoryName: searchTerm,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      logos,
      totalPages: 1,
      totalCount: logos.length,
      categoryName: logos[0].brand,
    });
  } catch (error) {
    console.error("[get-brand] ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch brand logos" },
      { status: 500 }
    );
  }
}