// app/api/logo/upload/presign/route.js
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../../../../lib/r2";

export async function POST(req) {
  console.log("\n========== PRESIGN REQUEST START ==========");

  try {
    const body = await req.json();
    console.log("[presign] Request body:", body);

    const { filename } = body;

    if (!filename) {
      console.log("[presign] ❌ No filename provided");
      return NextResponse.json({ error: "No filename provided." }, { status: 400 });
    }

    const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    const key = `bulk-uploads/raw/${Date.now()}-${safe}`;
    console.log("[presign] Generated key:", key);

    console.log("[presign] R2_BUCKET_NAME env:", process.env.R2_BUCKET_NAME);
    console.log("[presign] R2_ACCOUNT_ID env exists:", !!process.env.R2_ACCOUNT_ID);
    console.log("[presign] R2_ACCESS_KEY_ID env exists:", !!process.env.R2_ACCESS_KEY_ID);
    console.log("[presign] R2_SECRET_ACCESS_KEY env exists:", !!process.env.R2_SECRET_ACCESS_KEY);

    const command = new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      ContentType: "application/zip",
    });

    const url = await getSignedUrl(r2, command, { expiresIn: 900 });
    console.log("[presign] ✓ Generated presigned URL:", url);
    console.log("========== PRESIGN REQUEST DONE ==========\n");

    return NextResponse.json({ url, key });

  } catch (err) {
    console.error("[presign] ❌ ERROR:", err.message);
    console.error("[presign] Stack:", err.stack);
    console.log("========== PRESIGN REQUEST FAILED ==========\n");
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}