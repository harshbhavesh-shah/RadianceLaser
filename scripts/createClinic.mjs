#!/usr/bin/env node
/**
 * Bootstraps a new clinic (tenant) and its first user, with the correct
 * Firebase Auth custom claims (clinicId + role) that the whole app relies
 * on for tenant isolation. There's no self-serve signup UI yet, so this is
 * how you create clinic #1, #2, #3... for now.
 *
 * Also creates the user's StaffMember row in Postgres (see
 * app/dashboard/settings/actions.ts, lib/db/staff.ts) so this first owner
 * shows up correctly in their own Settings → Staff list, same as anyone
 * added later from the app itself.
 *
 * Usage:
 *   node scripts/createClinic.mjs \
 *     --clinicName "Advanced Skin Clinic" \
 *     --name "Dr. Bhavesh Shah" \
 *     --email owner@example.com \
 *     --password "some-temporary-password" \
 *     --role owner
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* and
 * DATABASE_URL values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Same driver-adapter setup as lib/db/client.ts, duplicated here since this
// is a plain Node script, not compiled through Next's TypeScript/path-alias
// setup (see the TRIAL_LENGTH_DAYS comment below for the same reasoning).
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

// Keep in sync with TRIAL_LENGTH_DAYS in lib/subscription.ts (duplicated
// here since this is a plain Node script, not compiled through Next's
// TypeScript/path-alias setup).
const TRIAL_LENGTH_DAYS = 30;

// Keep in sync with DEFAULT_AREA_DEFS in scripts/seedAreaDefs.mjs (that
// script's version is the one to edit — this is just re-declared here to
// avoid a cross-script import for what's still a plain Node script).
// See prisma/schema.prisma's AreaDef model for why every new clinic starts
// with its own real rows here instead of falling back to a hardcoded list.
const DEFAULT_AREA_DEFS = {
  qs: [
    { name: "Full Face", defaultDurationMinutes: 30, gstApplicable: true },
    { name: "Cheeks", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Underarms", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Neck", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Hands", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Back", defaultDurationMinutes: 30, gstApplicable: true },
    { name: "Chest", defaultDurationMinutes: 20, gstApplicable: true },
    { name: "Tattoo Removal", defaultDurationMinutes: 20, gstApplicable: true },
    { name: "Full Body", defaultDurationMinutes: 60, gstApplicable: true },
  ],
  lhr: [
    { name: "Upper Lip", defaultDurationMinutes: 10, gstApplicable: true },
    { name: "Chin", defaultDurationMinutes: 10, gstApplicable: true },
    { name: "Full Face", defaultDurationMinutes: 20, gstApplicable: true },
    { name: "Underarms", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Half Arms", defaultDurationMinutes: 20, gstApplicable: true },
    { name: "Full Arms", defaultDurationMinutes: 30, gstApplicable: true },
    { name: "Half Legs", defaultDurationMinutes: 30, gstApplicable: true },
    { name: "Full Legs", defaultDurationMinutes: 45, gstApplicable: true },
    { name: "Bikini Line", defaultDurationMinutes: 15, gstApplicable: true },
    { name: "Back", defaultDurationMinutes: 30, gstApplicable: true },
    { name: "Chest", defaultDurationMinutes: 20, gstApplicable: true },
    { name: "Full Body", defaultDurationMinutes: 90, gstApplicable: true },
  ],
};

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    const value = argv[i + 1];
    if (key) args[key] = value;
  }
  return args;
}

async function main() {
  const { clinicName, email, password, role = "owner", name } = parseArgs();
  const staffName = name || email?.split("@")[0] || "Clinic Owner";

  if (!clinicName || !email || !password) {
    console.error(
      "Usage: node scripts/createClinic.mjs --clinicName \"Name\" --email you@example.com --password \"temp-password\" [--role owner]"
    );
    process.exit(1);
  }

  if (!["owner", "doctor", "reception"].includes(role)) {
    console.error(`Invalid role "${role}". Must be one of: owner, doctor, reception.`);
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error(
      "Missing Firebase Admin credentials in .env.local. See .env.local.example."
    );
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local.");
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();
  const db = getFirestore();
  const prisma = createPrismaClient();

  // 1. Create the clinic. Starts on a free trial — see lib/subscription.ts
  //    getClinicAccess for how trialEndsAt/subscriptionStatus combine into
  //    the actual access decision. The row lives in Postgres (see
  //    lib/db/clinics.ts) — its id is Postgres-generated (@default(cuid())
  //    in prisma/schema.prisma), not a Firestore auto-id, so everything
  //    below uses clinicId from this insert, not a Firestore doc ref.
  //    subscriptionStatus/trialEndsAt also get mirrored into a Firestore
  //    clinics/{id} doc, same as lib/db/clinics.ts's createClinic does —
  //    that mirror is what firestore.rules' clinicIsActive() actually
  //    reads, since Firestore security rules can't query Postgres.
  const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;
  const clinic = await prisma.clinic.create({
    data: { name: clinicName, subscriptionStatus: "trialing", trialEndsAt, createdAt: Date.now() },
  });
  const clinicId = clinic.id;
  await db.collection("clinics").doc(clinicId).set(
    { subscriptionStatus: "trialing", trialEndsAt },
    { merge: true }
  );
  console.log(`✓ Created clinic "${clinicName}" (id: ${clinicId}), trial ends ${new Date(trialEndsAt).toDateString()}`);

  // 1b. Seed starter treatment areas for the Q-Switch/LHR visit forms —
  //     see prisma/schema.prisma's AreaDef model.
  const areaSeedTime = Date.now();
  for (const sessionType of Object.keys(DEFAULT_AREA_DEFS)) {
    await prisma.areaDef.createMany({
      data: DEFAULT_AREA_DEFS[sessionType].map((area) => ({
        clinicId,
        sessionType,
        ...area,
        createdAt: areaSeedTime,
      })),
    });
  }
  console.log(`✓ Seeded starter treatment areas (Q-Switch + LHR)`);

  // 2. Create the Firebase Auth user for the first staff account.
  const userRecord = await auth.createUser({ email, password, displayName: staffName });
  console.log(`✓ Created user ${email} (uid: ${userRecord.uid})`);

  // 3. Set custom claims — this is what ties the user to this clinic and
  //    role. lib/session.ts reads these claims on every request.
  await auth.setCustomUserClaims(userRecord.uid, {
    clinicId,
    role,
  });
  console.log(`✓ Set custom claims: { clinicId: "${clinicId}", role: "${role}" }`);

  // 4. Mirror the staff record into Postgres so this user shows up
  //    correctly in Settings → Staff, exactly like anyone added later
  //    through the app itself.
  await prisma.staffMember.create({
    data: {
      id: userRecord.uid,
      clinicId,
      name: staffName,
      email,
      role,
      createdAt: Date.now(),
    },
  });
  console.log(`✓ Created staff record for "${staffName}"`);

  console.log("\nDone. This user can now log in at /login with the email/password above.");
  console.log(
    "Note: if they were already signed in anywhere, they'll need to sign out and back " +
    "in for the new claims to take effect (Firebase caches the token client-side)."
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed to create clinic:", err);
  process.exit(1);
});
