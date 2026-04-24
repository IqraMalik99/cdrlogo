// app/api/request-logo/route.js
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { prisma } from "../../lib/prisma";



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
    const { brandName, websiteUrl, category, formats, notes, email } = body;

    if (!brandName?.trim()) {
      return NextResponse.json(
        { error: "Brand / Company name is required." },
        { status: 400 }
      );
    }

    // ── 1. Save to DB ──────────────────────────────────────────────────────────
    const record = await prisma.logoRequest.create({
      data: {
        brandName: brandName.trim(),
        websiteUrl: websiteUrl?.trim() || null,
        category: category || null,
        formats: formats || [],
        notes: notes?.trim() || null,
        requesterEmail: email?.trim() || null,
        status: "pending",
      },
    });

    // ── 2. Email to admin ──────────────────────────────────────────────────────
    await transporter.sendMail({
      from: `"CDRLogo Requests" <${process.env.EMAIL_USER}>`,
      to: ADMIN_EMAIL,
      subject: `[Logo Request] ${brandName}`,
      html: `
        <div style="font-family:sans-serif;max-width:560px;margin:auto;padding:24px;background:#09090f;color:#e5e5f0;border-radius:12px;">
          <h2 style="margin:0 0 16px;color:#a78bfa;">New Logo Request</h2>
          <table style="width:100%;border-collapse:collapse;">
            <tr><td style="padding:6px 0;color:#888;width:140px;">Brand / Company</td><td style="padding:6px 0;font-weight:600;">${brandName}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Website URL</td><td style="padding:6px 0;">${websiteUrl || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Category</td><td style="padding:6px 0;">${category || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Formats</td><td style="padding:6px 0;">${formats?.length ? formats.join(", ") : "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Notes</td><td style="padding:6px 0;">${notes || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Requester Email</td><td style="padding:6px 0;">${email || "—"}</td></tr>
            <tr><td style="padding:6px 0;color:#888;">Request ID</td><td style="padding:6px 0;font-size:11px;color:#666;">${record.id}</td></tr>
          </table>
          <p style="margin-top:20px;font-size:12px;color:#555;">Submitted via CDRLogo website.</p>
        </div>
      `,
    });

    // ── 3. Confirmation to requester (if email provided) ───────────────────────
    if (email?.trim()) {
      await transporter.sendMail({
        from: `"CDRLogo" <${process.env.EMAIL_USER}>`,
        to: email.trim(),
        subject: `We received your logo request for ${brandName}`,
        html: `
          <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;background:#09090f;color:#e5e5f0;border-radius:12px;">
            <h2 style="margin:0 0 10px;color:#a78bfa;">Request Received!</h2>
            <p style="color:#aaa;margin-bottom:16px;">Thanks for submitting a logo request. We'll review it and add it to our collection soon.</p>
            <p style="color:#ccc;">You requested: <strong style="color:#fff;">${brandName}</strong></p>
            <p style="margin-top:20px;font-size:12px;color:#555;">— CDRLogo Team</p>
          </div>
        `,
      });
    }

    return NextResponse.json({ success: true, id: record.id });
  } catch (err) {
    console.error("[request-logo API]", err);
    return NextResponse.json(
      { error: "Server error. Please try again later." },
      { status: 500 }
    );
  }
}