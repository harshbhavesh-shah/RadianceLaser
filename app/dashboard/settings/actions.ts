"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { randomInt } from "crypto";
import { getSession } from "@/lib/session";
import { hashPassword } from "@/lib/auth/password";
import {
  clinicCacheTag,
  getClinic,
  updateClinicName as updateClinicNameInDb,
  updateClinicAddress as updateClinicAddressInDb,
} from "@/lib/db/clinics";
import {
  createStaffMember,
  getClinicStaffCount,
  getStaffAuthRecordByEmail,
  updateStaffRole as updateStaffRoleInDb,
  removeStaffMember as removeStaffMemberInDb,
  updateStaffFlags,
} from "@/lib/db/staff";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import type { StaffMember, UserRole } from "@/types";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

// Not meant to be memorable — the owner shares it once, the new staff
// member is expected to change it after first login. crypto.randomInt, not
// Math.random(): this is a real (if temporary) credential, not a UI id.
function generateTempPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars.charAt(randomInt(0, chars.length));
  return pw;
}

export interface AddStaffResult {
  error?: string;
  success?: { staff: StaffMember; tempPassword: string };
}

export async function addStaffMember(
  name: string,
  email: string,
  role: UserRole
): Promise<AddStaffResult> {
  try {
    const session = await requireOwner();

    if (!name.trim()) return { error: "Name is required." };
    if (!email.trim()) return { error: "Email is required." };

    const clinic = await getClinic(session.clinicId);
    const tier = getClinicTier(
      clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
    );
    const { maxStaff } = getEntitlements(tier);
    if (maxStaff !== null) {
      const count = await getClinicStaffCount(session.clinicId);
      if (count >= maxStaff) {
        return { error: `You've reached the ${maxStaff}-staff-login limit on your plan. Upgrade to add more.` };
      }
    }

    const existing = await getStaffAuthRecordByEmail(email.trim());
    if (existing) return { error: "A staff member with this email already exists." };

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    const staff = await createStaffMember({
      clinicId: session.clinicId,
      name: name.trim(),
      email: email.trim(),
      role,
      passwordHash,
    });

    revalidatePath("/dashboard/settings");
    return { success: { staff, tempPassword } };
  } catch (err) {
    console.error("Failed to add staff member:", err);
    return { error: err instanceof Error ? err.message : "Something went wrong adding this staff member." };
  }
}

export async function updateStaffRole(uid: string, newRole: UserRole): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();

    if (uid === session.uid) {
      return { error: "You can't change your own role." };
    }

    await updateStaffRoleInDb(session.clinicId, uid, newRole);

    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to update staff role:", err);
    return { error: "Couldn't update this staff member's role." };
  }
}

export async function removeStaffMember(uid: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();

    if (uid === session.uid) {
      return { error: "You can't remove your own account." };
    }

    await removeStaffMemberInDb(session.clinicId, uid);

    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to remove staff member:", err);
    return { error: "Couldn't remove this staff member." };
  }
}

export async function updateClinicName(name: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    if (!name.trim()) return { error: "Clinic name can't be empty." };

    await updateClinicNameInDb(session.clinicId, name.trim());
    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to update clinic name:", err);
    return { error: "Couldn't update the clinic name." };
  }
}

export async function updateClinicAddress(address: string): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await updateClinicAddressInDb(session.clinicId, address.trim());
    revalidateTag(clinicCacheTag(session.clinicId));
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to update clinic address:", err);
    return { error: "Couldn't update the clinic address." };
  }
}

/** Each staff member manages their own 2FA — deliberately no requireOwner()
 * here, unlike everything else in this file. There's no owner-mandated
 * "require this for everyone" yet (see lib/twoFactor.ts and
 * app/login/actions.ts requestTwoFactorIfEnabledAction()). */
export async function toggleTwoFactorAction(enabled: boolean): Promise<{ error?: string }> {
  try {
    const session = await getSession();
    if (!session) throw new Error("Not signed in.");

    await updateStaffFlags(session.uid, { twoFactorEnabled: enabled });
    revalidatePath("/dashboard/settings");
    return {};
  } catch (err) {
    console.error("Failed to update 2FA preference:", err);
    return { error: "Couldn't update this setting. Please try again." };
  }
}
