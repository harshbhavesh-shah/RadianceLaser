#!/usr/bin/env node
/**
 * One-time-but-idempotent backfill: gives every existing clinic that has no
 * AreaDef rows yet a starter set of Q-Switch/LHR treatment areas, so
 * Settings → Treatment Areas isn't empty and the visit form's Area dropdown
 * keeps showing the same options it did before AreaDef existed (previously
 * a hardcoded list in lib/sessionTypes.ts — see prisma/schema.prisma's
 * AreaDef model). Skips any clinic that already has at least one AreaDef
 * for a given session type, so re-running this is always safe.
 *
 * New clinics created after this script don't need it — see
 * scripts/createClinic.mjs, which seeds the same starter set at creation
 * time.
 *
 * Usage:
 *   node scripts/seedAreaDefs.mjs
 */

import { config } from "dotenv";
config({ path: ".env.local" });
import { readFileSync } from "fs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Same driver-adapter setup as scripts/createClinic.mjs / lib/db/client.ts.
function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

// Keep in sync with the fallback `options` arrays on the "area" columns in
// lib/sessionTypes.ts BUILT_IN_SESSION_TYPE_CONFIG — these are the same
// areas, now with a starting default duration (minutes) and GST status
// every clinic can go re-tune for themselves in Settings.
export const DEFAULT_AREA_DEFS = {
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

async function main() {
  const prisma = createPrismaClient();

  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true } });
  console.log(`Found ${clinics.length} clinic(s).`);

  for (const clinic of clinics) {
    for (const sessionType of Object.keys(DEFAULT_AREA_DEFS)) {
      const existingCount = await prisma.areaDef.count({ where: { clinicId: clinic.id, sessionType } });
      if (existingCount > 0) {
        console.log(`- ${clinic.name}: already has ${sessionType} areas, skipping.`);
        continue;
      }

      const now = Date.now();
      await prisma.areaDef.createMany({
        data: DEFAULT_AREA_DEFS[sessionType].map((area) => ({
          clinicId: clinic.id,
          sessionType,
          ...area,
          createdAt: now,
        })),
      });
      console.log(`✓ ${clinic.name}: seeded ${DEFAULT_AREA_DEFS[sessionType].length} ${sessionType} areas.`);
    }
  }

  await prisma.$disconnect();
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("Failed to seed area defs:", err);
  process.exit(1);
});
