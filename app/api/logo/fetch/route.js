import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"
import { SlashSquare } from "lucide-react";
export async function POST(req) {
  try {
    const body = await req.json();

    let letter   = body.letter?.toLowerCase()?.trim();
    let category = body.category?.toLowerCase()?.trim();

    const where = { publishStatus: "Published" };

    if (letter && letter !== "all" && letter !== "0-9") {
      where.logoName = {
        startsWith: letter,
        mode: "insensitive"
      };
    }

    if (category && category !== "all") {
      where.category = {
        equals: category,
        mode: "insensitive",
      };
    }

    let logos = await prisma.logo.findMany({
      where,
      select: {
        id:          true,
        logoName:    true,
        category:    true,
        brandColors: true,
        webpUrl:     true,
        slug:        true,
      },
    });

    // 0-9 can't be done in Prisma startsWith, so filter after fetch
    if (letter === "0-9") {
      logos = logos.filter(l => /^[0-9]/.test(l.logoName));
    }

    return NextResponse.json({ logos });

  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}