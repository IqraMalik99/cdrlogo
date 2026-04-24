// app/api/admin/nav/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// ── POST /api/admin/nav ────────────────────────────────────────────────────
// Returns: { navItems, allPages }
//
// navItem shape (no pageId):
//   { link: "/slug", label: "Label", custom: false|true, add: true|false }
export async function POST() {
  try {
    const [site, allPages] = await Promise.all([
      prisma.website.findFirst({ select: { id: true, navItems: true } }),
      prisma.page.findMany({
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true, slug: true, publishStatus: true, InHome: true },
      }),
    ]);

    const storedNavItems = Array.isArray(site?.navItems) ? site.navItems : [];

    // Guard: CMS pages flagged InHome but missing from navItems (DB out of sync)
    // Match by link (slug) — no pageId needed
    const storedLinks = new Set(storedNavItems.filter(i => i.custom).map(i => i.link));
    const missingCmsItems = allPages
      .filter(p => p.InHome && !storedLinks.has("/" + p.slug))
      .map(p => ({
        link: "/" + p.slug,
        label: p.title,
        custom: true,
        add: true,
      }));

    return NextResponse.json({
      navItems: [...storedNavItems, ...missingCmsItems],
      allPages, // frontend filters out InHome:true for the dropdown
    });
  } catch (err) {
    console.error("[nav/POST]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PATCH /api/admin/nav ───────────────────────────────────────────────────
// Bulk-save the full navItems array to Website.navItems.
// Body: { navItems }
export async function PATCH(req) {
  try {
    const { navItems = [] } = await req.json();

    const existing = await prisma.website.findFirst({ select: { id: true } });
    if (existing) {
      await prisma.website.update({ where: { id: existing.id }, data: { navItems } });
    } else {
      await prisma.website.create({ data: { navItems } });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[nav/PATCH]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── PUT /api/admin/nav ─────────────────────────────────────────────────────
// Instant single-item ops.
//
// { op: "toggle",         link }         → flip `add` on any item (custom or not)
// { op: "add_default",    link, label }  → push new route item  { link, label, custom:false, add:true }
// { op: "remove_default", link }         → remove item by link
// { op: "add_cms",        link, label }  → InHome=true on Page + push custom item
// { op: "remove_cms",     link }         → InHome=false on Page + splice custom item
//
// All ops identify items by `link` (e.g. "/about-us") — no pageId in stored shape.
export async function PUT(req) {
  try {
    const body = await req.json();
    const { op } = body ?? {};
    if (!op) return NextResponse.json({ error: "op is required" }, { status: 400 });

    const site = await prisma.website.findFirst({ select: { id: true, navItems: true } });
    const current = Array.isArray(site?.navItems) ? [...site.navItems] : [];
    let updated = current;

    // ── toggle: flip `add` on the item whose link matches (works for both custom:true and custom:false)
    if (op === "toggle") {
      const { link } = body;
      if (!link) return NextResponse.json({ error: "link required" }, { status: 400 });
      updated = current.map(i => (i.link === link ? { ...i, add: !i.add } : i));
    }

    // ── add a new default route item (not backed by a CMS page)
    else if (op === "add_default") {
      const { link, label } = body;
      if (!link || !label) return NextResponse.json({ error: "link and label required" }, { status: 400 });
      if (current.some(i => i.link === link)) {
        return NextResponse.json({ error: "Item with this link already exists" }, { status: 409 });
      }
      updated = [...current, { link, label, custom: false, add: true }];
    }

    // ── remove any item by link (default or custom)
    else if (op === "remove_default") {
      const { link } = body;
      if (!link) return NextResponse.json({ error: "link required" }, { status: 400 });
      updated = current.filter(i => i.link !== link);
    }

    // ── add a CMS page: set InHome=true + push { link, label, custom:true, add:true }
    else if (op === "add_cms") {
      const { link, label } = body;
      if (!link || !label) return NextResponse.json({ error: "link and label required" }, { status: 400 });
      const slug = link.replace(/^\//, "");
      // Set InHome=true on the Page (find by slug)
      await prisma.page.updateMany({ where: { slug }, data: { InHome: true } });
      if (!current.some(i => i.link === link)) {
        updated = [...current, { link, label, custom: true, add: true }];
      }
    }

    // ── remove a CMS page: set InHome=false + splice item
    else if (op === "remove_cms") {
      const { link } = body;
      if (!link) return NextResponse.json({ error: "link required" }, { status: 400 });
      const slug = link.replace(/^\//, "");
      await prisma.page.updateMany({ where: { slug }, data: { InHome: false } });
      updated = current.filter(i => i.link !== link);
    }

    else {
      return NextResponse.json({ error: `Unknown op: ${op}` }, { status: 400 });
    }

    // Persist
    if (site) {
      await prisma.website.update({ where: { id: site.id }, data: { navItems: updated } });
    } else {
      await prisma.website.create({ data: { navItems: updated } });
    }

    return NextResponse.json({ ok: true, navItems: updated });
  } catch (err) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Page not found" }, { status: 404 });
    console.error("[nav/PUT]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// ── DELETE /api/admin/nav ──────────────────────────────────────────────────
// Backwards-compatible footer toggle (used by footer section).
// Body: { pageId, section, action: "add"|"remove" }
// This is untouched — footer uses pageId, nav does not.
export async function DELETE(req) {
  try {
    const { pageId, section, action } = (await req.json()) ?? {};
    if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });
    if (!["add", "remove"].includes(action)) {
      return NextResponse.json({ error: "action must be 'add' or 'remove'" }, { status: 400 });
    }

    const site = await prisma.website.findFirst({ select: { id: true, navItems: true } });
    const current = Array.isArray(site?.navItems) ? [...site.navItems] : [];
    let updated;

    if (action === "add") {
      const page = await prisma.page.update({
        where: { id: pageId }, data: { InHome: true },
        select: { id: true, title: true, slug: true, publishStatus: true },
      });
      updated = current.some(i => i.custom && i.link === "/" + page.slug)
        ? current
        : [...current, { link: "/" + page.slug, label: page.title, custom: true, add: true }];
    } else {
      const page = await prisma.page.update({
        where: { id: pageId }, data: { InHome: false },
        select: { slug: true },
      });
      updated = current.filter(i => i.link !== "/" + page.slug);
    }

    if (site) {
      await prisma.website.update({ where: { id: site.id }, data: { navItems: updated } });
    } else {
      await prisma.website.create({ data: { navItems: updated } });
    }

    return NextResponse.json({ ok: true, navItems: updated });
  } catch (err) {
    if (err?.code === "P2025") return NextResponse.json({ error: "Page not found" }, { status: 404 });
    console.error("[nav/DELETE]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}