// app/api/contact/route.js
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "../../lib/prisma"; // your Prisma client instance


const ADMIN_EMAIL = "im4356927@gmail.com";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,   // im3966041@gmail.com
    pass: process.env.EMAIL_PASS,   // your Gmail App Password
  },
});

export async function POST(req) {
  try {
    const body = await req.json();
    const { name, email, subject, message } = body;

    if (!name?.trim() || !email?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "Name, email, and message are required." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address." }, { status: 400 });
    }

    // ── 1. Save to DB ──────────────────────────────────────────────────────────
    const record = await prisma.contactMessage.create({
      data: {
        name: name.trim(),
        email: email.trim(),
        subject: subject?.trim() || null,
        message: message.trim(),
        status: "unread",
      },
    });

    // ── 2. Email to admin ──────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"CDRLogo Contact" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      replyTo: email.trim(),
      subject: `[Contact] ${subject?.trim() || "New message"} — from ${name}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;background:#09090f;color:#e5e5f0;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#a78bfa;">New Contact Message</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#888;width:100px;">From</td><td style="padding:6px 0;font-weight:600;">${name}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Email</td><td style="padding:6px 0;"><a href="mailto:${email}" style="color:#a78bfa;">${email}</a></td></tr>
            <tr><td style="padding:6px 0;color:#888;">Subject</td><td style="padding:6px 0;">${subject || "—"}</td></tr>
          </table>
          <div style="margin-top:16px;padding:14px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid #7c3aed;">
            <p style="margin:0;line-height:1.6;color:#ccc;">${message.replace(/\n/g, "<br/>")}</p>
          </div>
          <p style="margin-top:16px;font-size:12px;color:#555;">Message ID: ${record.id}</p>
        </div>
      `,
    });

    // ── 3. Auto-reply to sender ────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"CDRLogo" <${process.env.EMAIL_USER}>`,
      to: email.trim(),
      subject: "We got your message — CDRLogo",
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#09090f;color:#e5e5f0;border-radius:12px;">
          <h2 style="margin:0 0 10px;color:#a78bfa;">Thanks for reaching out, ${name}!</h2>
          <p style="color:#aaa;margin-bottom:16px;line-height:1.6;">We've received your message and will get back to you as soon as possible.</p>
          <div style="padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;border-left:3px solid #7c3aed;">
            <p style="margin:0;color:#888;font-size:12px;">Your message:</p>
            <p style="margin:6px 0 0;color:#ccc;line-height:1.6;">${message.replace(/\n/g, "<br/>")}</p>
          </div>
          <p style="margin-top:20px;font-size:12px;color:#555;">— CDRLogo Team</p>
        </div>
      `,
    });

    return NextResponse.json({ success: true, id: record.id });
  } catch (err) {
    console.error("[contact API]", err);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 }
    );
  }
}