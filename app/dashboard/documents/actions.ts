"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicReceiptsPage, searchClinicReceipts, type ReceiptsPage } from "@/lib/db/receipts";
import { getClinicConsentFormsPage, searchClinicConsentForms, type ConsentFormsPage } from "@/lib/db/consentForms";
import type { ConsentForm, Receipt } from "@/types";

/** Called from ReceiptsPanel's "Load more" button — see
 * lib/db/receipts.ts getClinicReceiptsPage. */
export async function loadMoreReceiptsAction(cursor: string): Promise<ReceiptsPage> {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");
  return getClinicReceiptsPage(session.clinicId, { cursor });
}

/** Called from ConsentFormsPanel's "Load more" button — see
 * lib/db/consentForms.ts getClinicConsentFormsPage. */
export async function loadMoreConsentFormsAction(cursor: string): Promise<ConsentFormsPage> {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");
  return getClinicConsentFormsPage(session.clinicId, { cursor });
}

/** Called from ReceiptsPanel's search box once there's a query — searches
 * the clinic's entire receipt history by patient name or receipt number,
 * not just whatever page is currently loaded (see
 * lib/db/receipts.ts searchClinicReceipts). */
export async function searchReceiptsAction(query: string): Promise<Receipt[]> {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");
  return searchClinicReceipts(session.clinicId, query);
}

/** Called from ConsentFormsPanel's search box once there's a query — same
 * whole-clinic reasoning as searchReceiptsAction above. */
export async function searchConsentFormsAction(query: string): Promise<ConsentForm[]> {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");
  return searchClinicConsentForms(session.clinicId, query);
}
