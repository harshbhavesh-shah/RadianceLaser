import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";
import { adminDb } from "@/lib/firebase/admin";
import type { Clinic as PrismaClinicRow } from "@prisma/client";
import type { Clinic, StatsWindow, SubscriptionStatus } from "@/types";

// Postgres migration, chunk 11 — the last one, and the only genuinely
// hybrid table left standing on purpose. See prisma/schema.prisma's Clinic
// model comment for the full picture: this table is the real source of
// truth, but every write that touches subscriptionStatus/trialEndsAt/
// subscriptionRenewsAt also mirrors those three fields into Firestore's
// clinics/{id} doc, purely so firestore.rules' clinicIsActive() keeps
// working for the one write path that can never move server-side — the
// marketing site's public LHR booking form.

export function clinicCacheTag(clinicId: string): string {
  return `clinic-${clinicId}`;
}

function toClinic(row: PrismaClinicRow): Clinic {
  return {
    id: row.id,
    name: row.name,
    createdAt: Number(row.createdAt),
    subscriptionStatus: row.subscriptionStatus as SubscriptionStatus,
    trialEndsAt: Number(row.trialEndsAt),
    ...(row.address ? { address: row.address } : {}),
    ...(row.statsWindow ? { statsWindow: row.statsWindow as StatsWindow } : {}),
    ...(row.subscriptionRenewsAt !== null ? { subscriptionRenewsAt: Number(row.subscriptionRenewsAt) } : {}),
  };
}

/** Writes just the three subscription-related fields into Firestore's
 * clinics/{id} doc — never the whole record. Firestore's own copy of
 * name/address/statsWindow is allowed to go stale (nothing there reads
 * them anymore); only the fields clinicIsActive() actually evaluates need
 * to stay current. `merge: true` so this works whether or not a Firestore
 * doc already exists for this clinic id. Best-effort: if this fails, the
 * Postgres write (the real source of truth) has already succeeded, and the
 * clinic's *own* staff aren't affected either way (their writes go through
 * server actions, not firestore.rules) — only the public booking rule
 * would see a stale status until this is retried or the clinic's status
 * changes again. */
async function mirrorSubscriptionFieldsToFirestore(clinic: Clinic): Promise<void> {
  try {
    await adminDb()
      .collection("clinics")
      .doc(clinic.id)
      .set(
        {
          subscriptionStatus: clinic.subscriptionStatus,
          trialEndsAt: clinic.trialEndsAt,
          ...(clinic.subscriptionRenewsAt !== undefined
            ? { subscriptionRenewsAt: clinic.subscriptionRenewsAt }
            : {}),
        },
        { merge: true }
      );
  } catch (err) {
    console.error(`Failed to mirror subscription fields to Firestore for clinic ${clinic.id}:`, err);
  }
}

async function fetchClinic(clinicId: string): Promise<Clinic | null> {
  const row = await prisma.clinic.findUnique({ where: { id: clinicId } });
  return row ? toClinic(row) : null;
}

/**
 * The clinic row rarely changes (name/address/preferences, edited only from
 * Settings), but app/dashboard/layout.tsx reads it on every single
 * dashboard navigation, since getSession() makes the whole layout dynamic.
 * Cached across requests via unstable_cache, tagged so the mutating actions
 * below can invalidate it immediately with revalidateTag(clinicCacheTag(id))
 * instead of waiting out the 5-minute revalidate window — same as the
 * Firestore version this replaces.
 */
export function getClinic(clinicId: string): Promise<Clinic | null> {
  return unstable_cache(fetchClinic, ["clinic"], {
    tags: [clinicCacheTag(clinicId)],
    revalidate: 300,
  })(clinicId);
}

/** Every clinic on the platform — used only by the super-admin panel. */
export async function getAllClinics(): Promise<Clinic[]> {
  const rows = await prisma.clinic.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(toClinic);
}

export interface CreateClinicInput {
  name: string;
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt: number;
}

/** Used by signup (app/signup/actions.ts, app/login/actions.ts's Google
 * path) and scripts/createClinic.mjs — a brand-new clinic always starts
 * "trialing", so this also seeds the Firestore mirror from nothing rather
 * than relying on a later update to create it. */
export async function createClinic(input: CreateClinicInput): Promise<Clinic> {
  const row = await prisma.clinic.create({
    data: {
      name: input.name,
      subscriptionStatus: input.subscriptionStatus,
      trialEndsAt: BigInt(input.trialEndsAt),
      createdAt: BigInt(Date.now()),
    },
  });
  const clinic = toClinic(row);
  await mirrorSubscriptionFieldsToFirestore(clinic);
  return clinic;
}

export async function updateClinicName(clinicId: string, name: string): Promise<void> {
  await prisma.clinic.update({ where: { id: clinicId }, data: { name } });
}

export async function updateClinicAddress(clinicId: string, address: string): Promise<void> {
  await prisma.clinic.update({ where: { id: clinicId }, data: { address } });
}

export async function updateStatsWindow(clinicId: string, statsWindow: StatsWindow): Promise<void> {
  await prisma.clinic.update({ where: { id: clinicId }, data: { statsWindow } });
}

export interface UpdateSubscriptionInput {
  subscriptionStatus: SubscriptionStatus;
  trialEndsAt?: number;
  subscriptionRenewsAt?: number;
}

/** The one function every subscription-changing write path shares —
 * extendAccessAction/terminateAccessAction (app/admin/actions.ts) and
 * confirmPayment (lib/firestore/payments.ts) — so the Firestore mirror can
 * never be forgotten on one path but not another. Only the fields actually
 * passed get touched, same as a partial Firestore update. */
export async function updateClinicSubscription(
  clinicId: string,
  input: UpdateSubscriptionInput
): Promise<Clinic> {
  const row = await prisma.clinic.update({
    where: { id: clinicId },
    data: {
      subscriptionStatus: input.subscriptionStatus,
      ...(input.trialEndsAt !== undefined ? { trialEndsAt: BigInt(input.trialEndsAt) } : {}),
      ...(input.subscriptionRenewsAt !== undefined ? { subscriptionRenewsAt: BigInt(input.subscriptionRenewsAt) } : {}),
    },
  });
  const clinic = toClinic(row);
  await mirrorSubscriptionFieldsToFirestore(clinic);
  return clinic;
}

/** Deletes both the Postgres row and its Firestore mirror doc — used by
 * app/admin/actions.ts deleteClinicAction. */
export async function deleteClinic(clinicId: string): Promise<void> {
  await prisma.clinic.delete({ where: { id: clinicId } });
  await adminDb().collection("clinics").doc(clinicId).delete().catch(() => {});
}
