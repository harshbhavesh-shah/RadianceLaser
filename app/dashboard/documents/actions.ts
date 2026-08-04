"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicReceiptsPage, type ReceiptsPage } from "@/lib/firestore/receipts";
import { getClinicConsentFormsPage, type ConsentFormsPage } from "@/lib/firestore/consentForms";

/** Called from ReceiptsPanel's "Load more" button — see
 * lib/firestore/receipts.ts getClinicReceiptsPage. */
export async function loadMoreReceiptsAction(cursor: string): Promise<ReceiptsPage> {
  const session = await getSession();
  if (!session) redirect("/login");
  return getClinicReceiptsPage(session.clinicId, { cursor });
}

/** Called from ConsentFormsPanel's "Load more" button — see
 * lib/firestore/consentForms.ts getClinicConsentFormsPage. */
export async function loadMoreConsentFormsAction(cursor: string): Promise<ConsentFormsPage> {
  const session = await getSession();
  if (!session) redirect("/login");
  return getClinicConsentFormsPage(session.clinicId, { cursor });
}
