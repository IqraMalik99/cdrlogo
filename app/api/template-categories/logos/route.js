import { NextResponse } from "next/server";
import { getTemplateCategory } from "../../../lib/templateCategories";
import { getTemplateLogos } from "../../../lib/templateQueries";

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(100, parseInt(searchParams.get("limit") || "48", 10));

  if (!getTemplateCategory(category)) {
    return NextResponse.json({ error: "Unknown category" }, { status: 404 });
  }
  const data = await getTemplateLogos({ categoryId: category, page, limit });
  return NextResponse.json(data);
}