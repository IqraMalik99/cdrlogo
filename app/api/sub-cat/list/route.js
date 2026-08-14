import { prisma } from "../../../lib/prisma";

function slugify(str = "") {
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/^\/+/, "")            // strip leading slash if present
    .replace(/[^a-z0-9\s-]/g, "")   // drop special characters
    .replace(/\s+/g, "-")           // spaces -> hyphens
    .replace(/-+/g, "-")            // collapse multiple hyphens
    .replace(/^-+|-+$/g, "");       // trim leading/trailing hyphens
}

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const letterParam = (searchParams.get("letter") || "all").trim();
    const search = (searchParams.get("search") || "").trim();
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "60", 10) || 60));

    const published = { in: ["published", "Published"] };

    // ── 1. Pull only the `category` array field for every published logo ───
    //    `category` is a String[] with (typically) a single item, but we
    //    don't assume that — we flatten whatever length it is.
    const logos = await prisma.logo.findMany({
      where: {
        publishStatus: published,
        category: { isEmpty: false },
      },
      select: { category: true },
    });

    console.log(`[category/list] scanned ${logos.length} logos with a category`);

    // ── 2. Flatten + case-insensitive merge ─────────────────────────────
    //    "Fashion", "fashion", "FASHION" all fold into one entry. The
    //    casing that appears on the most logos becomes the display name.
    const merged = new Map(); // lowercased category -> { variants: Map<casing, count>, total }
    for (const logo of logos) {
      const cats = Array.isArray(logo.category) ? logo.category : [];
      for (const c of cats) {
        const raw = (c || "").trim();
        if (!raw) continue;
        const key = raw.toLowerCase();

        if (!merged.has(key)) merged.set(key, { variants: new Map(), total: 0 });
        const entry = merged.get(key);
        entry.total += 1;
        entry.variants.set(raw, (entry.variants.get(raw) || 0) + 1);
      }
    }

    let allBrands = [...merged.values()].map((entry) => {
      let bestName = "";
      let bestCount = -1;
      for (const [variant, c] of entry.variants) {
        if (c > bestCount) { bestName = variant; bestCount = c; }
      }
      return {
        name: bestName,
        slug: slugify(bestName),
        logoCount: entry.total,
      };
    });

    allBrands.sort((a, b) => a.name.localeCompare(b.name));

    console.log(
      `[category/list] merged into ${allBrands.length} unique (case-insensitive) categories`
    );

    // ── 3. Which letters actually have categories — used to render nav dots ─
    const lettersWithDataSet = new Set();
    allBrands.forEach((b) => {
      const first = b.name.charAt(0).toUpperCase();
      lettersWithDataSet.add(/[0-9]/.test(first) ? "0-9" : first);
    });

    // ── 4. Filter: search (global, ignores letter) OR letter bucket ────────
    let filtered = allBrands;
    if (search) {
      const q = search.toLowerCase();
      filtered = allBrands.filter((b) => b.name.toLowerCase().includes(q));
      console.log(`[category/list] search="${search}" matched ${filtered.length}`);
    } else if (letterParam.toLowerCase() !== "all") {
      filtered = allBrands.filter((b) => {
        const first = b.name.charAt(0).toUpperCase();
        if (letterParam === "0-9") return /[0-9]/.test(first);
        return first === letterParam.toUpperCase();
      });
      console.log(`[category/list] letter="${letterParam}" matched ${filtered.length}`);
    }

    // ── 5. Paginate ──────────────────────────────────────────────────────
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    console.log(
      `[category/list] page ${safePage}/${totalPages} → returning ${pageItems.length}/${total}`
    );

    // NOTE: response keys are intentionally kept identical to brand/list
    // (brands, totalUniqueBrands, lettersWithData) so the existing frontend
    // component can consume this endpoint without any changes.
    return Response.json({
      success: true,
      brands: pageItems,
      page: safePage,
      limit,
      total,
      totalPages,
      totalUniqueBrands: allBrands.length,
      lettersWithData: [...lettersWithDataSet],
    });
  } catch (err) {
    console.error("[category/list] ✗ ERROR:", err);
    return Response.json(
      { success: false, error: "Server error", message: err.message },
      { status: 500 }
    );
  }
}