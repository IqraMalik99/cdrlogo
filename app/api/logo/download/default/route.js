import { prisma } from "../../../../lib/prisma";

const FILE_MAP = {
  svg: { field: "svgUrl", mime: "image/svg+xml", ext: "svg" },
  png: { field: "pngUrl", mime: "image/png", ext: "png" },
  ai: { field: "aiUrl", mime: "application/postscript", ext: "ai" },
  cdr: { field: "cdrUrl", mime: "application/cdr", ext: "cdr" },
};

export async function POST(req) {
  try {
    const { logoId, format, user } = await req.json();

    // ── USER INFO ─────────────────────────────────────────────
    let userinfo = { email: "guest", name: "guest" };
    let userRecord = null;

    if (user) {
      userRecord = await prisma.user.findUnique({
        where: { id: user },
      });

      console.log("[Download] User info:", userRecord);

      if (!userRecord) {
        return Response.json({ error: "User not found" }, { status: 404 });
      }

      userinfo = {
        email: userRecord.email || "unknown",
        name: userRecord.name || "unknown",
      };

      // 🚫 LIMIT CHECK
      if (
        userRecord.downloadLimit !== -1 &&
        userRecord.downloadCountUsed >= userRecord.downloadLimit
      ) {
        await prisma.log.create({
          data: {
            who: `user:${userinfo.email}`,
            content: `Download blocked - limit reached`,
          },
        });

        return Response.json(
          { error: "Download limit reached" },
          { status: 403 }
        );
      }
    }

    // ── VALIDATION ────────────────────────────────────────────
    if (!logoId) {
      await prisma.log.create({
        data: {
          who: `user:${userinfo.email}`,
          content: `Download failed - missing logoId`,
        },
      });
      return Response.json({ error: "logoId is required" }, { status: 400 });
    }

    if (!format || !FILE_MAP[format]) {
      await prisma.log.create({
        data: {
          who: `user:${userinfo.email}`,
          content: `Invalid format requested: ${format}`,
        },
      });
      return Response.json(
        { error: "Invalid format. Use: svg, png, ai, cdr" },
        { status: 400 }
      );
    }

    // ── FETCH LOGO ────────────────────────────────────────────
    const logo = await prisma.logo.findUnique({
      where: { id: logoId },
    });

    if (!logo) {
      await prisma.log.create({
        data: {
          who: `user:${userinfo.email}`,
          content: `Logo not found. ID: ${logoId}`,
        },
      });
      return Response.json({ error: "Logo not found" }, { status: 404 });
    }

    const { field, mime, ext } = FILE_MAP[format];
    const fileUrl = logo[field];

    if (!fileUrl) {
      await prisma.log.create({
        data: {
          who: `user:${userinfo.email}`,
          content: `Download failed - ${format} not available`,
        },
      });
      return Response.json(
        { error: `No ${format.toUpperCase()} file available` },
        { status: 404 }
      );
    }

    // ── FETCH FILE FROM STORAGE ───────────────────────────────
    const upstream = await fetch(fileUrl);

    if (!upstream.ok) {
      await prisma.log.create({
        data: {
          who: `user:${userinfo.email}`,
          content: `Storage fetch failed`,
        },
      });
      return Response.json(
        { error: "Failed to fetch file from storage" },
        { status: 502 }
      );
    }

    // ── ✅ INCREMENT COUNTERS (SAFE) ──────────────────────────
    await Promise.all([
      prisma.logo.update({
        where: { id: logoId },
        data: {
          downloadedNumberByPeople: { increment: 1 },
        },
      }),
      userRecord
        ? prisma.user.update({
            where: { id: userRecord.id },
            data: {
             downloadCountUsed: { increment: 1 },
            },
          })
        : Promise.resolve(),
    ]);

    // ── SUCCESS LOG ──────────────────────────────────────────
    await prisma.log.create({
      data: {
        who: `user:${userinfo.email}`,
        content: `Downloaded logo ${logo.slug} in ${format}`,
      },
    });

    // ── RETURN FILE ──────────────────────────────────────────
    return new Response(upstream.body, {
      headers: {
        "Content-Type": mime,
        "Content-Disposition": `attachment; filename="${logo.slug}.${ext}"`,
        "Cache-Control": "no-store",
      },
    });

  } catch (err) {
    console.error("[download]", err);

    await prisma.log.create({
      data: {
        who: "api:download",
        content: `Server error: ${err?.message}`,
      },
    });

    return Response.json({ error: "Server error" }, { status: 500 });
  }
}