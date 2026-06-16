import { PutObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./r2";

export async function uploadToR2({ fileBuffer, fileName, mimeType }) {
  const bucket = process.env.R2_BUCKET_NAME;

  await r2.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: fileBuffer,
      ContentType: mimeType,
      CacheControl: "public, max-age=31536000"
    })
  );

  return `${process.env.R2_ENDPOINT}/${fileName}`;
}