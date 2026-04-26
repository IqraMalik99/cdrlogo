// app/api/admin/logo-requests/route.js
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

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const requests = await prisma.logoRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    console.error("[logo-requests GET]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH — send reply email + update status to replied
// Body: { id, adminNotes }
export async function PATCH(req) {
  try {
    const { id, adminNotes } = await req.json();

    if (!id)               return NextResponse.json({ error: "id is required" },         { status: 400 });
    if (!adminNotes?.trim()) return NextResponse.json({ error: "Reply cannot be empty" }, { status: 400 });

    const request = await prisma.logoRequest.findUnique({ where: { id } });
    if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });

    if (!request.requesterEmail) {
      return NextResponse.json({ error: "No email address on this request" }, { status: 400 });
    }

    const formats = (() => {
      try { return Array.isArray(request.formats) ? request.formats : JSON.parse(request.formats || "[]"); }
      catch { return []; }
    })();

    // Send email
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: request.requesterEmail,
      subject: `Re: Logo Request — ${request.brandName}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
          <p>Hi there,</p>
          <p>Thank you for requesting the <strong>${request.brandName}</strong> logo. Here's our update:</p>
          <div style="background:#f9f9f9;border-left:3px solid #22c55e;padding:12px 16px;margin:16px 0;border-radius:4px">
            ${adminNotes.replace(/\n/g, "<br/>")}
          </div>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="color:#888;font-size:12px">
            <strong>Your original request:</strong><br/>
            Brand: ${request.brandName}<br/>
            ${request.websiteUrl ? `Website: ${request.websiteUrl}<br/>` : ""}
            ${request.category   ? `Category: ${request.category}<br/>` : ""}
            ${formats.length     ? `Formats: ${formats.join(", ")}<br/>` : ""}
            ${request.notes      ? `Notes: ${request.notes}` : ""}
          </p>
        </div>
      `,
    });

    const updated = await prisma.logoRequest.update({
      where: { id },
      data: { adminNotes, status: "replied" },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    console.error("[logo-requests PATCH]", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}