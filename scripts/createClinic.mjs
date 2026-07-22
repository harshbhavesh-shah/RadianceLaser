#!/usr/bin/env node
/**
 * Bootstraps a new clinic (tenant) and its first user, with the correct
 * Firebase Auth custom claims (clinicId + role) that the whole app relies
 * on for tenant isolation. There's no self-serve signup UI yet, so this is
 * how you create clinic #1, #2, #3... for now.
 *
 * Also creates the user's Firestore staff mirror doc (see
 * app/dashboard/settings/actions.ts) so this first owner shows up correctly
 * in their own Settings → Staff list, same as anyone added later from the
 * app itself.
 *
 * Usage:
 *   node scripts/createClinic.mjs \
 *     --clinicName "Advanced Skin Clinic" \
 *     --name "Dr. Bhavesh Shah" \
 *     --email owner@example.com \
 *     --password "some-temporary-password" \
 *     --role owner
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

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

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();
  const db = getFirestore();

  // 1. Create the clinic document.
  const clinicRef = db.collection("clinics").doc();
  await clinicRef.set({
    name: clinicName,
    createdAt: Date.now(),
  });
  console.log(`✓ Created clinic "${clinicName}" (id: ${clinicRef.id})`);

  // 2. Create the Firebase Auth user for the first staff account.
  const userRecord = await auth.createUser({ email, password, displayName: staffName });
  console.log(`✓ Created user ${email} (uid: ${userRecord.uid})`);

  // 3. Set custom claims — this is what ties the user to this clinic and
  //    role. lib/session.ts reads these claims on every request.
  await auth.setCustomUserClaims(userRecord.uid, {
    clinicId: clinicRef.id,
    role,
  });
  console.log(`✓ Set custom claims: { clinicId: "${clinicRef.id}", role: "${role}" }`);

  // 4. Mirror the staff record into Firestore so this user shows up
  //    correctly in Settings → Staff, exactly like anyone added later
  //    through the app itself.
  await db.collection("staff").doc(userRecord.uid).set({
    clinicId: clinicRef.id,
    uid: userRecord.uid,
    name: staffName,
    email,
    role,
    createdAt: Date.now(),
  });
  console.log(`✓ Created staff record for "${staffName}"`);

  console.log("\nDone. This user can now log in at /login with the email/password above.");
  console.log(
    "Note: if they were already signed in anywhere, they'll need to sign out and back " +
    "in for the new claims to take effect (Firebase caches the token client-side)."
  );
}

main().catch((err) => {
  console.error("Failed to create clinic:", err);
  process.exit(1);
});
