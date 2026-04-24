import { prisma } from "../../../lib/prisma";

// GET — paginated users list
export async function POST(req) {
  try {
    const body   = await req.json();
    const page   = Number(body.page)  || 1;
    const limit  = Number(body.limit) || 10;
    const skip   = (page - 1) * limit;
    const search = body.search ?? "";
    const role   = body.role   ?? "";

    const where = {
      ...(search && {
        OR: [
          { name:  { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }),
      ...(role && { role: { equals: role } }),
    };

   const [users, total] = await Promise.all([
  prisma.user.findMany({
    where,
    skip,
    take: limit,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      type: true,
      downloadCountUsed: true,
      downloadLimit: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  }),
  prisma.user.count({ where }),
]);
    return Response.json({
      success: true, page,
      totalPages: Math.ceil(total / limit),
      totalUsers: total,
      data: users,
    });

  } catch (error) {
    console.error("[Users API] POST error:", error);
    return Response.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

// DELETE — delete user by id
export async function DELETE(req) {
  try {
    const body = await req.json();
    const { id } = body;

    if (!id) {
      console.warn("[Users API] DELETE ❌ Missing user ID");
      return Response.json({ error: "User ID is required" }, { status: 400 });
    }

    console.log(`[Users API] 🔍 Looking up user id: ${id}`);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      console.warn(`[Users API] ❌ User not found: ${id}`);
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    console.log(`[Users API] ✅ Found user: ${user.email}`);

    await prisma.user.delete({ where: { id } });

    console.log(`[Users API] ✅ Deleted user: ${user.email} (${id})`);
    return Response.json({ success: true });

  } catch (error) {
    console.error("[Users API] DELETE 💥 error:", { message: error.message, stack: error.stack });
    return Response.json({ error: "Failed to delete user" }, { status: 500 });
  }
}