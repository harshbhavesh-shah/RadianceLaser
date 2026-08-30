"use server";

// The patient pipeline, end to end: Booked → (visit logged) → (receipt
// generated) → Completed. Nobody has to remember to flip an appointment's
// status by hand for the common path — once both a Visit and a Receipt
// exist for the same appointment, it's done. Best-effort: if this silently
// fails, the appointment just stays in its current status and staff can
// still mark it complete from Schedule.
//
// A Server Action (not a plain client-side helper) because Visit/Receipt/
// Appointment all now live in Postgres (lib/db/*.ts) rather than
// Firestore — only server code can query them via Prisma. Call sites
// (VisitFormModal, ReceiptFormModal) are unchanged: Next.js turns an
// exported "use server" function into an RPC the client can still call
// directly as `void maybeAutoCompleteAppointment(id)`.
import { prisma } from "@/lib/db/client";
import { updateAppointmentStatus } from "@/lib/db/appointments";

export async function maybeAutoCompleteAppointment(appointmentId: string): Promise<void> {
  try {
    const [visit, receipt] = await Promise.all([
      prisma.visit.findFirst({ where: { appointmentId }, select: { id: true } }),
      prisma.receipt.findFirst({ where: { appointmentId }, select: { id: true } }),
    ]);
    if (visit && receipt) {
      await updateAppointmentStatus(appointmentId, "completed");
    }
  } catch (err) {
    console.error("Failed to check appointment auto-complete:", err);
  }
}
