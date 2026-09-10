#!/usr/bin/env node
/**
 * One-time backfill: moves every PatientPhoto.dataUrl and
 * ConsentForm.signatureDataUrl that's still a raw base64 data URL into
 * Cloudflare R2, then overwrites the column with the proxy URL
 * (/api/photos/...) that lib/db/patientPhotos.ts and lib/db/consentForms.ts
 * now write for new rows going forward — see those files, and lib/r2.ts.
 *
 * Safe to run more than once — skips any row whose column already points
 * at /api/photos/ instead of holding a data: URL.
 *
 * Usage:
 *   node scripts/migratePhotosToR2.mjs
 *
 * Requires .env.local to have DATABASE_URL and the R2_* values filled in.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;

function decodeDataUrl(dataUrl) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  const [, contentType, base64] = match;
  return { buffer: Buffer.from(base64, "base64"), contentType };
}

function extensionFor(contentType) {
  if (contentType === "image/png") return "png";
  if (contentType === "image/jpeg" || contentType === "image/jpg") return "jpg";
  if (contentType === "image/webp") return "webp";
  return "bin";
}

async function main() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_BUCKET_NAME) {
    console.error("Missing R2_* values in .env.local");
    process.exit(1);
  }

  const prisma = createPrismaClient();

  const photos = await prisma.patientPhoto.findMany({
    where: { dataUrl: { startsWith: "data:" } },
    select: { id: true, clinicId: true, patientId: true, dataUrl: true },
  });
  let photosMigrated = 0;
  for (const photo of photos) {
    const decoded = decodeDataUrl(photo.dataUrl);
    if (!decoded) continue;
    const id = randomUUID();
    const key = `patients/${photo.clinicId}/${photo.patientId}/${id}.${extensionFor(decoded.contentType)}`;
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: decoded.buffer, ContentType: decoded.contentType }));
    await prisma.patientPhoto.update({ where: { id: photo.id }, data: { dataUrl: `/api/photos/${key}` } });
    photosMigrated++;
  }

  const forms = await prisma.consentForm.findMany({
    where: { signatureDataUrl: { startsWith: "data:" } },
    select: { id: true, clinicId: true, signatureDataUrl: true },
  });
  let formsMigrated = 0;
  for (const form of forms) {
    const decoded = decodeDataUrl(form.signatureDataUrl);
    if (!decoded) continue;
    const id = randomUUID();
    const key = `consent-forms/${form.clinicId}/${id}.${extensionFor(decoded.contentType)}`;
    await r2.send(new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: decoded.buffer, ContentType: decoded.contentType }));
    await prisma.consentForm.update({ where: { id: form.id }, data: { signatureDataUrl: `/api/photos/${key}` } });
    formsMigrated++;
  }

  console.log(`Migrated ${photosMigrated}/${photos.length} patient photos and ${formsMigrated}/${forms.length} consent signatures to R2.`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
