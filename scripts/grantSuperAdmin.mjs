#!/usr/bin/env node
/**
 * Grants (or revokes) platform-level super-admin access — this is what
 * unlocks /admin (see lib/session.ts getAdminSession()). An account that
 * already has a clinic (StaffMember row) gets superAdmin=true set directly
 * on that row, so the same account stays both a clinic's owner/staff AND
 * the platform admin. An email with no clinic at all becomes a standalone
 * PlatformAdmin row instead (see prisma/schema.prisma) — there's no
 * in-product way to grant either, deliberately, since anyone with this can
 * see and change every clinic's subscription status.
 *
 * Usage:
 *   node scripts/grantSuperAdmin.mjs --email you@example.com
 *   node scripts/grantSuperAdmin.mjs --email you@example.com --revoke
 *
 *   # If the email matches no account at all (a standalone admin login with
 *   # no clinic), pass --password to create one:
 *   node scripts/grantSuperAdmin.mjs --email admin@example.com --password "some-temp-password"
 *
 *   # --password also works against an EXISTING account — it sets/resets
 *   # that account's password rather than being ignored.
 *   node scripts/grantSuperAdmin.mjs --email admin@example.com --password "new-password"
 *
 * Requires .env.local to be filled in with DATABASE_URL.
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { randomBytes, scrypt as scryptCallback } from "crypto";
import { promisify } from "util";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Duplicated from lib/auth/password.ts — see scripts/createClinic.mjs's
// copy of this same comment for why.
const scrypt = promisify(scryptCallback);
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

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
  const { email, password, revoke } = parseArgs();

  if (!email) {
    console.error(
      "Usage: node scripts/grantSuperAdmin.mjs --email you@example.com [--password \"temp-password\"] [--revoke]"
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local");
    process.exit(1);
  }

  const prisma = createPrismaClient();
  const normalizedEmail = email.trim().toLowerCase();

  const staff = await prisma.staffMember.findUnique({ where: { email: normalizedEmail } });
  if (staff) {
    if (password) {
      await prisma.staffMember.update({
        where: { id: staff.id },
        data: { passwordHash: await hashPassword(password) },
      });
      console.log(`✓ Set password for existing staff account ${normalizedEmail}`);
    }
    await prisma.staffMember.update({ where: { id: staff.id }, data: { superAdmin: !revoke } });
    console.log(`✓ ${revoke ? "Revoked" : "Granted"} superAdmin ${revoke ? "from" : "to"} ${normalizedEmail} (clinic staff, id: ${staff.id})`);
    await prisma.$disconnect();
    return;
  }

  const platformAdmin = await prisma.platformAdmin.findUnique({ where: { email: normalizedEmail } });
  if (platformAdmin) {
    if (revoke) {
      await prisma.platformAdmin.delete({ where: { id: platformAdmin.id } });
      console.log(`✓ Removed standalone platform admin account ${normalizedEmail}`);
      await prisma.$disconnect();
      return;
    }
    if (password) {
      await prisma.platformAdmin.update({
        where: { id: platformAdmin.id },
        data: { passwordHash: await hashPassword(password) },
      });
      console.log(`✓ Set password for existing platform admin account ${normalizedEmail}`);
    } else {
      console.log(`✓ ${normalizedEmail} already has standalone superAdmin access.`);
    }
    await prisma.$disconnect();
    return;
  }

  if (revoke) {
    console.error("Nothing to revoke — no account exists for this email.");
    process.exit(1);
  }
  if (!password) {
    console.error(
      `No account exists for ${normalizedEmail} yet. Pass --password "some-temp-password" to create one, ` +
      "e.g.:\n  node scripts/grantSuperAdmin.mjs --email " + normalizedEmail + ' --password "some-temp-password"'
    );
    process.exit(1);
  }

  const created = await prisma.platformAdmin.create({
    data: { email: normalizedEmail, passwordHash: await hashPassword(password), createdAt: BigInt(Date.now()) },
  });
  console.log(`✓ Created standalone platform admin account ${normalizedEmail} (id: ${created.id})`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed to update superAdmin access:", err);
  process.exit(1);
});
