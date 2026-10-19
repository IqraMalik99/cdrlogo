// app/api/template-categories/route.js
import { NextResponse } from "next/server";
import { getTemplateCategoryCounts } from "../../../lib/templateQueries";

export async function GET() {
  try {
    const categories = await getTemplateCategoryCounts();
    const total = categories.reduce((sum, c) => sum + c.count, 0);
    return NextResponse.json(
      { categories, total },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    console.error("[template-categories GET]", err);
    return NextResponse.json({ error: "Failed to load counts" }, { status: 500 });
  }
}