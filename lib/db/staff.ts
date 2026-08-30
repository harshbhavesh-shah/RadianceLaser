import "server-only";
import { prisma } from "@/lib/db/client";
import type { StaffMember as PrismaStaffRow } from "@prisma/client";
import type { StaffMember, UserRole } from "@/types";

// Postgres migration, chunk 7 — the StaffMember half of prisma/schema.prisma.
// See that model's comment for why `id` is the Firebase Auth uid rather than
// a generated cuid, and why this table is a display/preferences mirror only
// — never the authorization boundary (that stays entirely in Auth custom
// claims, read by lib/session.ts, which never touches this table).

function toStaffMember(row: PrismaStaffRow): StaffMember {
  return {
    id: row.id,
    uid: row.id,
    clinicId: row.clinicId,
    name: row.name,
    email: row.email,
    role: row.role as UserRole,
    createdAt: Number(row.createdAt),
    ...(row.twoFactorEnabled !== null ? { twoFactorEnabled: row.twoFactorEnabled } : {}),
    ...(row.tourCompleted !== null ? { tourCompleted: row.tourCompleted } : {}),
    ...(row.onboardingDismissed !== null ? { onboardingDismissed: row.onboardingDismissed } : {}),
  };
}

export async function getClinicStaff(clinicId: string): Promise<StaffMember[]> {
  const rows = await prisma.staffMember.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toStaffMember);
}

/** One staff member by their Firebase Auth uid (== this row's id) — used
 * by the 2FA gate at login (app/login/actions.ts), which only has the uid
 * from the just-verified ID token, not a clinicId to scope by yet. */
export async function getStaffMemberByUid(uid: string): Promise<StaffMember | null> {
  const row = await prisma.staffMember.findUnique({ where: { id: uid } });
  return row ? toStaffMember(row) : null;
}

export interface CreateStaffMemberInput {
  uid: string; // Firebase Auth uid — becomes this row's id
  clinicId: string;
  name: string;
  email: string;
  role: UserRole;
}

/** Mirrors a Firebase Auth user (already created, with custom claims
 * already set — see app/dashboard/settings/actions.ts addStaffMember,
 * app/signup/actions.ts, app/login/actions.ts provisionGoogleClinicAction,
 * scripts/createClinic.mjs) into this table for display/preferences. */
export async function createStaffMember(input: CreateStaffMemberInput): Promise<StaffMember> {
  const row = await prisma.staffMember.create({
    data: {
      id: input.uid,
      clinicId: input.clinicId,
      name: input.name,
      email: input.email,
      role: input.role,
      createdAt: BigInt(Date.now()),
    },
  });
  return toStaffMember(row);
}

export async function updateStaffRole(clinicId: string, uid: string, role: UserRole): Promise<void> {
  const existing = await prisma.staffMember.findUnique({ where: { id: uid }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Staff member not found.");
  }
  await prisma.staffMember.update({ where: { id: uid }, data: { role } });
}

export async function removeStaffMember(clinicId: string, uid: string): Promise<void> {
  const existing = await prisma.staffMember.findUnique({ where: { id: uid }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Staff member not found.");
  }
  await prisma.staffMember.delete({ where: { id: uid } });
}

/** Each of the three per-person flags (2FA opt-in, tour/onboarding state)
 * is always set by the person themselves, scoped to their own uid — see
 * app/dashboard/actions.ts and app/dashboard/settings/actions.ts
 * toggleTwoFactorAction. No clinicId check needed the way update/remove
 * above need one: session.uid is trusted, and someone can only ever flip
 * their own flags. */
export async function updateStaffFlags(
  uid: string,
  flags: Partial<{ twoFactorEnabled: boolean; tourCompleted: boolean; onboardingDismissed: boolean }>
): Promise<void> {
  await prisma.staffMember.update({ where: { id: uid }, data: flags });
}
