// app/api/blogs/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";



// GET /api/blogs?page=1&limit=9&category=tutorials
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    console.log("Search",searchParams);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "9");
    const category = searchParams.get("category") || "";
    const search = searchParams.get("search") || "";

    const skip = (page - 1) * limit;

    const where = {
      published: true,
      ...(category && { category: { equals: category, mode: "insensitive" } }),
      ...(search && {
        OR: [
          { title: { contains: search, mode: "insensitive" } },
          { excerpt: { contains: search, mode: "insensitive" } },
          { content: { contains: search, mode: "insensitive" } }
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
          id: true,
          image:true,
          title: true,
          slug: true,
          excerpt: true,
          category: true,
          // coverEmoji: true,
          readTime: true,
          createdAt: true,
           published: true,
        },
      }),
      prisma.blog.count({ where }),
    ]);

    return NextResponse.json({
      blogs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET /api/blogs]", error);
    return NextResponse.json({ error: "Failed to fetch blogs" }, { status: 500 });
  }
}

import { uploadToR2 } from "../../lib/uploadToR2";
import { randomUUID } from "crypto";


const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

const EXT_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function POST(request) {
  try {
    const formData = await request.formData();

    const title     = formData.get("title");
    const slug      = formData.get("slug");
    const excerpt   = formData.get("excerpt");
    const content   = formData.get("content");
    const category  = formData.get("category");
    const readTime  = formData.get("readTime");
    const published = formData.get("published");
    const file      = formData.get("image"); // File

    if (!title || !slug || !excerpt || !content || !category) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Image is required" }, { status: 400 });
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: "Unsupported file type. Use JPG, PNG, WEBP, or GIF." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: "File too large. Max size is 5MB." },
        { status: 400 }
      );
    }

    // 1) Upload image to R2 first
    const ext = EXT_BY_MIME[file.type] || "jpg";
    const fileName = `blog/${randomUUID()}.${ext}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const imageUrl = await uploadToR2({
      fileBuffer,
      fileName,
      mimeType: file.type,
    });

    console.log("created sucess",imageUrl);

    // 2) Create the blog row referencing the uploaded image URL
    try {
      const blog = await prisma.blog.create({
        data: {
          title,
          slug: "/" + slug,
          excerpt,
          content,
          category,
          image: imageUrl,
          readTime: readTime ? Number(readTime) : 5,
          published: published === undefined ? true : published === "true",
        },
      });

      return NextResponse.json({ blog }, { status: 201 });
    } catch (dbError) {
      // Blog creation failed after image was uploaded.
      // The image is now orphaned in R2 — log it so it can be cleaned up,
      // since we don't want to block the response on a delete-from-R2 call.
      console.error("[POST /api/blogs] DB error after upload, orphaned image:", imageUrl, dbError);

      if (dbError.code === "P2002") {
        return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
      }
      return NextResponse.json({ error: "Failed to create blog" }, { status: 500 });
    }
  } catch (error) {
    console.error("[POST /api/blogs]", error);
    return NextResponse.json({ error: "Failed to create blog" }, { status: 500 });
  }
}