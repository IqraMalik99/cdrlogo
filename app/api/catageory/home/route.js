import { prisma } from "../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    // 1. Fetch categories JSON
    const site = await prisma.website.findFirst({
      select: {
        categories: true,
      },
    });

    if (!site || !site.categories) {
      return NextResponse.json({
        success: true,
        data: [],
      });
    }

    // 2. Parse safely (handle string or JSON)
    const raw = site.categories;

    const parsed =
      typeof raw === "string"
        ? JSON.parse(raw)
        : raw;

    // 3. Extract only names
    const categoryNames = (parsed || []).map((cat) => cat.name);

    // 4. Response
    return NextResponse.json({
      success: true,
      data: categoryNames,
    });

  } catch (error) {
    console.error("Categories API error:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch categories",
      },
      { status: 500 }
    );
  }
}