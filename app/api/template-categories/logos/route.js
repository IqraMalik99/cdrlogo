// app/api/template-categories/logos/route.js
import { NextResponse } from "next/server";
import { getTemplateLogos } from "../../../../lib/templateQueries";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "48", 10) || 48));

    if (!category) return NextResponse.json({ error: "category required" }, { status: 400 });

    const data = await getTemplateLogos({ categoryId: category, page, limit });
    return NextResponse.json(data, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (err) {
    console.error("[template-categories/logos GET]", err);
    return NextResponse.json({ error: "Failed to load logos" }, { status: 500 });
  }
}