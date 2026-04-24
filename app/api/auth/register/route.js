import { prisma } from "../../../lib/prisma";
import { NextResponse } from "next/server";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { sendVerificationEmail } from "../../../lib/mailer";

export async function POST(req) {
  try {
    const { name, email, password } = await req.json();

    // 1️⃣ Validation
    if (!name || !email || !password) {

      await prisma.log.create({
        data: {
          who: `api:register`,
          content: `Validation failed - missing fields. Email: ${email || "unknown"}`,
        },
      });

      return NextResponse.json(
        { status: false, message: "All fields are required" },
        { status: 400 }
      );
    }

    if (password.length < 6) {

      await prisma.log.create({
        data: {
          who: `api:register`,
          content: `Weak password attempt. Email: ${email}`,
        },
      });

      return NextResponse.json(
        { status: false, message: "Password must be at least 6 characters" },
        { status: 400 }
      );
    }

    // 2️⃣ Check existing user
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {

      await prisma.log.create({
        data: {
          who: `user:${email}`,
          content: `Registration blocked - email already exists`,
        },
      });

      return NextResponse.json(
        { status: false, message: "Email already registered" },
        { status: 409 }
      );
    }

    // 3️⃣ Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4️⃣ Generate verification token
    const verificationToken = uuidv4();

    // 5️⃣ Create user
    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        type: "guest",
        downloadCountUsed: 0,
        downloadLimit: 5,
        isVerified: false,
        verificationToken,
      },
    });

    // 🔥 LOG USER CREATED
    await prisma.log.create({
      data: {
        who: `user:${email}`,
        content: `User registered successfully. Name: ${name}, Email: ${email}`,
      },
    });

    // 6️⃣ Send verification email
    await sendVerificationEmail(email, verificationToken);

    // 📧 LOG EMAIL SENT
    await prisma.log.create({
      data: {
        who: `service:mailer`,
        content: `Verification email sent to ${email}`,
      },
    });

    return NextResponse.json(
      {
        status: true,
        message: "Account created. Please verify your email.",
      },
      { status: 201 }
    );

  } catch (error) {
    console.error("REGISTER ERROR:", error);

    // ❌ LOG ERROR
    await prisma.log.create({
      data: {
        who: `api:register`,
        content: `Server error: ${error?.message}`,
      },
    });

    return NextResponse.json(
      { status: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}