// app/api/admin/tags/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma"; // adjust to your prisma client path

// ── GET /api/admin/tags ─────────────────────────────────────────────────────
// Reads directly from Website.tags (Json field, default [])
export async function GET() {
  try {
    const site = await prisma.website.findFirst();
    const tags = Array.isArray(site?.tags) ? site.tags : [];
    return NextResponse.json({ tags }, { status: 200 });
  } catch (err) {
    console.error("[GET /api/admin/tags]", err);
    return NextResponse.json({ error: "Failed to fetch tags" }, { status: 500 });
  }
}

// ── POST /api/admin/tags ────────────────────────────────────────────────────
// Body: { tag: string }
// Appends a new tag to Website.tags (case-insensitive duplicate check).
export async function POST(req) {
  try {
    const { tag } = await req.json();
    if (!tag || typeof tag !== "string" || !tag.trim()) {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }

    const trimmed = tag.trim();
    let site = await prisma.website.findFirst();
    const existing = Array.isArray(site?.tags) ? site.tags : [];

    // case-insensitive duplicate check
    if (existing.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
      return NextResponse.json({ error: "Tag already exists" }, { status: 409 });
    }

    const updatedTags = [...existing, trimmed];

    if (site) {
      await prisma.website.update({
        where: { id: site.id },
        data: { tags: updatedTags },
      });
    } else {
      // No Website row yet — create one
      await prisma.website.create({
        data: { tags: updatedTags },
      });
    }

    await prisma.log.create({
      data: { who: "admin", content: `Tag added: "${trimmed}"` },
    });

    return NextResponse.json({ tags: updatedTags }, { status: 201 });
  } catch (err) {
    console.error("[POST /api/admin/tags]", err);
    return NextResponse.json({ error: "Failed to add tag" }, { status: 500 });
  }
}

// ── DELETE /api/admin/tags ──────────────────────────────────────────────────
// Body: { tag: string }
// Removes a tag from Website.tags by name.
export async function DELETE(req) {
  try {
    const { tag } = await req.json();
    if (!tag || typeof tag !== "string") {
      return NextResponse.json({ error: "Invalid tag" }, { status: 400 });
    }

    const site = await prisma.website.findFirst();
    if (!site) {
      return NextResponse.json({ error: "No site config found" }, { status: 404 });
    }

    const existing = Array.isArray(site.tags) ? site.tags : [];
    const updatedTags = existing.filter(
      (t) => t.toLowerCase() !== tag.toLowerCase()
    );

    await prisma.website.update({
      where: { id: site.id },
      data: { tags: updatedTags },
    });

    await prisma.log.create({
      data: { who: "admin", content: `Tag removed: "${tag}"` },
    });

    return NextResponse.json({ tags: updatedTags }, { status: 200 });
  } catch (err) {
    console.error("[DELETE /api/admin/tags]", err);
    return NextResponse.json({ error: "Failed to delete tag" }, { status: 500 });
  }
}