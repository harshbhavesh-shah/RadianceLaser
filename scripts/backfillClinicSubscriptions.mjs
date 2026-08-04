#!/usr/bin/env node
/**
 * One-time backfill: marks every existing clinic (created before the
 * trial/subscription system existed) as subscriptionStatus "active" —
 * grandfathered in, NOT retroactively put on a trial clock that could lock
 * out a clinic that's already using the product day to day. New clinics
 * created via scripts/createClinic.mjs from now on start as "trialing"
 * instead (see lib/subscription.ts).
 *
 * Safe to run more than once — only touches clinics missing
 * subscriptionStatus.
 *
 * Usage:
 *   node scripts/backfillClinicSubscriptions.mjs
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const TRIAL_LENGTH_DAYS = 365;

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

  const snap = await db.collection("clinics").get();
  let updated = 0;
  const batch = db.batch();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.subscriptionStatus) continue; // already has the field, leave it alone

    batch.update(doc.ref, {
      subscriptionStatus: "active",
      trialEndsAt: (data.createdAt || Date.now()) + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000,
    });
    updated++;
  }

  if (updated > 0) await batch.commit();
  console.log(`Scanned ${snap.size} clinics, grandfathered ${updated} as "active".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
