"use server";

import { getSession } from "@/lib/session";
import { getPatient } from "@/lib/db/patients";
import { createPackage } from "@/lib/db/packages";
import type { PaymentMethod, SessionType } from "@/types";

// Server Action backing PackageFormModal's save — replaces that component's
// old direct Firestore client-SDK write now that Package lives in Postgres
// (lib/db/packages.ts), which only server code can reach.

export interface PackageFormFields {
  sessionType: SessionType;
  label: string;
  totalSessions: number;
  totalAmount: number;
  purchaseDate: string;
  expiryDate?: string;
  paymentMethod?: PaymentMethod;
}

export async function createPackageAction(
  patientId: string,
  input: PackageFormFields
): Promise<{ id: string } | { error: string }> {
  const session = await getSession();
  if (!session) return { error: "Not signed in." };

  const patient = await getPatient(session.clinicId, patientId);
  if (!patient) return { error: "Patient not found." };

  try {
    const id = await createPackage({ clinicId: session.clinicId, patientId, ...input });
    return { id };
  } catch (err) {
    console.error("Failed to create package:", err);
    return { error: "Couldn't save this package. Please try again." };
  }
}
