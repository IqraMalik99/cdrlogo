// app/api/admin/contact-messages/route.js
import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import nodemailer from "nodemailer";

export const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// GET — list all or filter by status
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status"); // pending | replied

    const messages = await prisma.contactMessage.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: messages });
  } catch (err) {
    console.error("[contact-messages GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — send reply (also updates status to replied)
// Body: { id, adminReply }
export async function PATCH(req) {
  try {
    const { id, adminReply } = await req.json();

    if (!id)         return NextResponse.json({ error: "id is required" },         { status: 400 });
    if (!adminReply?.trim()) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });

    const message = await prisma.contactMessage.findUnique({ where: { id } });
    if (!message) return NextResponse.json({ error: "Message not found" }, { status: 404 });

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: message.email,
      subject: `Re: ${message.subject || "Your message"}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <p>Hi ${message.name},</p>
          <p>${adminReply.replace(/\n/g, "<br/>")}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#888;font-size:12px">
            <strong>Your original message:</strong><br/>
            ${message.message.replace(/\n/g, "<br/>")}
          </p>
        </div>
      `,
    });

    // Update DB
    const updated = await prisma.contactMessage.update({
      where: { id },
      data: { adminReply, status: "replied" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[contact-messages PATCH]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}