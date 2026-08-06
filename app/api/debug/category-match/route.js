import { NextResponse } from "next/server";
import OpenAI from "openai";
import { prisma } from "../../../lib/prisma";
import {
  extractCategoryEntries,
  buildCategoryTree,
  findCategoryMatch,
  classifyMainSubCategory,
  validateMainSubAgainstTree,
} from "../../../lib/categoryMatch";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST { "logoName": "Amul Milk" }
// Optional: { "logoName": "...", "mainCategory": "...", "subCategory": "..." }
//   → skips the GPT classification step and runs the DB match directly
//     against the main/sub you pass in, useful for isolating whether the
//     bug is in classification or in the brand-matching step.
export async function POST(req) {
  try {
    const body = await req.json();
    const { logoName, mainCategory: mainOverride, subCategory: subOverride } = body;

    if (!logoName) {
      return NextResponse.json({ error: "logoName is required." }, { status: 400 });
    }

    const websiteRecord = await prisma.website.findFirst();
    const entries = extractCategoryEntries(websiteRecord?.categories);
    const tree = buildCategoryTree(entries);

    let mainCategory, subCategory, reasoning = null, gptRaw = null;

    if (mainOverride) {
      // Manual override path — skip GPT, test the DB match directly.
      mainCategory = mainOverride;
      subCategory = subOverride || "";
    } else {
      const classified = await classifyMainSubCategory({ openai, logoName, tree });
      reasoning = classified.reasoning;
      gptRaw = classified.raw;
      const validated = validateMainSubAgainstTree(tree, classified.mainCategory, classified.subCategory);
      mainCategory = validated.mainCategory;
      subCategory = validated.subCategory;
    }

    const { match, candidates, log } = findCategoryMatch(entries, mainCategory, subCategory, logoName);

    const resolvedBrand = match?.brand || (subCategory ? `Other ${subCategory}` : "");
    const resolvedCountry = match?.country || "Worldwide";
    const resolvedIndustry = match?.etype || "Logo Design & Graphics";

    return NextResponse.json({
      input: { logoName, mainOverride: mainOverride || null, subOverride: subOverride || null },
      gpt: { reasoning, raw: gptRaw },
      category: { mainCategory, subCategory },
      dbLookup: {
        totalCategoryEntries: entries.length,
        candidatesForThisPair: candidates.map((c) => ({
          brand: c.brand,
          country: c.country,
          synonyms: c.synonyms,
        })),
        log, // step-by-step trace of every candidate checked and why it did/didn't match
      },
      matchedRecord: match ? { brand: match.brand, country: match.country, etype: match.etype } : null,
      resolved: {
        brand: resolvedBrand,
        country: resolvedCountry,
        industry: resolvedIndustry,
      },
      finalLogoCategory: [mainCategory === "template" ? "template" : subCategory],
    });
  } catch (error) {
    console.error("[debug/category-match] Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}