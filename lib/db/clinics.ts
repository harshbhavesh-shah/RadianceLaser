import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db/client";
import type { Clinic as PrismaClinicRow } from "@prisma/client";
import type { Clinic, StatsWindow, SubscriptionStatus } from "@/types";

// Postgres migration, chunk 11 originally — Clinic. Revised in chunk 15
// (going Firestore-free): this used to also mirror subscriptionStatus/
// trialEndsAt/subscriptionRenewsAt into a Firestore clinics/{id} doc,
// purely so firestore.rules' clinicIsActive() could keep working for the
// marketing site's public LHR booking form. That form now posts to
// app/api/public/appointments/route.ts instead of writing to Firestore
// directly, so nothing reads that mirror anymore — this is a clean,
// single-store module.

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
 * instead of waiting out the 5-minute revalidate window.
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
 * "trialing". */
export async function createClinic(input: CreateClinicInput): Promise<Clinic> {
  const row = await prisma.clinic.create({
    data: {
      name: input.name,
      subscriptionStatus: input.subscriptionStatus,
      trialEndsAt: BigInt(input.trialEndsAt),
      createdAt: BigInt(Date.now()),
    },
  });
  return toClinic(row);
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
 * confirmPayment (lib/db/payments.ts). Only the fields actually passed get
 * touched. */
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
  return toClinic(row);
}

/** Used by app/admin/actions.ts deleteClinicAction. */
export async function deleteClinic(clinicId: string): Promise<void> {
  await prisma.clinic.delete({ where: { id: clinicId } });
}
