import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";

const PAGE_SIZE = 24;

function toWords(str = "") {
  const result = String(str)
    .toLowerCase()
    .trim()
    .replace(/-/g, " ") // hyphen → space
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean);

  console.log("[toWords]", {
    input: str,
    output: result,
  });

  return result;
}

// -------------------------------------------------------
// Resolve category and fetch data
// -------------------------------------------------------
async function resolveCategoryAndFetch(slug, page) {
  console.log("\n========================================");
  console.log("[resolveCategoryAndFetch] START");
  console.log("========================================");

  console.log("[1] Incoming slug:", slug);
  console.log("[1] Incoming page:", page);
  console.log("[1] PAGE_SIZE:", PAGE_SIZE);

  // -----------------------------------------------------
  // Convert URL slug into words
  // -----------------------------------------------------
  const targetWords = toWords(slug);

  console.log("[2] targetWords:", targetWords);

  // -----------------------------------------------------
  // Get website
  // -----------------------------------------------------
  console.log("[3] Fetching website from database...");

  const website = await prisma.website.findFirst();

  console.log("[3] Website found:", !!website);

  // -----------------------------------------------------
  // Get categories
  // -----------------------------------------------------
  const categories = Array.isArray(website?.categories)
    ? website.categories
    : [];

  console.log(
    "[4] Total website category entries:",
    categories.length
  );

  // -----------------------------------------------------
  // Show all categories
  // -----------------------------------------------------
  console.log("[5] All website categories:");

  categories.forEach((entry, index) => {
    console.log(`[CATEGORY ${index}]`, {
      name: entry?.name,
      subname: entry?.subname,
      slug: entry?.slug,
      brand: entry?.brand,
      type: entry?.type,
    });
  });

  // -----------------------------------------------------
  // Find matching subcategories
  //
  // IMPORTANT:
  // ONE matching word is enough.
  //
  // Example:
  //
  // URL:
  // american-football
  //
  // targetWords:
  // ["american", "football"]
  //
  // "American Football" → MATCH
  // "American"          → MATCH
  // "Football"          → MATCH
  // "Basketball"        → NO MATCH
  // -----------------------------------------------------
  console.log("\n[6] Looking for matching subcategory...");

  const matchingEntries = categories.filter((entry) => {
    const entrySubname = entry?.subname || "";

    const subnameWords = toWords(entrySubname);

    const isMatch =
      targetWords.length > 0 &&
      targetWords.some((targetWord) =>
        subnameWords.includes(targetWord)
      );

    console.log("[MATCH CHECK]", {
      subname: entrySubname,
      targetWords,
      subnameWords,
      isMatch,
    });

    return isMatch;
  });

  // -----------------------------------------------------
  // Matching result
  // -----------------------------------------------------
  console.log(
    "\n[7] Matching entries count:",
    matchingEntries.length
  );

  console.log(
    "[7] Matching entries:",
    matchingEntries
  );

  // -----------------------------------------------------
  // No match
  // -----------------------------------------------------
  if (!matchingEntries.length) {
    console.log("[8] ❌ NO MATCH FOUND");

    return {
      status: 404,
      body: {
        logos: [],
        totalPages: 1,

        // Convert:
        // american-football
        // ↓
        // american football
        categoryName: slug.replace(/-/g, " "),

        totalCount: 0,
      },
    };
  }

  // -----------------------------------------------------
  // Category name
  // -----------------------------------------------------
  const categoryName = matchingEntries[0].subname;

  console.log(
    "[9] Matched categoryName:",
    categoryName
  );

  // -----------------------------------------------------
  // Count
  // -----------------------------------------------------
  const totalCount = matchingEntries.length;

  console.log(
    "[10] totalCount:",
    totalCount
  );

  // -----------------------------------------------------
  // Total pages
  // -----------------------------------------------------
  const totalPages = Math.max(
    1,
    Math.ceil(totalCount / PAGE_SIZE)
  );

  console.log(
    "[11] totalPages:",
    totalPages
  );

  // -----------------------------------------------------
  // Pagination
  // -----------------------------------------------------
  const start = (page - 1) * PAGE_SIZE;

  console.log("[12] Pagination:", {
    page,
    PAGE_SIZE,
    start,
    end: start + PAGE_SIZE,
  });

  const pageRows = matchingEntries.slice(
    start,
    start + PAGE_SIZE
  );

  console.log(
    "[13] pageRows count:",
    pageRows.length
  );

  console.log(
    "[13] pageRows:",
    pageRows
  );

  // -----------------------------------------------------
  // Final response
  // -----------------------------------------------------
  const responseBody = {
    logos: pageRows,
    totalPages,
    totalCount,
    categoryName,
  };

  console.log("\n[14] FINAL RESPONSE:");
  console.log(responseBody);

  console.log("\n========================================");
  console.log("[resolveCategoryAndFetch] END");
  console.log("========================================\n");

  return {
    status: 200,
    body: responseBody,
  };
}

// -------------------------------------------------------
// GET
// -------------------------------------------------------
export async function GET(req, { params }) {
  console.log("\n\n########################################");
  console.log("[GET] CATEGORY API CALLED");
  console.log("########################################");

  try {
    const { slug } = await params;

    console.log("[GET] slug:", slug);

    const { searchParams } = new URL(req.url);

    console.log(
      "[GET] searchParams:",
      Object.fromEntries(searchParams.entries())
    );

    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10)
    );

    console.log("[GET] page:", page);

    const result = await resolveCategoryAndFetch(
      slug,
      page
    );

    console.log(
      "[GET] status:",
      result.status
    );

    console.log(
      "[GET] response body:",
      result.body
    );

    return NextResponse.json(
      result.body,
      {
        status: result.status,
      }
    );
  } catch (error) {
    console.error(
      "[GET] ❌ ERROR:",
      error
    );

    return NextResponse.json(
      {
        error: "Failed to fetch category",
      },
      {
        status: 500,
      }
    );
  }
}

