
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

    // ── 1. Group at the DB level: exact-string brand + count of logos ───────
    //    This is cheap (aggregated in SQL) — no need to pull every logo row.
    const grouped = await prisma.logo.groupBy({
      by: ["brand"],
      where: {
        publishStatus: published,
        brand: { not: null },
      },
      _count: true,
    });

    console.log(`[brand/list] groupBy returned ${grouped.length} distinct exact-string brands`);

    // ── 2. Case-insensitive merge ─────────────────────────────────────────
    //    "Nike", "nike", "NIKE" all fold into one entry. The casing that
    //    appears on the most logos becomes the display name.
    const merged = new Map(); // lowercased brand -> { variants: Map<casing, count>, total }
    for (const g of grouped) {
      const raw = (g.brand || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const count = typeof g._count === "number" ? g._count : g._count?._all || 0;

      if (!merged.has(key)) merged.set(key, { variants: new Map(), total: 0 });
      const entry = merged.get(key);
      entry.total += count;
      entry.variants.set(raw, (entry.variants.get(raw) || 0) + count);
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
      `[brand/list] merged into ${allBrands.length} unique (case-insensitive) brands`
    );

    // ── 3. Which letters actually have brands — used to render nav dots ────
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
      console.log(`[brand/list] search="${search}" matched ${filtered.length}`);
    } else if (letterParam.toLowerCase() !== "all") {
      filtered = allBrands.filter((b) => {
        const first = b.name.charAt(0).toUpperCase();
        if (letterParam === "0-9") return /[0-9]/.test(first);
        return first === letterParam.toUpperCase();
      });
      console.log(`[brand/list] letter="${letterParam}" matched ${filtered.length}`);
    }

    // ── 5. Paginate ──────────────────────────────────────────────────────
    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * limit;
    const pageItems = filtered.slice(start, start + limit);

    console.log(
      `[brand/list] page ${safePage}/${totalPages} → returning ${pageItems.length}/${total}`
    );

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
    console.error("[brand/list] ✗ ERROR:", err);
    return Response.json(
      { success: false, error: "Server error", message: err.message },
      { status: 500 }
    );
  }
}