import "server-only";
import { FieldPath } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { Receipt } from "@/types";

const RECEIPTS_PAGE_SIZE = 25;

/** A single receipt by id, or null if it doesn't exist or belongs to
 * another clinic — used by server actions (e.g. sending a receipt over
 * WhatsApp/SMS) that only have a receiptId, not a full patient/clinic list
 * to scan. */
export async function getReceipt(clinicId: string, receiptId: string): Promise<Receipt | null> {
  const doc = await adminDb().collection("receipts").doc(receiptId).get();
  if (!doc.exists) return null;
  const receipt = { id: doc.id, ...doc.data() } as Receipt;
  return receipt.clinicId === clinicId ? receipt : null;
}

/** Receipts for one patient, newest first — same single equality-query
 * pattern as getPatientVisits/getPatientConsentForms, no composite index
 * needed. */
export async function getPatientReceipts(clinicId: string, patientId: string): Promise<Receipt[]> {
  const snap = await adminDb().collection("receipts").where("patientId", "==", patientId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Receipt)
    .filter((r) => r.clinicId === clinicId) // defense in depth
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Every receipt across the whole clinic, in one read — used by pages that
 * need to check receipts clinic-wide regardless of how many there are (the
 * Overview stats and the appointment auto-complete check in
 * app/dashboard/appointments/page.tsx). The Documents page's receipts *list*
 * uses getClinicReceiptsPage below instead, since that's the one place
 * someone scrolls through the full history growing over a clinic's
 * lifetime. */
export async function getClinicReceipts(clinicId: string): Promise<Receipt[]> {
  const snap = await adminDb().collection("receipts").where("clinicId", "==", clinicId).get();
  return snap.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as Receipt)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export interface ReceiptsPage {
  receipts: Receipt[];
  nextCursor: string | null;
}

function encodeCursor(createdAt: number, id: string): string {
  return `${createdAt}_${id}`;
}

function decodeCursor(cursor: string): [number, string] {
  const separatorIndex = cursor.lastIndexOf("_");
  return [Number(cursor.slice(0, separatorIndex)), cursor.slice(separatorIndex + 1)];
}

/**
 * One page of the clinic's receipts, newest first — backs the Documents
 * page's Receipts tab so opening it doesn't read every receipt the clinic
 * has ever issued, only the page shown. Same cursor + document-ID-tiebreak
 * pattern as getPatientsPage in lib/firestore/patients.ts (see there for
 * why the tiebreaker matters). Needs a composite index (clinicId Ascending,
 * createdAt Descending, __name__ Descending) — Firestore will prompt for it.
 *
 * The Receipts panel's search bar still only searches whatever page is
 * currently loaded, not the whole clinic — unlike the Patients list, a
 * clinic-wide receipt search would need denormalizing a lowercased patient
 * name onto Receipt for a proper prefix query, which hasn't been done here.
 */
export async function getClinicReceiptsPage(
  clinicId: string,
  opts: { cursor?: string | null; limit?: number } = {}
): Promise<ReceiptsPage> {
  const limit = opts.limit ?? RECEIPTS_PAGE_SIZE;

  let query = adminDb()
    .collection("receipts")
    .where("clinicId", "==", clinicId)
    .orderBy("createdAt", "desc")
    .orderBy(FieldPath.documentId(), "desc")
    .limit(limit);

  if (opts.cursor) {
    const [createdAt, id] = decodeCursor(opts.cursor);
    query = query.startAfter(createdAt, id);
  }

  const snap = await query.get();
  const receipts = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Receipt);

  const lastDoc = snap.docs[snap.docs.length - 1];
  const nextCursor =
    snap.docs.length === limit && lastDoc
      ? encodeCursor((lastDoc.data() as Receipt).createdAt, lastDoc.id)
      : null;

  return { receipts, nextCursor };
}
