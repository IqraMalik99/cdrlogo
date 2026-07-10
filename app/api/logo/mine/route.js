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


  const logos = await prisma.logo.findMany({
    where: { owner: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, logoName: true, slug: true, webpUrl: true,
      category: true, publishStatus: true, createdAt: true,
    },
  });

  return NextResponse.json({ logos });
}