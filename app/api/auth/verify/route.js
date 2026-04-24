import { prisma } from "../../../lib/prisma";
import { NextResponse } from "next/server";

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get("token");

    console.log("VERIFY TOKEN:", token);

    if (!token) {
      await prisma.log.create({
        data: {
          who: `api:verify-email`,
          content: `Invalid token received`,
        },
      });

      return NextResponse.json(
        { status: false, message: "Invalid token" },
        { status: 400 }
      );
    }

    // ✅ FIX: use findFirst
    const user = await prisma.user.findFirst({
      where: { verificationToken: token },
    });

    if (!user) {
      await prisma.log.create({
        data: {
          who: `api:verify-email`,
          content: `Token not found or expired`,
        },
      });

      return NextResponse.json(
        { status: false, message: "Invalid or expired token" },
        { status: 400 }
      );
    }

    if (user.isVerified) {
      await prisma.log.create({
        data: {
          who: `user:${user.email}`,
          content: `Email verification attempted but already verified`,
        },
      });

      return NextResponse.json({
        status: false,
        message: "Email already verified",
      });
    }

    // ✅ Verify user
    await prisma.user.update({
      where: { id: user.id },
      data: {
        isVerified: true,
        verificationToken: null,
        type: "logged",
      },
    });

    await prisma.log.create({
      data: {
        who: `user:${user.email}`,
        content: `Email verified successfully for ${user.email}`,
      },
    });

    return NextResponse.json({
      status: true,
      message: "Email verified successfully",
    });

  } catch (error) {
    console.error("VERIFY ERROR:", error);

    // ❌ FIXED LOG (removed wrong user usage)
    await prisma.log.create({
      data: {
        who: `api:verify-email`,
        content: `Server error during email verification: ${error?.message}`,
      },
    });

    return NextResponse.json(
      { status: false, message: "Server error" },
      { status: 500 }
    );
  }
}