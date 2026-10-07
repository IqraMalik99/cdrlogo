import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "../../auth/[...nextauth]/route"; // adjust path
import { prisma } from "../../../lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({ where: { email: session.user.email } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Saare logos: koi owner filter nahi, koi publishStatus filter nahi
  const logos = await prisma.logo.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      logoName: true,
      slug: true,
      webpUrl: true,
      category: true,
      createdAt: true,
      publishStatus: true, // UI me Draft / Published / Needs Review dikhane ke liye
    },
  });

  return NextResponse.json({ logos });
}