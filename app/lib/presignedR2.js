// lib/uploadToR2.js
import {
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { r2 } from "./r2";

const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];

export function isAllowedImageType(type) {
  return ALLOWED_TYPES.includes(type);
}

// Generates a short-lived URL the browser can PUT the file to directly.
export async function getPresignedUploadUrl({ key, contentType }) {
  const bucket = process.env.R2_BUCKET_NAME;
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(r2, command, { expiresIn: 300 }); // 5 minutes
}

export async function deleteFromR2(key) {
  const bucket = process.env.R2_BUCKET_NAME;
  await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

async function listAllKeys(prefix) {
  const bucket = process.env.R2_BUCKET_NAME;
  let keys = [];
  let ContinuationToken;

  do {
    const res = await r2.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken })
    );
    keys.push(...(res.Contents || []).map(o => o.Key));
    ContinuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return keys;
}

export async function renameR2Folder(oldPrefix, newPrefix) {
  const bucket = process.env.R2_BUCKET_NAME;
  const keys = await listAllKeys(oldPrefix);
  const renamed = [];

  for (const oldKey of keys) {
    const newKey = oldKey.replace(oldPrefix, newPrefix);
    await r2.send(
      new CopyObjectCommand({
        Bucket: bucket,
        CopySource: `${bucket}/${encodeURIComponent(oldKey)}`,
        Key: newKey,
      })
    );
    renamed.push({ oldKey, newKey });
  }

  if (keys.length) {
    await r2.send(
      new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })) } })
    );
  }

  return renamed;
}

export async function deleteR2Folder(prefix) {
  const bucket = process.env.R2_BUCKET_NAME;
  const keys = await listAllKeys(prefix);
  if (!keys.length) return;
  await r2.send(
    new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys.map(Key => ({ Key })) } })
  );
}