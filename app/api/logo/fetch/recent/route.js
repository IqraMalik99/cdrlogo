import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

export async function GET() {
  try {
    const logos = await prisma.logo.findMany({
      where: { publishStatus: "Published" },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        logoName: true,
        slug: true,
        category: true,
        webpUrl: true,
        brandColors: true,
        createdAt: true,
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