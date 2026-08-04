#!/usr/bin/env node
/**
 * One-time backfill: sets phoneNormalized and nameLower on every existing
 * patient document that predates those fields (see types/index.ts
 * Patient.phoneNormalized / Patient.nameLower). Without this,
 * findPatientByPhone's and searchPatients' indexed queries
 * (lib/firestore/patients.ts) would silently miss any patient created
 * before this change, since a Firestore query never matches a document
 * missing the field it's querying on.
 *
 * Safe to run more than once — it only writes docs whose stored values
 * don't already match.
 *
 * Usage:
 *   node scripts/backfillPatientSearchFields.mjs
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

function normalizePhone(phone) {
  return (phone || "").replace(/\D/g, "");
}

async function main() {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* values in .env.local");
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const db = getFirestore();

  const snap = await db.collection("patients").get();
  let updated = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    const correctPhone = normalizePhone(data.phone);
    const correctNameLower = (data.name || "").toLowerCase();
    if (data.phoneNormalized === correctPhone && data.nameLower === correctNameLower) continue;

    batch.update(doc.ref, { phoneNormalized: correctPhone, nameLower: correctNameLower });
    opsInBatch++;
    updated++;

    // Firestore caps a batch at 500 writes.
    if (opsInBatch === 500) {
      await batch.commit();
      batch = db.batch();
      opsInBatch = 0;
    }
  }

  if (opsInBatch > 0) await batch.commit();

  console.log(`Scanned ${snap.size} patients, backfilled search fields on ${updated}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
