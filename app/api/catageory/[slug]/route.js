import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function POST(req, { params }) {
  try {
    const { slug } = await params;
    console.log("[POST] slug:", slug);

    if (!slug) {
      return NextResponse.json(
        { error: "Missing slug" },
        { status: 400 }
      );
    }

    // "tag-heuer" -> "tag heuer"
    const searchTerm = slug.replace(/-/g, " ").trim();
    console.log("[POST] searchTerm:", searchTerm);

    const logos = await prisma.logo.findMany({
      where: {
        brand: {
          contains: searchTerm,
          mode: "insensitive",
        },
      },
    });

    console.log("[POST] matched logos count:", logos.length);

    if (!logos.length) {
      return NextResponse.json(
        {
          logos: [],
          totalCount: 0,
          categoryName: searchTerm,
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      logos: logos||[],
      totalCount: logos.length,
      categoryName: logos[0].brand,
    });
  } catch (error) {
    console.error("[POST] ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch logos" },
      { status: 500 }
    );
  }
}