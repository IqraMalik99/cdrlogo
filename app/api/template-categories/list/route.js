import { NextResponse } from "next/server";
import { getTemplateCategoryCounts } from "../../../lib/templateQueries";

export async function GET() {
  const categories = await getTemplateCategoryCounts();
  return NextResponse.json({ categories });
}