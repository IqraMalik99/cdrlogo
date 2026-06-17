import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

// Vercel Cron hits this once a day (see vercel.json).
// It forces the cached sitemap to be thrown away so the next request
// regenerates it fresh from the DB, instead of waiting for the
// 1-hour `revalidate` window in sitemap.js to lazily expire.
export async function GET(req) {
  // Vercel sets this header automatically on cron-triggered requests.
  // This blocks randoms from hitting the route and spamming revalidation.
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    revalidatePath("/sitemap.xml");

    // Invalidating the cache only clears it — sitemap.js itself only re-runs
    // when /sitemap.xml is next requested. We trigger that request ourselves
    // right here so the rebuild happens now, not whenever the next outside
    // visitor or crawler happens to load it.
    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://cdrlogo.com").replace(/\/$/, "");
    const warmupRes = await fetch(`${baseUrl}/sitemap.xml`, { cache: "no-store" });

    return NextResponse.json({
      ok: true,
      revalidated: "/sitemap.xml",
      warmedUp: warmupRes.ok,
      time: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[cron:revalidate-sitemap] error:", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
}