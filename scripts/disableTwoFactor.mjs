#!/usr/bin/env node
/**
 * Turns off email-OTP 2FA (StaffMember.twoFactorEnabled) for one account —
 * a recovery tool for exactly the lockout case where the 2FA email never
 * arrives (e.g. the email service can't send to this address) and the
 * account can't get past the "enter your code" gate to turn it back off
 * from Settings itself.
 *
 * Usage:
 *   node scripts/disableTwoFactor.mjs --email owner@example.com
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
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i]?.replace(/^--/, "");
    if (key) {
      args[key] = argv[i + 1];
      i++;
    }
  }
  return args;
}

async function main() {
  const { email } = parseArgs();
  if (!email) {
    console.error("Usage: node scripts/disableTwoFactor.mjs --email you@example.com");
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
  const db = getFirestore();

  const userRecord = await auth.getUserByEmail(email);
  const staffRef = db.collection("staff").doc(userRecord.uid);
  const staffSnap = await staffRef.get();
  if (!staffSnap.exists) {
    console.error(`No staff record found for ${email} (uid ${userRecord.uid}).`);
    process.exit(1);
  }

  const wasEnabled = staffSnap.data()?.twoFactorEnabled === true;
  await staffRef.update({ twoFactorEnabled: false });
  console.log(
    wasEnabled
      ? `✓ Disabled 2FA for ${email}. They can sign in normally now.`
      : `2FA was already off for ${email} — nothing to change.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
