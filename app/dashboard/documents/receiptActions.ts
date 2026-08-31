"use server";

import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import { createReceipt, deleteReceipt } from "@/lib/db/receipts";
import { allocateReceiptNumber } from "@/lib/db/receiptNumber";
import type { Receipt, ReceiptItem } from "@/types";

// Server Action backing ReceiptFormModal's save — replaces that component's
// old direct Firestore client-SDK write (a setDoc with a client-generated
// id, plus a client-side transaction to allocate the receipt number) now
// that Receipt lives in Postgres. Allocating the number server-side instead
// of exposing the counter to the client is a small bonus of the move, not
// the point of it.

export interface CreateReceiptFormFields {
  patientId: string;
  date: string;
  items: ReceiptItem[];
  amount: number;
  consultingDoctor?: string;
  visitId?: string;
  packageId?: string;
  appointmentId?: string;
  notes?: string;
  // The Session type carries only auth identity (uid/email/role), not a
  // display name — ReceiptFormModal already receives the caller's actual
  // name as a prop (resolved server-side from the staff list, one level up
  // the component tree — see e.g. app/dashboard/documents/page.tsx), so
  // it's threaded through here rather than re-deriving it.
  issuedByName: string;
}

export async function createReceiptAction(
  input: CreateReceiptFormFields
): Promise<{ receipt: Receipt } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const patient = await getPatient(session.clinicId, input.patientId);
  if (!patient) return { error: "Patient not found." };

  const currentStaffName = input.issuedByName;

  try {
    const receiptNumber = await allocateReceiptNumber(session.clinicId);
    const id = await createReceipt({
      clinicId: session.clinicId,
      patientId: patient.id,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientAge: patient.age,
      patientGender: patient.gender,
      patientAddress: patient.address,
      consultingDoctor: input.consultingDoctor,
      receiptNumber,
      date: input.date,
      items: input.items,
      amount: input.amount,
      visitId: input.visitId,
      packageId: input.packageId,
      appointmentId: input.appointmentId,
      notes: input.notes,
      issuedByUid: session.uid,
      issuedByName: currentStaffName,
    });

    const receipt: Receipt = {
      id,
      clinicId: session.clinicId,
      patientId: patient.id,
      patientName: patient.name,
      receiptNumber,
      date: input.date,
      items: input.items,
      amount: input.amount,
      issuedByUid: session.uid,
      issuedByName: currentStaffName,
      createdAt: Date.now(),
      ...(patient.phone ? { patientPhone: patient.phone } : {}),
      ...(patient.age !== undefined ? { patientAge: patient.age } : {}),
      ...(patient.gender ? { patientGender: patient.gender } : {}),
      ...(patient.address ? { patientAddress: patient.address } : {}),
      ...(input.consultingDoctor ? { consultingDoctor: input.consultingDoctor } : {}),
      ...(input.visitId ? { visitId: input.visitId } : {}),
      ...(input.packageId ? { packageId: input.packageId } : {}),
      ...(input.appointmentId ? { appointmentId: input.appointmentId } : {}),
      ...(input.notes ? { notes: input.notes } : {}),
    };
    return { receipt };
  } catch (err) {
    console.error("Failed to create receipt:", err);
    return { error: "Couldn't save this receipt. Please try again." };
  }
}

export async function deleteReceiptAction(receiptId: string): Promise<{ ok: true } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  try {
    await deleteReceipt(session.clinicId, receiptId);
    return { ok: true };
  } catch (err) {
    console.error("Failed to delete receipt:", err);
    return { error: "Couldn't delete this receipt. Please try again." };
  }
}
