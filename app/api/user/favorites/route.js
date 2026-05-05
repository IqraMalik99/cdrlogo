// app/api/user/favorites/route.js

import { prisma } from "../../../lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route";

/**
 * GET /api/user/favorites
 * Returns the logged-in user's favorited logos (lightweight fields only).
 */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return Response.json(
        { error: "Login required" },
        { status: 401 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        downloadCountUsed: true,
        downloadLimit: true,
        role: true,
        favorites: {
          select: {
            id: true,
            logoName: true,
            slug: true,
            category: true,
            webpUrl: true,
            brand: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json({
      favorites: user.favorites,
      downloadCountUsed: user.downloadCountUsed,
      downloadLimit: user.downloadLimit,
      role: user.role,
    });
  } catch (err) {
    console.error("[user/favorites]", err);
    return Response.json({ error: "Server error" }, { status: 500 });
  }
}