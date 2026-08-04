#!/usr/bin/env node
/**
 * Grants (or revokes) the platform-level `superAdmin` custom claim on an
 * existing Firebase Auth user — this is what unlocks /admin (see
 * lib/session.ts getAdminSession()). Independent of clinicId/role: the same
 * account can be a clinic's owner AND the platform super-admin at once, or
 * a standalone admin account with no clinic at all. There's no in-product
 * way to grant this — deliberately, since anyone with it can see and change
 * every clinic's subscription status.
 *
 * Usage:
 *   node scripts/grantSuperAdmin.mjs --email you@example.com
 *   node scripts/grantSuperAdmin.mjs --email you@example.com --revoke
 *
 * Requires .env.local to be filled in with FIREBASE_ADMIN_* values.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { initializeApp, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

function parseArgs() {
  const args = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]?.replace(/^--/, "");
    if (key === "revoke") {
      args.revoke = true;
      continue;
    }
    if (key) {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const { email, revoke } = parseArgs();

  if (!email) {
    console.error(
      "Usage: node scripts/grantSuperAdmin.mjs --email you@example.com [--revoke]"
    );
    process.exit(1);
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    console.error("Missing FIREBASE_ADMIN_* values in .env.local");
    process.exit(1);
  }

  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  const auth = getAuth();

  const userRecord = await auth.getUserByEmail(email);
  const existingClaims = userRecord.customClaims || {};

  const newClaims = { ...existingClaims };
  if (revoke) {
    delete newClaims.superAdmin;
  } else {
    newClaims.superAdmin = true;
  }

  await auth.setCustomUserClaims(userRecord.uid, newClaims);

  console.log(
    `✓ ${revoke ? "Revoked" : "Granted"} superAdmin ${revoke ? "from" : "to"} ${email} (uid: ${userRecord.uid})`
  );
  console.log(
    "Note: if they're already signed in anywhere, they'll need to sign out and back in " +
    "for the new claim to take effect (Firebase caches the token client-side)."
  );
}

main().catch((err) => {
  console.error("Failed to update superAdmin claim:", err);
  process.exit(1);
});
