import "server-only";
import { prisma } from "@/lib/db/client";
import type { StaffMember as PrismaStaffRow } from "@prisma/client";
import type { StaffMember, UserRole } from "@/types";

// Postgres migration, chunk 7 — the StaffMember half of prisma/schema.prisma.
// Originally a Firebase Auth mirror only (id = the Firebase uid,
// authorization lived entirely in Auth custom claims). Now the actual
// identity + authorization source: passwordHash gates sign-in
// (lib/auth/password.ts), and disabled/role/clinicId are read directly by
// lib/session.ts when building a session — nothing here mirrors anything
// else anymore.

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
    ...(row.disabled !== null ? { disabled: row.disabled ?? undefined } : {}),
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Backs the Free/Basic staff-login cap (see lib/entitlements.ts) — a
 * plain count rather than reusing getClinicStaff().length so callers that
 * only need the number don't pay for fetching every row's full shape. */
export async function getClinicStaffCount(clinicId: string): Promise<number> {
  return prisma.staffMember.count({ where: { clinicId } });
}

export async function getClinicStaff(clinicId: string): Promise<StaffMember[]> {
  const rows = await prisma.staffMember.findMany({
    where: { clinicId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return rows.map(toStaffMember);
}

/** One query for every clinic's owner email, keyed by clinicId — backs the
 * admin Clinics page's "Email" action (components/admin/ClinicsTable.tsx),
 * which needs this for every row at once rather than one at a time. A
 * clinic missing from the returned map has no "owner"-role staff row on
 * record (shouldn't normally happen — every clinic gets one at signup, see
 * app/signup/actions.ts — but a pre-migration or hand-edited clinic might). */
export async function getClinicOwnerEmails(clinicIds: string[]): Promise<Record<string, string>> {
  if (clinicIds.length === 0) return {};
  const rows = await prisma.staffMember.findMany({
    where: { clinicId: { in: clinicIds }, role: "owner" },
    select: { clinicId: true, email: true },
  });
  return Object.fromEntries(rows.map((r) => [r.clinicId, r.email]));
}

/** One staff member by their row id (uid) — used to load role/clinicId
 * when building a session (lib/session.ts) and by the 2FA gate at login. */
export async function getStaffMemberByUid(uid: string): Promise<StaffMember | null> {
  const row = await prisma.staffMember.findUnique({ where: { id: uid } });
  return row ? toStaffMember(row) : null;
}

/** The login-time lookup — email is what the sign-in form actually has.
 * Always normalizes case, matching how every write path stores it. */
export async function getStaffMemberByEmail(email: string): Promise<StaffMember | null> {
  const row = await prisma.staffMember.findUnique({ where: { email: normalizeEmail(email) } });
  return row ? toStaffMember(row) : null;
}

export interface StaffAuthRecord {
  id: string;
  email: string;
  clinicId: string;
  role: UserRole;
  passwordHash: string | null;
  disabled: boolean;
  superAdmin: boolean;
}

function toStaffAuthRecord(row: {
  id: string;
  email: string;
  clinicId: string;
  role: string;
  passwordHash: string | null;
  disabled: boolean | null;
  superAdmin: boolean | null;
}): StaffAuthRecord {
  return {
    id: row.id,
    email: row.email,
    clinicId: row.clinicId,
    role: row.role as UserRole,
    passwordHash: row.passwordHash,
    disabled: row.disabled === true,
    superAdmin: row.superAdmin === true,
  };
}

const AUTH_RECORD_SELECT = {
  id: true,
  email: true,
  clinicId: true,
  role: true,
  passwordHash: true,
  disabled: true,
  superAdmin: true,
} as const;

/** For internal auth code that needs the raw passwordHash column, which
 * toStaffMember()/StaffMember deliberately never exposes to the rest of the
 * app (nothing outside lib/auth/* and these two lookups should ever see a
 * hash). By email — the login form's input; by uid — the 2FA verify step,
 * which only has the uid a challenge was issued to. */
export async function getStaffAuthRecordByEmail(email: string): Promise<StaffAuthRecord | null> {
  const row = await prisma.staffMember.findUnique({
    where: { email: normalizeEmail(email) },
    select: AUTH_RECORD_SELECT,
  });
  return row ? toStaffAuthRecord(row) : null;
}

export async function getStaffAuthRecordByUid(uid: string): Promise<StaffAuthRecord | null> {
  const row = await prisma.staffMember.findUnique({ where: { id: uid }, select: AUTH_RECORD_SELECT });
  return row ? toStaffAuthRecord(row) : null;
}

export interface CreateStaffMemberInput {
  // Optional — omit to get a generated cuid (the normal case now that
  // there's no external Firebase uid to match). Scripts/e2e fixtures can
  // still pass a specific id when they need one deterministically.
  id?: string;
  clinicId: string;
  name: string;
  email: string;
  role: UserRole;
  passwordHash?: string | null;
}

export async function createStaffMember(input: CreateStaffMemberInput): Promise<StaffMember> {
  const row = await prisma.staffMember.create({
    data: {
      ...(input.id ? { id: input.id } : {}),
      clinicId: input.clinicId,
      name: input.name,
      email: normalizeEmail(input.email),
      role: input.role,
      passwordHash: input.passwordHash ?? null,
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

/** Soft-disable — the account keeps its history (visits, receipts stay
 * attributed to it) but can no longer sign in (checked at login; see
 * lib/session.ts's comment on why an already-issued session cookie isn't
 * force-invalidated the instant this flips, same tradeoff as before). */
export async function setStaffDisabled(clinicId: string, uid: string, disabled: boolean): Promise<void> {
  const existing = await prisma.staffMember.findUnique({ where: { id: uid }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Staff member not found.");
  }
  await prisma.staffMember.update({ where: { id: uid }, data: { disabled } });
}

export async function removeStaffMember(clinicId: string, uid: string): Promise<void> {
  const existing = await prisma.staffMember.findUnique({ where: { id: uid }, select: { clinicId: true } });
  if (!existing || existing.clinicId !== clinicId) {
    throw new Error("Staff member not found.");
  }
  await prisma.staffMember.delete({ where: { id: uid } });
}

/** Sets a new password hash directly — used by the forced-reset-on-first-login
 * path (addStaffMember's temp password) and the self-service /reset-password
 * flow (lib/auth/passwordReset.ts). No clinicId check here: both callers
 * already established the right to do this (a valid, single-use reset token,
 * or the owner's own just-created temp password flow) before calling in. */
export async function setStaffPasswordHash(uid: string, passwordHash: string): Promise<void> {
  await prisma.staffMember.update({ where: { id: uid }, data: { passwordHash } });
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
