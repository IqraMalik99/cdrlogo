// app/api/blogs/[id]/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// GET /api/blogs/all?page=&limit=&category=&search=   → paginated admin list
// GET /api/blogs/[id]                                 → single post by id
export async function GET(request, { params }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    if (id === "all") {
      const page     = parseInt(searchParams.get("page")  || "1");
      const limit    = parseInt(searchParams.get("limit") || "10");
      const category = searchParams.get("category") || "";
      const search   = searchParams.get("search")   || "";
      const skip     = (page - 1) * limit;

      const where = {
        ...(category && { category: { equals: category, mode: "insensitive" } }),
        ...(search && {
          OR: [
            { title:   { contains: search, mode: "insensitive" } },
            { excerpt: { contains: search, mode: "insensitive" } },
            { content: { contains: search, mode: "insensitive" } },
          ],
        }),
      };

      const [blogs, total] = await Promise.all([
        prisma.blog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
          select: {
            id: true, title: true, slug: true, excerpt: true,
            content: true, category: true, image: true,
            readTime: true, published: true, createdAt: true,
          },
        }),
        prisma.blog.count({ where }),
      ]);

      return NextResponse.json({
        blogs,
        pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
      });
    }

    // single by id
    const blog = await prisma.blog.findUnique({ where: { id } });
    if (!blog) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ blog });

  } catch (error) {
    console.error("[GET /api/blogs/:id]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/blogs/by-slug  → fetch full post by slug (used by edit form)
export async function POST(request, { params }) {
  try {
    const { id } = await params;

    if (id === "by-slug") {
      const { slug } = await request.json();
      if (!slug) return NextResponse.json({ error: "Slug required" }, { status: 400 });

      const blog = await prisma.blog.findUnique({ where: { slug } });
      if (!blog) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json({ blog });
    }

    return NextResponse.json({ error: "Invalid endpoint" }, { status: 400 });
  } catch (error) {
    console.error("[POST /api/blogs/:id]", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// PATCH /api/blogs/[id]  → partial update
export async function PATCH(request, { params }) {
  try {
    const { id } = await params;

    const formData = await request.formData();

    const title     = formData.get("title");
    const slug      = formData.get("slug");
    const excerpt   = formData.get("excerpt");
    const content   = formData.get("content");
    const category  = formData.get("category");
    const readTime  = formData.get("readTime");
    const published = formData.get("published");

    // NOTE: image is intentionally never read here. Editing a post must
    // never change its cover image — that's set once at creation only.

    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const blog = await prisma.blog.update({
      where: { id },
      data: {
        ...(title      !== null && { title }),
        ...(slug       !== null && { slug }),
        ...(excerpt    !== null && { excerpt }),
        ...(content    !== null && { content }),
        ...(category   !== null && { category }),
        ...(readTime   !== null && { readTime: Number(readTime) }),
        ...(published  !== null && { published: published === "true" }),
      },
    });

    return NextResponse.json({ blog });
  } catch (error) {
    if (error.code === "P2002") return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    console.error("[PATCH /api/blogs/:id]", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

// DELETE /api/blogs/[id]
export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const existing = await prisma.blog.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    await prisma.blog.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[DELETE /api/blogs/:id]", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}