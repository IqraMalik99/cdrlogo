// app/api/admin/dashboard/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";



export async function GET() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // ── Run all queries in parallel ──────────────────────────────────────
    const [
      totalLogos,
      logosLastWeek,
      logosPrevWeek,

      totalDownloads,
      downloadsLastWeek,
      downloadsPrevWeek,

      totalUsers,
      usersLastWeek,
      usersPrevWeek,

      recentLogs,
    ] = await Promise.all([
      // Total logos (published)
      prisma.logo.count({ where: { publishStatus: "Published" } }),

      // Logos added this week
      prisma.logo.count({
        where: { createdAt: { gte: weekAgo } },
      }),

      // Logos added previous week (for change %)
      prisma.logo.count({
        where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),

      // Total downloads (sum of downloadedNumberByPeople)
      prisma.logo.aggregate({ _sum: { downloadedNumberByPeople: true } }),

      // Downloads this week — we approximate using logos updated this week
      // For accurate weekly downloads you'd need a Download event table.
      // This is a best-effort aggregate from logo records.
      prisma.logo.aggregate({
        where: { updatedAt: { gte: weekAgo } },
        _sum: { downloadedNumberByPeople: true },
      }),

      prisma.logo.aggregate({
        where: { updatedAt: { gte: twoWeeksAgo, lt: weekAgo } },
        _sum: { downloadedNumberByPeople: true },
      }),

      // Total registered (non-guest) users
      prisma.user.count({ where: { type: "logged" } }),

      // New users this week
      prisma.user.count({
        where: { type: "logged", createdAt: { gte: weekAgo } },
      }),

      // New users previous week
      prisma.user.count({
        where: { type: "logged", createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),

      // Recent activity logs (latest 8)
      prisma.log.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
    ]);

    // ── Helper: pct change ───────────────────────────────────────────────
    const pct = (curr, prev) => {
      if (!prev) return curr > 0 ? 100 : 0;
      return Math.round(((curr - prev) / prev) * 1000) / 10; // 1 decimal
    };

    // ── Decorate logs with icon + color hints ────────────────────────────
    const decorateLog = (log) => {
      const c = log.content.toLowerCase();
      if (c.includes("upload") || c.includes("logo"))
        return { ...log, icon: "upload", color: "#22c55e" };
      if (c.includes("category"))
        return { ...log, icon: "category", color: "#3b82f6" };
      if (c.includes("seo") || c.includes("meta"))
        return { ...log, icon: "seo", color: "#f59e0b" };
      if (c.includes("bulk") || c.includes("import"))
        return { ...log, icon: "bulk", color: "#8b5cf6" };
      if (c.includes("dmca") || c.includes("report") || c.includes("error"))
        return { ...log, icon: "alert", color: "#ef4444" };
      if (c.includes("redirect") || c.includes("page"))
        return { ...log, icon: "redirect", color: "#64748b" };
      return { ...log, icon: "zap", color: "#22c55e" };
    };

    const dlTotal   = totalDownloads._sum.downloadedNumberByPeople ?? 0;
    const dlWeek    = downloadsLastWeek._sum.downloadedNumberByPeople ?? 0;
    const dlPrev    = downloadsPrevWeek._sum.downloadedNumberByPeople ?? 0;

    return NextResponse.json({
      stats: {
        totalLogos,
        totalLogosChange: logosLastWeek,           // absolute count this week
        downloads: dlTotal,
        downloadsChange: pct(dlWeek, dlPrev),      // % change
        activeUsers: totalUsers,
        activeUsersChange: pct(usersLastWeek, usersPrevWeek),
        // Page views — wire up your analytics SDK here if needed
        pageViews: null,
        pageViewsChange: null,
      },
      logs: recentLogs.map(decorateLog),
    });
  } catch (err) {
    console.error("[dashboard/GET]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}