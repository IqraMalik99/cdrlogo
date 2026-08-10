
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";

export async function GET() {
  try {
    const [logos, website] = await Promise.all([
      // Get all published logos
      prisma.logo.findMany({
        where: {
          publishStatus: "Published",
        },
        select: {
          category: true,
        },
      }),

      // Get website categories
      prisma.website.findFirst({
        select: {
          categories: true,
        },
      }),
    ]);

    // -------------------------------------------------------
    // 1. Count how many published logos use each SUBCATEGORY
    //
    // Every logo.category contains only ONE value:
    //
    // ["American Football"]
    // ["Archery"]
    // ["Dairy"]
    // -------------------------------------------------------

    const subCategoryCount = {};

    for (const logo of logos) {
      const category = Array.isArray(logo.category)
        ? logo.category[0]
        : typeof logo.category === "string"
        ? logo.category
        : "";

      if (!category) continue;

      const subCategory = category.trim().toLowerCase();

      // Ignore template
      if (subCategory === "template") continue;

      subCategoryCount[subCategory] =
        (subCategoryCount[subCategory] || 0) + 1;
    }

    // -------------------------------------------------------
    // 2. Get website categories
    // -------------------------------------------------------

    const categories = Array.isArray(website?.categories)
      ? website.categories
      : [];

    // -------------------------------------------------------
    // 3. Group by MAIN category
    //
    // IMPORTANT:
    // Each main category keeps a Set of unique subcategories.
    //
    // Example:
    //
    // Sports & Athletics
    //   American Football
    //   American Football
    //   American Football
    //   Archery
    //   Archery
    //
    // becomes:
    //
    // Sports & Athletics
    //   American Football
    //   Archery
    // -------------------------------------------------------

    const groupedByName = new Map();

    for (const category of categories) {
      const mainName = category?.name?.trim();

      if (!mainName) continue;

      const mainKey = mainName.toLowerCase();

      if (!groupedByName.has(mainKey)) {
        groupedByName.set(mainKey, {
          name: mainName,

          // Store ONLY UNIQUE subcategories
          subcategories: new Set(),

          // Store unique images
          images: [],
          seenImages: new Set(),
        });
      }

      const group = groupedByName.get(mainKey);

      // ---------------------------------------------------
      // Add subcategory to Set.
      //
      // Set automatically removes duplicates.
      // ---------------------------------------------------

      const subName = category?.subname?.trim();

      if (subName) {
        const subKey = subName.toLowerCase();

        // Ignore template
        if (subKey !== "template") {
          group.subcategories.add(subKey);
        }
      }

      // ---------------------------------------------------
      // Collect unique image URLs
      // ---------------------------------------------------

      const urls = Array.isArray(category?.url)
        ? category.url
        : typeof category?.url === "string"
        ? [category.url]
        : [];

      for (const urlValue of urls) {
        const url =
          typeof urlValue === "string" ? urlValue.trim() : "";

        if (url && !group.seenImages.has(url)) {
          group.seenImages.add(url);
          group.images.push(url);
        }
      }
    }

    // -------------------------------------------------------
    // 4. Calculate logo count for each MAIN category
    //
    // For every UNIQUE subcategory belonging to the main
    // category, get its logo count and add it.
    // -------------------------------------------------------

    const formatted = Array.from(groupedByName.values()).map(
      ({ name, subcategories, images }) => {
        let count = 0;

        for (const subCategory of subcategories) {
          count += subCategoryCount[subCategory] || 0;
        }

        return {
          name,
          count,
          images,
        };
      }
    );

    // -------------------------------------------------------
    // 5. Return response
    // -------------------------------------------------------

    return NextResponse.json({
      categories: formatted,
    });
  } catch (error) {
    console.error(error);

    return NextResponse.json(
      {
        error: "Something went wrong",
      },
      {
        status: 500,
      }
    );
  }
}

