// app/api/admin/media-library/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// ── POST /api/admin/media-library ─────────────────────────────────────────
// Load logos with optional filters.
// Body: { search?, format?, page?, limit? }
export async function POST(req) {
  try {
    const body   = await req.json().catch(() => ({}));
    const search = body.search  ?? "";
    const format = body.format  ?? "";
    const page   = Math.max(1, parseInt(body.page  ?? "1"));
    const limit  = Math.min(100, parseInt(body.limit ?? "48"));
    const skip   = (page - 1) * limit;

    const where = {
      ...(search
        ? {
            OR: [
              { logoName: { contains: search, mode: "insensitive" } },
              { slug:     { contains: search, mode: "insensitive" } },
              { brand:    { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(format === "svg" ? { svgUrl: { not: null } } : {}),
      ...(format === "png" ? { pngUrl: { not: null } } : {}),
      ...(format === "ai"  ? { aiUrl:  { not: null } } : {}),
      ...(format === "cdr" ? { cdrUrl: { not: null } } : {}),
    };

    const [logos, total] = await Promise.all([
      prisma.logo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id:            true,
          logoName:      true,
          slug:          true,
          brand:         true,
          category:      true,
          webpUrl:       true,
          svgUrl:        true,
          pngUrl:        true,
          aiUrl:         true,
          cdrUrl:        true,
          svgfilesize:   true,
          pngfilesize:   true,
          aifilesize:    true,
          cdrfilesize:   true,
          publishStatus: true,
          createdAt:     true,
        },
      }),
      prisma.logo.count({ where }),
    ]);

    const [totalCount, svgCount, aiCount, cdrCount, pngCount] = await Promise.all([
      prisma.logo.count(),
      prisma.logo.count({ where: { svgUrl: { not: null } } }),
      prisma.logo.count({ where: { aiUrl:  { not: null } } }),
      prisma.logo.count({ where: { cdrUrl: { not: null } } }),
      prisma.logo.count({ where: { pngUrl: { not: null } } }),
    ]);

    return NextResponse.json({
      logos,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalLogos: totalCount,
        svgFiles:   svgCount,
        aiFiles:    aiCount,
        cdrFiles:   cdrCount,
        pngFiles:   pngCount,
      },
    });
  } catch (err) {
    console.error("[media-library/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH /api/admin/media-library ────────────────────────────────────────
// Single-op actions.
// Body: { op: "delete", id }
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { op } = body ?? {};
    if (!op) return NextResponse.json({ error: "op is required" }, { status: 400 });

    if (op === "delete") {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      await prisma.logo.delete({ where: { id } });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
  } catch (err) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Logo not found" }, { status: 404 });
    }
    console.error("[media-library/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}