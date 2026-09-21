import { config } from "dotenv";
config({ path: ".env.local" });

import { readFileSync } from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { generateUniqueClinicSlug } from "@/lib/clinicSlug";
import { hashPassword } from "@/lib/auth/password";

// A programmatic version of scripts/createClinic.mjs (plus a matching
// full-teardown, which that script doesn't have) — Playwright's global
// setup/teardown import this directly instead of shelling out, so the
// clinic id/uid it creates can be handed straight to the tests and back
// to the teardown without parsing stdout.

function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
    ssl: { ca: readFileSync("global-bundle.pem", "utf-8"), rejectUnauthorized: true },
  });
  return new PrismaClient({ adapter });
}

function ensureFirebaseAdmin() {
  if (getApps().length) return;
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) {
    throw new Error("Missing Firebase Admin credentials in .env.local. See .env.local.example.");
  }
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
}

const TRIAL_LENGTH_DAYS = 30; // keep in sync with lib/subscription.ts

export interface TestClinic {
  clinicId: string;
  clinicName: string;
  uid: string;
  email: string;
  password: string;
}

/** Creates a throwaway clinic + owner account for the e2e run, named with
 * a distinctive, greppable prefix so global-teardown (or a human, if a run
 * gets interrupted before teardown) can always find and remove it —
 * exactly the "throwaway-clinic verification pattern" this repo's manual
 * UI sweeps have used all along, just made reusable for Playwright. */
export async function createTestClinic(): Promise<TestClinic> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const prisma = createPrismaClient();

  const runId = Date.now();
  const clinicName = `_e2e_test_clinic_${runId}`;
  const email = `_e2e_test_owner_${runId}@example.com`;
  const password = "E2eTestPass123!";

  const trialEndsAt = Date.now() + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000;
  const slug = await generateUniqueClinicSlug(clinicName);
  const clinic = await prisma.clinic.create({
    data: { name: clinicName, slug, subscriptionStatus: "trialing", trialEndsAt, createdAt: Date.now() },
  });
  await db.collection("clinics").doc(clinic.id).set({ subscriptionStatus: "trialing", trialEndsAt }, { merge: true });

  // Sign-in is fully self-rolled now (see lib/session.ts,
  // app/login/actions.ts) — no external Auth account to create, just a row
  // with a real passwordHash, same as any account created through the app.
  const passwordHash = await hashPassword(password);
  const staff = await prisma.staffMember.create({
    data: { clinicId: clinic.id, name: "E2E Test Owner", email, role: "owner", passwordHash, createdAt: Date.now() },
  });

  await prisma.$disconnect();

  return { clinicId: clinic.id, clinicName, uid: staff.id, email, password };
}

// Every Prisma model keyed by clinicId, as its client accessor name — see
// prisma/schema.prisma. Kept as an explicit list (not derived from
// Prisma's DMMF at runtime) so a schema change that adds a new
// clinic-scoped model without updating this list fails loudly the next
// time an e2e run's teardown leaves rows behind, rather than silently.
const CLINIC_SCOPED_MODELS = [
  "appointment",
  "areaDef",
  "auditLog",
  "adminAuditLog",
  "consentForm",
  "consentFormTemplate",
  "inventoryItem",
  "inventoryLog",
  "machine",
  "messageTemplate",
  "noShowFollowUp",
  "noShowMessageLog",
  "noShowSurveyResponse",
  "package",
  "packageTypeDef",
  "patient",
  "patientPhoto",
  "payment",
  "pushToken",
  "receipt",
  "receiptCounter",
  "sessionTypeDef",
  "staffMember",
  "visit",
  "visitFeedback",
  "whatsAppConversation",
  "whatsAppMessage",
] as const;

export async function deleteTestClinic(clinicId: string): Promise<void> {
  ensureFirebaseAdmin();
  const db = getFirestore();
  const prisma = createPrismaClient();

  for (const model of CLINIC_SCOPED_MODELS) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic cleanup over every clinic-scoped model, see the list above
    await (prisma as any)[model].deleteMany({ where: { clinicId } });
  }
  // WhatsAppConnection's id IS the clinicId, not a separate column.
  await prisma.whatsAppConnection.deleteMany({ where: { id: clinicId } });
  await prisma.clinic.delete({ where: { id: clinicId } }).catch(() => {}); // already gone is fine

  await db.collection("clinics").doc(clinicId).delete().catch(() => {});

  await prisma.$disconnect();
}
