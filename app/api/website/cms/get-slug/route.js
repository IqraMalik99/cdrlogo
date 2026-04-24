import { prisma } from "../../../../lib/prisma";
export async function POST(req) {
  try {
     const body = await req.json();
    const { slug } = body;

    // ── If slug provided → return single page ─────────────────────────────
    if (slug) {
      const page = await prisma.page.findUnique({
        where: { slug , publishStatus: "published" },
      });

      if (!page) {
        return Response.json({ error: "Page not found" }, { status: 404 });
      }

      return Response.json({ success: true, data: page });
    }


    return Response.json({ success: true, data: pages });
  } catch (error) {
    console.error("[Pages API] GET error:", error);
    return Response.json({ error: "Failed to fetch pages" }, { status: 500 });
  }
}