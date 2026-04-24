// app/api/admin/footer/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";



// ── POST /api/admin/footer ─────────────────────────────────────────────────
// Load all footer data.
// Returns: { footer, quickLinks, legalLinks, otherPages }
export async function POST() {
  try {
    const [site, allPages] = await Promise.all([
      prisma.website.findFirst({ select: { id: true, Footer: true } }),
      prisma.page.findMany({
        orderBy: { createdAt: "desc" },
        select: {
          id:            true,
          title:         true,
          slug:          true,
          publishStatus: true,
          InFooter:      true,
          InLegal:       true,
        },
      }),
    ]);

    return NextResponse.json({
      footer:     site?.Footer ?? null,
      quickLinks: allPages.filter(p => p.InFooter && !p.InLegal),
      legalLinks: allPages.filter(p => p.InLegal),
      otherPages: allPages.filter(p => !p.InFooter && !p.InLegal),
    });
  } catch (err) {
    console.error("[footer/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH /api/admin/footer ────────────────────────────────────────────────
// Save ALL footer changes.
// Replaces $transaction (caused P2028) with sequential awaited calls — safe
// because these are simple upsert/updateMany operations with no rollback needed.
//
// Body: { content, quickLinkIds, legalLinkIds, allPageIds, quickLinkSlugs?, legalLinkSlugs? }
export async function PATCH(req) {
  try {
    const {
      content,
      quickLinkIds = [],
      legalLinkIds = [],
      allPageIds   = [],
    } = await req.json();

    const footerJson = {
      description: content?.description ?? "",
      copyright:   content?.copyright   ?? "",
      facebook:    content?.facebook    ?? "",
      twitter:     content?.twitter     ?? "",
      instagram:   content?.instagram   ?? "",
      pinterest:   content?.pinterest   ?? "",
    };

    // 1. Upsert Website.Footer — find first, then update or create
    const existing = await prisma.website.findFirst({ select: { id: true } });

    if (existing) {
      await prisma.website.update({
        where: { id: existing.id },
        data:  { Footer: footerJson },
      });
    } else {
      await prisma.website.create({
        data: { Footer: footerJson },
      });
    }

    // 2. Reset all known page flags to false
    if (allPageIds.length) {
      await prisma.page.updateMany({
        where: { id: { in: allPageIds } },
        data:  { InFooter: false, InLegal: false },
      });
    }

    // 3. Set InFooter=true for quick link pages
    if (quickLinkIds.length) {
      await prisma.page.updateMany({
        where: { id: { in: quickLinkIds } },
        data:  { InFooter: true, InLegal: false },
      });
    }

    // 4. Set InLegal=true for legal pages
    if (legalLinkIds.length) {
      await prisma.page.updateMany({
        where: { id: { in: legalLinkIds } },
        data:  { InLegal: true },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[footer/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/footer ───────────────────────────────────────────────
// Instantly toggle a single page in/out of a footer section.
//
// Body: { pageId, section: "quick"|"legal", action: "add"|"remove" }
//
// Behaviour:
//   add    + quick  →  InFooter=true,  InLegal=false
//   add    + legal  →  InLegal=true,   InFooter=false
//   remove + quick  →  InFooter=false  (InLegal untouched)
//   remove + legal  →  InLegal=false   (InFooter untouched)
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { pageId, section, action } = body ?? {};

    if (!pageId || typeof pageId !== "string") {
      return NextResponse.json({ error: "pageId is required" }, { status: 400 });
    }
    if (!["quick", "legal"].includes(section)) {
      return NextResponse.json({ error: "section must be 'quick' or 'legal'" }, { status: 400 });
    }
    if (!["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }

    let data;
    if (action === "add") {
      data = section === "quick"
        ? { InFooter: true,  InLegal: false }
        : { InLegal:  true,  InFooter: false };
    } else {
      data = section === "quick"
        ? { InFooter: false }
        : { InLegal:  false };
    }

    const updated = await prisma.page.update({
      where:  { id: pageId },
      data,
      select: {
        id:            true,
        title:         true,
        slug:          true,
        publishStatus: true,
        InFooter:      true,
        InLegal:       true,
      },
    });

    return NextResponse.json({ ok: true, page: updated });
  } catch (err) {
    if (err?.code === "P2025") {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }
    console.error("[footer/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}