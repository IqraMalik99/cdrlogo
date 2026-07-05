import { prisma } from "../../../lib/prisma";

export async function POST(req) {
  try {
    const body = await req.json();
    const { page = 1, limit = 10, search = "" } = body;

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 12);
    const trimmedSearch = String(search || "").trim();

    // DB-level where clause — publishStatus, category, aur (agar search hai)
    // logoName/description pe case-insensitive partial match.
    const where = {
      publishStatus: "Published",
      category: { has: "template" },
      ...(trimmedSearch
        ? {
            OR: [
              { logoName: { contains: trimmedSearch, mode: "insensitive" } },
              { description: { contains: trimmedSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    // Real-time pagination: count aur data dono DB level pe, ek saath
    // (Promise.all), koi in-memory fetch-all-then-slice nahi.
    const [total, logos] = await Promise.all([
      prisma.logo.count({ where }),
      prisma.logo.findMany({
        where,
        select: {
          id: true,
          slug: true,
          logoName: true,
          category: true,
          description: true,
          brandColors: true,
          webpUrl: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
    ]);

    return Response.json({
      logos,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum) || 1,
    });
  } catch (err) {
    console.error("💥 ERROR:", err);
    return Response.json(
      { message: "Internal Server Error", error: err.message },
      { status: 500 }
    );
  }
}