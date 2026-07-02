import { NextResponse } from "next/server";
import AdmZip from "adm-zip";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "../../../../../lib/r2";

export async function POST(req) {
  try {
    const { key } = await req.json();
    if (!key) return NextResponse.json({ error: "No key provided." }, { status: 400 });

    const obj = await r2.send(new GetObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    const wrapperBuffer = Buffer.from(await obj.Body.transformToByteArray());
    const wrapperZip = new AdmZip(wrapperBuffer);
    const allEntries = wrapperZip.getEntries();

    const folderSet = new Set();
    for (const entry of allEntries) {
      if (entry.isDirectory) continue;
      const parts = entry.entryName.split("/").filter(Boolean);
      if (parts.length < 2) continue;
      const topFolder = parts[0];
      if (topFolder.startsWith("__MACOSX") || topFolder.startsWith(".")) continue;
      folderSet.add(topFolder);
    }

    const folders = Array.from(folderSet);
    console.log(`[list] Found ${folders.length} folders:`, folders);

    return NextResponse.json({ folders });
  } catch (err) {
    console.error("[list] Error:", err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}