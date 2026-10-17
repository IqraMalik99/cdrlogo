// app/api/admin/site-setting/route.js
// (folder name must match the URL the component fetches: /api/admin/site-setting)
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; // adjust to your prisma client path

const PROVIDERS = ["tavily", "serper"];

// ─── GET — fetch the single Website record ────────────────────────────────────
export async function GET() {
  try {
    const website = await prisma.website.findFirst({
      select: {
        id:               true,
        metaTitle:        true,
        metaDescription:  true,
        showmode:         true,
        limit:            true,
        MaintanceMessage: true,
        searchProvider:   true,
      },
    });

    if (!website) {
      return NextResponse.json({
        metaTitle:        "",
        metaDescription:  "",
        showmode:         true,
        limit:            12,
        MaintanceMessage: "",
        searchProvider:   "tavily",
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
    const {
      id, metaTitle, metaDescription, showmode,
      limit, MaintanceMessage, searchProvider,
    } = body;

    if (searchProvider !== undefined && !PROVIDERS.includes(searchProvider)) {
      return NextResponse.json({ error: "Invalid search provider" }, { status: 400 });
    }

    // Only include fields that were actually sent, so a save never
    // resets values the form doesn't manage (e.g. limit).
    const data = {};
    if (metaTitle !== undefined)        data.metaTitle        = metaTitle;
    if (metaDescription !== undefined)  data.metaDescription  = metaDescription;
    if (showmode !== undefined)         data.showmode         = showmode;
    if (MaintanceMessage !== undefined) data.MaintanceMessage = MaintanceMessage;
    if (searchProvider !== undefined)   data.searchProvider   = searchProvider;
    if (limit !== undefined)            data.limit            = Number(limit) || 12;

    const website = id
      ? await prisma.website.update({ where: { id }, data })
      : await prisma.website.create({ data });

    return NextResponse.json(website);
  } catch (err) {
    console.error("[site-settings POST]", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
}