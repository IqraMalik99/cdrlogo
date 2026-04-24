// app/api/admin/site-settings/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; // adjust to your prisma client path

// ─── GET — fetch the single Website record ────────────────────────────────────
export async function GET() {
  try {
    // We only ever have one Website config row; grab the first one
    const website = await prisma.website.findFirst({
      select: {
        id:               true,
        metaTitle:        true,
        metaDescription:  true,
        showmode:         true,
        limit:            true,
        MaintanceMessage: true,
      },
    });

    if (!website) {
      // Return sensible defaults if no row exists yet
      return NextResponse.json({
        metaTitle:        "",
        metaDescription:  "",
        showmode:         true,
        limit:            20,
        MaintanceMessage: "",
      });
    }

    return NextResponse.json(website);
  } catch (err) {
    console.error("[site-settings GET]", err);
    return NextResponse.json({ error: "Failed to fetch settings" }, { status: 500 });
  }
}

// ─── POST — upsert the Website record ────────────────────────────────────────
export async function POST(req) {
  try {
    const body = await req.json();
    const { id, metaTitle, metaDescription, showmode, limit, MaintanceMessage } = body;

    const data = {
      metaTitle:        metaTitle        ?? "",
      metaDescription:  metaDescription  ?? "",
      showmode:         showmode         ?? true,
      limit:            Number(limit)    || 20,
      MaintanceMessage: MaintanceMessage ?? "",
    };

    let website;

    if (id) {
      // Update existing record
      website = await prisma.website.update({
        where: { id },
        data,
      });
    } else {
      // Create first record
      website = await prisma.website.create({ data });
    }

    return NextResponse.json(website);
  } catch (err) {
    console.error("[site-settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}