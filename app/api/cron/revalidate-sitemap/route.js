import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function GET(req) {

  try {
    revalidatePath("/sitemap.xml");
    console.log("run");

    const baseUrl = (process.env.NEXT_PUBLIC_BASE_URL || "https://cdrlogo.com").replace(/\/$/, "");
    const warmupRes = await fetch(`${baseUrl}/sitemap.xml`, { cache: "no-store" });
       console.log(warmupRes);
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