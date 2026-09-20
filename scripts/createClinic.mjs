#!/usr/bin/env node
/**
 * Bootstraps a new clinic (tenant) and its first user. There's no self-serve
 * signup UI yet, so this is how you create clinic #1, #2, #3... for now.
 *
 * Also creates the user's StaffMember row in Postgres (see
 * app/dashboard/settings/actions.ts, lib/db/staff.ts) so this first owner
 * shows up correctly in their own Settings → Staff list, same as anyone
 * added later through the app itself — and IS the actual account (no
 * separate Firebase Auth user to keep in sync anymore; see
 * lib/auth/password.ts, lib/session.ts).
 *
 * Usage:
 *   node scripts/createClinic.mjs \
 *     --clinicName "Advanced Skin Clinic" \
 *     --name "Dr. Bhavesh Shah" \
 *     --email owner@example.com \
 *     --password "some-temporary-password" \
 *     --role owner
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

// Duplicated from lib/auth/password.ts (same format: "scrypt:<salt>:<hash>",
// both hex) — this is a plain Node script, not compiled through Next's
// TypeScript/path-alias setup, so it can't import that module directly.
// Keep these two in sync by hand if either ever changes.
const scrypt = promisify(scryptCallback);
async function hashPassword(password) {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, 64);
  return `scrypt:${salt.toString("hex")}:${derived.toString("hex")}`;
}

// Kept in sync with lib/clinicSlug.ts by hand (same reasoning as
// DEFAULT_AREA_DEFS below — a plain Node script, not compiled through
// Next's TypeScript/path-alias setup, so no cross-import).
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

  if (password.length < 8) {
    console.error("Password must be at least 8 characters.");
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error("Missing DATABASE_URL in .env.local.");
    process.exit(1);
  }

  const prisma = createPrismaClient();
  const normalizedEmail = email.trim().toLowerCase();

  const existing = await prisma.staffMember.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    console.error(`A staff member with email "${normalizedEmail}" already exists.`);
    process.exit(1);
  }

  // 1. Create the clinic. Starts on a free trial — see lib/subscription.ts
  //    getClinicAccess for how trialEndsAt/subscriptionStatus combine into
  //    the actual access decision.
  const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;
  const slug = await generateUniqueClinicSlug(prisma, clinicName);
  const clinic = await prisma.clinic.create({
    data: { name: clinicName, slug, subscriptionStatus: "trialing", trialEndsAt, createdAt: Date.now() },
  });
  const clinicId = clinic.id;
  console.log(`✓ Created clinic "${clinicName}" (id: ${clinicId}), trial ends ${new Date(trialEndsAt).toDateString()}`);
  console.log(`✓ Public booking subdomain: https://${slug}.radiancelaser.in`);

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
  console.log(`✓ Seeded starter treatment areas (${Object.keys(DEFAULT_AREA_DEFS).join(", ")})`);

  // 2. Create the owner's account directly in Postgres — this row IS the
  //    account now (see lib/session.ts, app/login/actions.ts), not a mirror
  //    of anything external.
  const passwordHash = await hashPassword(password);
  const staff = await prisma.staffMember.create({
    data: {
      clinicId,
      name: staffName,
      email: normalizedEmail,
      role,
      passwordHash,
      createdAt: Date.now(),
    },
  });
  console.log(`✓ Created staff record for "${staffName}" (id: ${staff.id})`);

  console.log("\nDone. This user can now log in at /login with the email/password above.");

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Failed to create clinic:", err);
  process.exit(1);
});
