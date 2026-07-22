"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/session";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import type { StaffMember, StatsWindow, UserRole } from "@/types";

async function requireOwner() {
  const session = await getSession();
  if (!session) throw new Error("Not signed in.");
  if (session.role !== "owner") throw new Error("Only the clinic owner can do this.");
  return session;
}

function generateTempPassword(): string {
  // Not meant to be memorable — the owner shares it once, the new staff
  // member is expected to change it after first login.
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let pw = "";
  for (let i = 0; i < 12; i++) pw += chars.charAt(Math.floor(Math.random() * chars.length));
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

    const tempPassword = generateTempPassword();

    const userRecord = await adminAuth().createUser({
      email: email.trim(),
      password: tempPassword,
      displayName: name.trim(),
    });

    await adminAuth().setCustomUserClaims(userRecord.uid, {
      clinicId: session.clinicId,
      role,
    });

    const staffDoc = {
      clinicId: session.clinicId,
      uid: userRecord.uid,
      name: name.trim(),
      email: email.trim(),
      role,
      createdAt: Date.now(),
    };
    await adminDb().collection("staff").doc(userRecord.uid).set(staffDoc);

    revalidatePath("/dashboard/settings");
    return { success: { staff: { id: userRecord.uid, ...staffDoc }, tempPassword } };
  } catch (err) {
    console.error("Failed to add staff member:", err);
    const message = (err as { errorInfo?: { message?: string } })?.errorInfo?.message;
    return {
      error:
        message ||
        (err instanceof Error ? err.message : "Something went wrong adding this staff member."),
    };
  }
}

export async function updateStaffRole(uid: string, newRole: UserRole): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();

    if (uid === session.uid) {
      return { error: "You can't change your own role." };
    }

    const userRecord = await adminAuth().getUser(uid);
    const existingClaims = userRecord.customClaims || {};
    await adminAuth().setCustomUserClaims(uid, { ...existingClaims, role: newRole });
    await adminDb().collection("staff").doc(uid).update({ role: newRole });

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

    await adminAuth().deleteUser(uid);
    await adminDb().collection("staff").doc(uid).delete();

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

    await adminDb().collection("clinics").doc(session.clinicId).update({ name: name.trim() });
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
    await adminDb()
      .collection("clinics")
      .doc(session.clinicId)
      .update({ address: address.trim() });
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to update clinic address:", err);
    return { error: "Couldn't update the clinic address." };
  }
}

export async function updateStatsWindow(window: StatsWindow): Promise<{ error?: string }> {
  try {
    const session = await requireOwner();
    await adminDb().collection("clinics").doc(session.clinicId).update({ statsWindow: window });
    revalidatePath("/dashboard");
    return {};
  } catch (err) {
    console.error("Failed to update stats window:", err);
    return { error: "Couldn't update this preference." };
  }
}
