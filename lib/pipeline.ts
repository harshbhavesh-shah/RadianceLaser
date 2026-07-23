// The patient pipeline, end to end: Booked → (visit logged) → (receipt
// generated) → Completed. Nobody has to remember to flip an appointment's
// status by hand for the common path — once both a Visit and a Receipt
// exist for the same appointment, it's done. Deliberately client-side
// (same pattern as the rest of the app's direct Firestore writes) and
// best-effort: if this silently fails, the appointment just stays in its
// current status and staff can still mark it complete from Schedule.
import { collection, doc, getDocs, limit, query, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

export async function maybeAutoCompleteAppointment(appointmentId: string): Promise<void> {
  try {
    const [visitSnap, receiptSnap] = await Promise.all([
      getDocs(query(collection(db, "visits"), where("appointmentId", "==", appointmentId), limit(1))),
      getDocs(query(collection(db, "receipts"), where("appointmentId", "==", appointmentId), limit(1))),
    ]);
    if (!visitSnap.empty && !receiptSnap.empty) {
      await updateDoc(doc(db, "appointments", appointmentId), { status: "completed" });
    }
  } catch (err) {
    console.error("Failed to check appointment auto-complete:", err);
  }
}
