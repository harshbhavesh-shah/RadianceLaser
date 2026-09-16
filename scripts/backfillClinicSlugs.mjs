#!/usr/bin/env node
/**
 * One-time backfill: generates a public-booking subdomain slug (see
 * lib/clinicSlug.ts) for every clinic that doesn't have one yet — every
 * clinic created before that field existed. Clinics created afterward
 * always get one at creation time (lib/db/clinics.ts's createClinic),
 * so this only ever needs re-running if a fresh clinic somehow slips
 * through without one.
 *
 * Usage:
 *   node scripts/backfillClinicSlugs.mjs
 *
 * Requires .env.local to be filled in with DATABASE_URL.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

// Kept in sync with lib/clinicSlug.ts by hand (same reasoning as every
// other duplicated constant/helper in scripts/ — this is a plain Node
// script, not compiled through Next's TypeScript/path-alias setup).
const RESERVED_SLUGS = new Set([
  "www", "app", "api", "admin", "mail", "ftp", "blog", "docs", "help",
  "support", "status", "book", "booking", "static", "assets", "cdn",
]);

function slugifyClinicName(name) {
  const base = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "clinic";
}

async function generateUniqueClinicSlug(prisma, name) {
  const base = slugifyClinicName(name);
  let candidate = base;
  let suffix = 2;
  for (;;) {
    if (!RESERVED_SLUGS.has(candidate)) {
      const existing = await prisma.clinic.findUnique({ where: { slug: candidate }, select: { id: true } });
      if (!existing) return candidate;
    }
    candidate = `${base}-${suffix}`;
    suffix++;
  }
}

async function main() {
  const prisma = createPrismaClient();

  const clinics = await prisma.clinic.findMany({ where: { slug: null }, select: { id: true, name: true } });
  console.log(`Found ${clinics.length} clinic(s) with no slug.`);

  for (const clinic of clinics) {
    const slug = await generateUniqueClinicSlug(prisma, clinic.name);
    await prisma.clinic.update({ where: { id: clinic.id }, data: { slug } });
    console.log(`✓ ${clinic.name} → ${slug}`);
  }

  console.log("\nDone.");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed to backfill clinic slugs:", err);
  process.exit(1);
});
