import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET  -> returns the current limit
// PATCH -> admin sends { limit: number } to update it
// Works even if no Website row exists yet (creates one on first PATCH).

export async function GET() {
  try {
    const website = await prisma.website.findFirst({
      select: { id: true, limit: true },
    });

    return NextResponse.json({
      limit: website?.limit ?? 20, // schema default, in case no row exists yet
    });
  } catch (error) {
    console.error("[GET] admin limit", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(req) {
  try {
    const body = await req.json();
    const rawLimit = Number(body?.limit);

    if (!Number.isFinite(rawLimit) || rawLimit < 1) {
      return NextResponse.json(
        { error: "limit must be a positive number" },
        { status: 400 }
      );
    }

    const limit = Math.floor(rawLimit);

    // Website has no fixed singleton id, so grab whichever row exists first.
    const existing = await prisma.website.findFirst({ select: { id: true } });

    const website = existing
      ? await prisma.website.update({
          where: { id: existing.id },
          data: { limit },
        })
      : await prisma.website.create({
          data: { limit },
        });

    return NextResponse.json({ limit: website.limit });
  } catch (error) {
    console.error("[PATCH] admin limit", error);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}