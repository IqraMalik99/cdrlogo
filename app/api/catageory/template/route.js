import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    // Get website categories
    const website = await prisma.website.findFirst({
      select: {
        categories: true,
      },
    });

    // Filter categories where type = brand
    const brandCategories = (website?.categories || [])
      .filter((cat) => cat.type === "template")
      .map((cat) => cat.name);

    // Group logos
    const result = await prisma.logo.groupBy({
      by: ["category"],
      where: {
        category: {
          in: brandCategories,
        },
      },
      _count: {
        category: true,
      },
    });

    // Same format as old API
    const formatted = result.map((item) => ({
      [item.category]: item._count.category,
    }));
  console.log("formattedd",formatted)
    return NextResponse.json({
      categories: formatted,
    });

  } catch (error) {
    console.error(error);

    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}