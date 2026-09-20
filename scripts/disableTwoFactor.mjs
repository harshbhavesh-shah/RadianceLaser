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
 * Requires .env.local to be filled in with DATABASE_URL.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Same driver-adapter setup as lib/db/client.ts, duplicated here since this
// is a plain Node script, not compiled through Next's TypeScript/path-alias
// setup — see scripts/createClinic.mjs for the same pattern.
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

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
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }

  const prisma = createPrismaClient();
  const normalizedEmail = email.trim().toLowerCase();

  const staff = await prisma.staffMember.findUnique({ where: { email: normalizedEmail } });
  if (!staff) {
    console.error(`No staff record found for ${normalizedEmail}.`);
    process.exit(1);
  }

  const wasEnabled = staff.twoFactorEnabled === true;
  await prisma.staffMember.update({ where: { id: staff.id }, data: { twoFactorEnabled: false } });
  console.log(
    wasEnabled
      ? `✓ Disabled 2FA for ${normalizedEmail}. They can sign in normally now.`
      : `2FA was already off for ${normalizedEmail} — nothing to change.`
  );

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
