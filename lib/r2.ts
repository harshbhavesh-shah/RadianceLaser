import "server-only";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

// Cloudflare R2 is S3-compatible, so the AWS SDK works against it unchanged
// once pointed at R2's endpoint — no separate R2 SDK needed. Bucket stays
// private; objects are only ever served through app/api/photos/[...key],
// which checks the requesting session's clinicId against the key before
// streaming anything (see that route for why: these are patient photos and
// signed consent signatures, not public assets).
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.R2_BUCKET_NAME!;

export async function uploadToR2(key: string, body: Buffer, contentType: string): Promise<void> {
  await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }));
}

export async function getFromR2(key: string): Promise<{ body: Buffer; contentType: string } | null> {
  try {
    const res = await r2.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    const bytes = await res.Body!.transformToByteArray();
    return { body: Buffer.from(bytes), contentType: res.ContentType || "application/octet-stream" };
  } catch (err) {
    if (err instanceof Error && err.name === "NoSuchKey") return null;
    throw err;
  }
}

export async function deleteFromR2(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}

/** Every object this app stores in R2 is fetched through this proxy route
 * rather than a public/presigned R2 URL, so access stays gated by the
 * viewer's own session (see app/api/photos/[...key]/route.ts). */
export function urlForKey(key: string): string {
  return `/api/photos/${key}`;
}

/** Reverses urlForKey — used when deleting a photo/signature, since the
 * object's R2 key isn't stored as a separate column, only as this URL. */
export function keyFromUrl(url: string): string | null {
  const prefix = "/api/photos/";
  return url.startsWith(prefix) ? url.slice(prefix.length) : null;
}

const DATA_URL_RE = /^data:([^;]+);base64,(.+)$/;

/** Decodes a `data:image/...;base64,...` string (produced client-side by
 * lib/imageCompression.ts or SignaturePad's canvas.toDataURL) into raw
 * bytes for uploading to R2. */
export function decodeDataUrl(dataUrl: string): { buffer: Buffer; contentType: string } {
  const match = DATA_URL_RE.exec(dataUrl);
  if (!match) throw new Error("Not a base64 data URL.");
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

export function extensionFor(contentType: string): string {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "bin";
}
