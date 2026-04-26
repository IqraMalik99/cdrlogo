import { prisma } from "../../../lib/prisma";

// GET all pages
export async function GET() {
  try {
    const pages = await prisma.page.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, title: true, slug: true,
        publishStatus: true, createdAt: true, updatedAt: true,
      },
    });
    
    return Response.json({ success: true, data: pages });
  } catch (error) {
    console.error("[Pages API] GET error:", error);
    return Response.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}

// GET single page with content (for editor)
// Called as GET /api/pages/admin?id=xxx
// We handle this via POST with action:"get"
export async function POST(req) {
  try {
    const body = await req.json();
    const { action, id } = body;

    // ── Fetch single page with content ────────────────────────────────────
    if (action === "get") {
      if (!id) return Response.json({ error: "ID required" }, { status: 400 });
      const page = await prisma.page.findUnique({ where: { id } });
      if (!page) return Response.json({ error: "Page not found" }, { status: 404 });
      return Response.json({ success: true, data: page });
    }

    // ── Create new page ───────────────────────────────────────────────────
    if (action === "create") {
      const { title, slug, content, publishStatus } = body;
      console.log("body",body);
      if (!title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });
      if (!slug?.trim())  return Response.json({ error: "Slug is required"  }, { status: 400 });

      // Check slug uniqueness
    //   const existing = await prisma.page.findUnique({ where: { slug } });
    //   if (existing) return Response.json({ error: "Slug already exists" }, { status: 409 });

      const page = await prisma.page.create({
        data: { title: title.trim(), slug: slug.trim(), content: content || "", publishStatus: publishStatus || "draft" },
      });
      console.log(`[Pages API] ✅ Created page: "${page.title}" (${page.slug})`);
      await prisma.log.create({
  data: {
    who: "api:pages",
    content: `Page created: ${page.title} (${page.slug})`,
  },
});
      return Response.json({ success: true, data: page });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });

  } catch (error) {
    console.error("[Pages API] POST error:", error);
    await prisma.log.create({
  data: {
    who: "api:pages",
    content: `GET error: ${error?.message}`,
  },
});
    return Response.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH — update page
export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...incoming } = body;
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

const data = Object.fromEntries(
  Object.entries(incoming).filter(([_, v]) => v !== undefined && v !== null)
);
const page = await prisma.page.update({ where: { id }, data });
    await prisma.log.create({
  data: {
    who: "api:pages",
    content: `Page updated: ${page.title} (${id})`,
  },
});
    console.log(`[Pages API] ✅ Updated page: "${page.title}"`);
    return Response.json({ success: true, data: page });

  } catch (error) {
    console.error("[Pages API] PATCH error:", error);
    await prisma.log.create({
  data: {
    who: "api:pages",
    content: `GET error: ${error?.message}`,
  },
});
    return Response.json({ error: "Failed to update page" }, { status: 500 });
  }
}

// DELETE — delete page
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { id } = body;
    if (!id) return Response.json({ error: "ID required" }, { status: 400 });

    const page = await prisma.page.findUnique({ where: { id } });
    if (!page) return Response.json({ error: "Not found" }, { status: 404 });

    await prisma.page.delete({ where: { id } });
    console.log(`[Pages API] ✅ Deleted page: "${page.title}" (${page.slug})`);
    await prisma.log.create({
  data: {
    who: "api:pages",
    content: `Page deleted: ${page.title} (${page.slug})`,
  },
});
    return Response.json({ success: true });

  } catch (error) {
    console.error("[Pages API] DELETE error:", error);
    await prisma.log.create({
  data: {
    who: "api:pages",
    content: `GET error: ${error?.message}`,
  },
});
    return Response.json({ error: "Failed to delete page" }, { status: 500 });
  }
}
