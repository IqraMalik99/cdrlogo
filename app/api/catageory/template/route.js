import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published",
      },
      select: {
        category: true,
      },
    });

    const categoryCount = {};

    for (const logo of logos) {
      for (const cat of logo.category) {
        if (cat.toLowerCase() !== "template") continue; // skip template
        if (!categoryCount[cat]) {
          categoryCount[cat] = 0;
        }
        categoryCount[cat]++;
      }
    }

    const formatted = Object.entries(categoryCount).map(([name, count]) => ({
      [name]: count,
    }));

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