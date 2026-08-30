#!/usr/bin/env node
/**
 * One-time backfill: copies every existing Firestore clinics/{id} doc into
 * the Postgres clinics table (see prisma/schema.prisma, lib/db/clinics.ts)
 * that chunk 11 of the Firestore → Postgres migration introduced. Every
 * clinic-scoped table (Patient, Visit, ... StaffMember) already stores
 * clinicId as a plain string, and Firebase Auth custom claims already
 * carry a clinicId value too — so this preserves each clinic's existing id
 * exactly rather than letting Postgres generate a new one, which is the
 * whole point: nothing else in the system has to change for a clinic that
 * existed before this script ran.
 *
 * Unlike the Patient/Visit/Package/etc. chunks (which deliberately started
 * empty — years of clinical history, correctly left as a separate,
 * intentional decision), Clinic itself is a single small record every
 * other feature quietly depends on: without a matching Postgres row,
 * Settings profile edits fail, the super-admin panel's clinic list comes
 * back empty, and access-extension actions report "not found" — not
 * data some workflow happens to need, but the tenant record the app is
 * built around. Hence a real (if tiny) backfill here, where every earlier
 * chunk had none.
 *
 * Safe to run more than once — skips any Firestore clinic whose id already
 * has a Postgres row.
 *
 * Usage:
 *   node scripts/backfillClinicsToPostgres.mjs
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* and
 * DATABASE_URL values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Same driver-adapter setup as lib/db/client.ts, duplicated here since this
// is a plain Node script — see scripts/createClinic.mjs for the same
// pattern.
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* values in .env.local");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();
  const prisma = createPrismaClient();

  const snap = await db.collection("clinics").get();
  let created = 0;
  let skipped = 0;

  for (const doc of snap.docs) {
    const data = doc.data();

    const existing = await prisma.clinic.findUnique({ where: { id: doc.id }, select: { id: true } });
    if (existing) {
      skipped++;
      continue;
    }

    await prisma.clinic.create({
      data: {
        id: doc.id,
        name: data.name || "Unnamed Clinic",
        address: data.address || null,
        statsWindow: data.statsWindow || null,
        subscriptionStatus: data.subscriptionStatus || "active",
        trialEndsAt: data.trialEndsAt ?? Date.now(),
        subscriptionRenewsAt: data.subscriptionRenewsAt ?? null,
        createdAt: data.createdAt ?? Date.now(),
      },
    });
    console.log(`✓ Created Postgres row for "${data.name}" (id: ${doc.id})`);
    created++;
  }

  console.log(`\nScanned ${snap.size} Firestore clinic doc(s): created ${created}, skipped ${skipped} (already present).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
