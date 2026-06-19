// app/api/blogs/get-by-slug/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

// POST /api/blogs/get-by-slug
// Body: { slug: "my-blog-post" }
export async function POST(request) {
  try {
    const body = await request.json();
    let { slug } = body;
    console.log("slug",slug);
    slug="/"+slug;
    console.log("slugss",slug)
    if (!slug) {
      return NextResponse.json({ error: "Slug is required" }, { status: 400 });
    }

    const blog = await prisma.blog.findUnique({
      where: { slug },
    });

    console.log(blog,"blogg");

    if (!blog ) {
      return NextResponse.json({ error: "Blog post not found" }, { status: 404 });
    }

    return NextResponse.json( blog );
  } catch (error) {
    console.error("[POST /api/blogs/get-by-slug]", error);
    return NextResponse.json({ error: "Failed to fetch blog" }, { status: 500 });
  }
}