import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published", // ✅ filter published
      },
      orderBy: {
        downloadedNumberByPeople: "desc", // ✅ highest first
      },
      take: 12, // ✅ only 12 logos
      select: {
        id: true,
        logoName: true,
        category: true,
        webpUrl: true,
        slug: true,
        // downloadedNumberByPeople: true,
      },
    });

    return NextResponse.json({ logos });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}