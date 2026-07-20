import { prisma } from "../../../../lib/prisma";
import { getPresignedUploadUrl, isAllowedImageType, deleteFromR2 } from "../../../../lib/presignedR2";

function sanitizeFileName(name = "") {
  return name.trim().toLowerCase().replace(/[^a-z0-9.\-]/g, "-").replace(/-+/g, "-");
}

const MAX_SIZE = 5 * 1024 * 1024; // 5MB, enforced client-side before requesting the URL

// ── POST: request a presigned upload URL ──────────────────────────────────
export async function POST(req, context) {
  try {
    const { params } = context;
    const { slug } = await params;
    const { fileName, fileType, fileSize } = await req.json();

    if (!fileName || !fileType) {
      return Response.json({ message: "fileName and fileType are required." }, { status: 400 });
    }
    if (!isAllowedImageType(fileType)) {
      return Response.json({ message: "Unsupported file type." }, { status: 400 });
    }
    if (fileSize && fileSize > MAX_SIZE) {
      return Response.json({ message: "File too large (max 5MB)." }, { status: 400 });
    }

    const website = await prisma.website.findFirst();
    if (!website) return Response.json({ message: "Website record not found." }, { status: 404 });

    const categories = Array.isArray(website.categories) ? website.categories : [];
    if (!categories.some(c => c.slug === slug)) {
      return Response.json({ message: "Category not found." }, { status: 404 });
    }

    const ext      = fileName.split(".").pop();
    const baseName = sanitizeFileName(fileName.replace(/\.[^.]+$/, ""));
    const key      = `category/${slug}/${Date.now()}-${baseName}.${ext}`;

    const uploadUrl = await getPresignedUploadUrl({ key, contentType: fileType });
    const publicUrl = `${process.env.R2_ENDPOINT}/${key}`;

    return Response.json({ uploadUrl, publicUrl, key });

  } catch (error) {
    console.error("[POST] presign category image", error);
    return Response.json({ message: "Failed to prepare upload." }, { status: 500 });
  }
}

// ── PUT: confirm upload succeeded, save the URL onto the category ─────────
export async function PUT(req, context) {
  try {
    const { params } = context;
    const { slug } = await params;
    const { url } = await req.json();

    if (!url) return Response.json({ message: "url is required." }, { status: 400 });

    const website = await prisma.website.findFirst();
    if (!website) return Response.json({ message: "Website record not found." }, { status: 404 });

    const categories = Array.isArray(website.categories) ? website.categories : [];
    const catIndex = categories.findIndex(c => c.slug === slug);
    if (catIndex === -1) return Response.json({ message: "Category not found." }, { status: 404 });

    const existingUrls = Array.isArray(categories[catIndex].url) ? categories[catIndex].url : [];
    if (!existingUrls.includes(url)) {
      categories[catIndex] = { ...categories[catIndex], url: [...existingUrls, url] };
      await prisma.website.update({ where: { id: website.id }, data: { categories } });
    }

    return Response.json({ success: true, category: categories[catIndex] });

  } catch (error) {
    console.error("[PUT] confirm category image", error);
    return Response.json({ message: "Failed to save image." }, { status: 500 });
  }
}

// ── DELETE: remove an image from R2 + the category ────────────────────────
export async function DELETE(req, context) {
  try {
    const { params } = context;
    const { slug } = await params;
    const { url } = await req.json();

    if (!url) return Response.json({ message: "Image url is required." }, { status: 400 });

    const website = await prisma.website.findFirst();
    if (!website) return Response.json({ message: "Website record not found." }, { status: 404 });

    const categories = Array.isArray(website.categories) ? website.categories : [];
    const catIndex = categories.findIndex(c => c.slug === slug);
    if (catIndex === -1) return Response.json({ message: "Category not found." }, { status: 404 });

    const existingUrls = Array.isArray(categories[catIndex].url) ? categories[catIndex].url : [];
    if (!existingUrls.includes(url)) {
      return Response.json({ message: "Image not found on this category." }, { status: 404 });
    }

    categories[catIndex] = { ...categories[catIndex], url: existingUrls.filter(u => u !== url) };
    await prisma.website.update({ where: { id: website.id }, data: { categories } });

    try {
      const key = url.replace(`${process.env.R2_ENDPOINT}/`, "");
      await deleteFromR2(key);
    } catch (r2Err) {
      console.error("[DELETE] r2 object delete failed", r2Err);
    }

    return Response.json({ success: true, category: categories[catIndex] });

  } catch (error) {
    console.error("[DELETE] category image", error);
    return Response.json({ message: "Failed to delete image." }, { status: 500 });
  }
}