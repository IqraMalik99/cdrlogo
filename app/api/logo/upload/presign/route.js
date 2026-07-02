// app/api/logo/upload/presign/route.js
import { NextResponse } from "next/server";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "../../../../lib/r2";

export async function POST(req) {
  const { filename } = await req.json();
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");

  // koi folder prefix nahi — seedha root mein
  const key = `${Date.now()}-${safe}`;

  const command = new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ContentType: "application/zip",
  });

  const url = await getSignedUrl(r2, command, { expiresIn: 900 });
  return NextResponse.json({ url, key });
}