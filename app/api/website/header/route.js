// app/api/admin/site-setting/route.js

import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const website = await prisma.website.findFirst({
      select: {
        id: true,
        metaTitle: true,
        metaDescription: true,
        showmode: true,
        limit: true,
        MaintanceMessage: true,
        navItems: true, // ✅ IMPORTANT
      },
    });

    if (!website) {
      return NextResponse.json({
        navItems: [],
        metaTitle: "",
        metaDescription: "",
        showmode: true,
        limit: 20,
        MaintanceMessage: "",
      });
    }

    return NextResponse.json(website);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}