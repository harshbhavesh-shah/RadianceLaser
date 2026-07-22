// Allocates sequential, never-reused receipt numbers per clinic. Runs on the
// client (same pattern as the rest of the receipts/consent-forms/photos
// features — direct Firestore client SDK writes, no server actions) using a
// transaction against a per-clinic counter document in the `counters`
// collection (already covered by firestore.rules), so two staff members
// issuing receipts at the same moment can never collide on the same number.
import { doc, runTransaction } from "firebase/firestore";
import { db } from "@/lib/firebase/client";

const RECEIPT_NUMBER_PAD = 6;

export function formatReceiptNumber(n: number): string {
  return `RCPT-${String(n).padStart(RECEIPT_NUMBER_PAD, "0")}`;
}

/** Atomically increments and returns this clinic's next receipt sequence
 * number, formatted as e.g. "RCPT-000123". Creates the counter doc on first
 * use, starting at 1. */
export async function allocateReceiptNumber(clinicId: string): Promise<string> {
  const counterRef = doc(db, "counters", `${clinicId}_receipts`);

  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(counterRef);
    const current = snap.exists() ? ((snap.data().value as number) ?? 0) : 0;
    const value = current + 1;
    tx.set(counterRef, { clinicId, value }, { merge: true });
    return value;
  });

  return formatReceiptNumber(next);
}
