import { prisma } from "../../../lib/prisma";

export async function POST(req) {
  try {
    const body     = await req.json();
    const page     = Number(body.page)  || 1;
    const limit    = Number(body.limit) || 10;
    const skip     = (page - 1) * limit;
    const search   = body.search   ?? "";
    const category = body.category ?? "";
    const status   = body.status   ?? "";

    // ── Where clause (filters) ─────────────────────────────────────────────
    const where = {
      ...(search   && { logoName:      { contains: search,   mode: "insensitive" } }),
      ...(category && { category:      { equals:   category } }),
      ...(status   && { publishStatus: { equals:   status   } }),
    };

    // ── Logos + count ──────────────────────────────────────────────────────
    const [logos, total] = await Promise.all([
      prisma.logo.findMany({
        where,
        skip,
        take: limit,
        orderBy: { updatedAt: "desc" },
        select: {
          // identifiers & avatar
          id:                       true,
          logoName:                 true,
          slug:                     true,
          webpUrl:                  true,

          // core info — for edit modal pre-fill
          brand:                    true,
          category:                 true,
          industry:                 true,
          country:                  true,
          website:                  true,
          description:              true,

          // publishing — for edit modal pre-fill
          publishStatus:            true,
          downloadCount:            true,

          // SEO — for edit modal pre-fill
          metaTitle:                true,
          metaDescription:          true,
          altText:                  true,
          focusKeywords:            true,

          // stats & dates — for table display
          downloadedNumberByPeople: true,
          createdAt:                true,
          updatedAt:                true,
        },
      }),
      prisma.logo.count({ where }),
    ]);

    // ── Categories from Website model ──────────────────────────────────────
    const website = await prisma.website.findFirst();
    const categoryNames = Array.isArray(website?.categories)
      ? website.categories.map((c) => c.name)
      : [];

    return Response.json({
      success:    true,
      page,
      totalPages: Math.ceil(total / limit),
      totalLogos: total,
      data:       logos,
      categories: categoryNames,
    });

  } catch (error) {
    console.error("Admin Logos API Error:", error);
    return Response.json({ error: "Failed to fetch logos" }, { status: 500 });
  }
}



export async function PATCH(req) {
  try {
    const body = await req.json();
    const { id, ...incoming } = body;

    if (!id) {
      return Response.json({ error: "ID is required" }, { status: 400 });
    }

    // ✅ Remove undefined / null / empty string
    const data = Object.fromEntries(
      Object.entries(incoming).filter(([_, v]) => v !== undefined && v !== null && v !== "")
    );

    // ✅ Optional: type fixes
    if (data.downloadCount !== undefined) {
      data.downloadCount = String(data.downloadCount);
    }

    const updatedLogo = await prisma.logo.update({
      where: { id },
      data,
    });

    return Response.json(updatedLogo);

  } catch (error) {
    console.error("PATCH Error:", error);
    return Response.json({ error: "Failed to update logo" }, { status: 500 });
  }
}


import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../../lib/r2";

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      console.warn("[DELETE] ❌ Missing logo ID in request body");
      return Response.json({ error: "Logo ID is required" }, { status: 400 });
    }

    console.log(`[DELETE] 🔍 Looking up logo with id: ${id}`);

    // ── 1. Fetch logo ──────────────────────────────────────────────────────
    const logo = await prisma.logo.findUnique({
      where: { id },
      select: {
        slug:    true,
        svgUrl:  true,
        pngUrl:  true,
        webpUrl: true,
        aiUrl:   true,
        cdrUrl:  true,
      },
    });

    if (!logo) {
      console.warn(`[DELETE] ❌ Logo not found in DB for id: ${id}`);
      return Response.json({ error: "Logo not found" }, { status: 404 });
    }

    console.log(`[DELETE] ✅ Logo found — slug: "${logo.slug}"`);

    // ── 2. Derive R2 keys ──────────────────────────────────────────────────
    const R2_ENDPOINT = process.env.R2_ENDPOINT;

    function urlToKey(url) {
      if (!url) return null;
      return url.replace(`${R2_ENDPOINT}/`, "");
    }

    const keyMap = {
      svg:  urlToKey(logo.svgUrl),
      png:  urlToKey(logo.pngUrl),
      webp: urlToKey(logo.webpUrl),
      ai:   urlToKey(logo.aiUrl),
      cdr:  urlToKey(logo.cdrUrl),
    };

    console.log("[DELETE] 🗂️  R2 keys resolved:", keyMap);

    const keysToDelete = Object.values(keyMap).filter(Boolean);

    if (keysToDelete.length === 0) {
      console.warn(`[DELETE] ⚠️  No R2 files found for slug: "${logo.slug}" — skipping R2 deletion`);
    }

    // ── 3. Delete from R2 ─────────────────────────────────────────────────
    if (keysToDelete.length > 0) {
      console.log(`[DELETE] 🚀 Sending batch delete to R2 for ${keysToDelete.length} file(s):`, keysToDelete);

      const r2Response = await r2.send(
        new DeleteObjectsCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: {
            Objects: keysToDelete.map((Key) => ({ Key })),
            Quiet: false, // verbose so we can log per-object results
          },
        })
      );

      // Deleted successfully
      if (r2Response.Deleted?.length > 0) {
        console.log(
          `[DELETE] ✅ R2 deleted ${r2Response.Deleted.length} file(s):`,
          r2Response.Deleted.map((d) => d.Key)
        );
      }

      // Partial failures
      if (r2Response.Errors?.length > 0) {
        console.error(
          `[DELETE] ❌ R2 failed to delete ${r2Response.Errors.length} file(s):`,
          r2Response.Errors.map((e) => ({
            key:     e.Key,
            code:    e.Code,
            message: e.Message,
          }))
        );
      }
    }

    // ── 4. Delete from DB ─────────────────────────────────────────────────
    console.log(`[DELETE] 🗄️  Deleting logo from DB — id: ${id}`);
    await prisma.logo.delete({ where: { id } });
    console.log(`[DELETE] ✅ Logo successfully deleted from DB — id: ${id}`);

    return Response.json({ success: true });

  } catch (error) {
    console.error("[DELETE] 💥 Unexpected error:", {
      message: error.message,
      stack:   error.stack,
      name:    error.name,
    });
    return Response.json({ error: "Failed to delete logo" }, { status: 500 });
  }
}