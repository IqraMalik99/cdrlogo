// app/api/footer/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";



export async function GET() {
  try {
    // Fetch Website (first record) and footer/legal/pages in parallel
    const [website, footerPages, legalPages] = await Promise.all([
      prisma.website.findFirst(),
      prisma.page.findMany({
        where: { InFooter: true, publishStatus: "published" },
        select: { id: true, title: true, slug: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.page.findMany({
        where: { InLegal: true, publishStatus: "published" },
        select: { id: true, title: true, slug: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    // The Footer field in Website is already a JSON object matching your payload
    const footer = website?.Footer ?? {};

    return NextResponse.json({
      footer,        // { twitter, facebook, instagram, pinterest, copyright, description }
      footerPages,   // pages where InFooter = true
      legalPages,    // pages where InLegal = true
    });
  } catch (err) {
    console.error("[GET /api/footer]", err);
    return NextResponse.json(
      { footer: {}, footerPages: [], legalPages: [] },
      { status: 500 }
    );
  }
}