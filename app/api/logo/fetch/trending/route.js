import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    // Take count ab hardcoded nahi, DB (Website.limit) se aayega
    const website = await prisma.website.findFirst({
      select: { limit: true },
    });
    const takeNum = Math.max(1, Number(website?.limit) || 12);

    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: "Published", // ✅ filter published
      },
      orderBy: {
        downloadedNumberByPeople: "desc", // ✅ highest first
      },
      take: takeNum, // ✅ dynamic from Website.limit
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