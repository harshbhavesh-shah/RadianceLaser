"use server";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getPatientsPage, searchPatients, type PatientsPage } from "@/lib/db/patients";
import type { Patient } from "@/types";

/** Fetches the next page of the clinic's patient roster — see
 * lib/db/patients.ts getPatientsPage. Called from PatientsTable's
 * "Load more" button. */
export async function loadMorePatientsAction(cursor: string): Promise<PatientsPage> {
  const session = await getSession();
  if (!session) redirect("/login");
  return getPatientsPage(session.clinicId, { cursor });
}

/** Runs a search across the whole clinic roster (not just whatever page is
 * currently loaded) — see lib/db/patients.ts searchPatients. Called
 * from PatientsTable as the user types in the search bar. */
export async function searchPatientsAction(query: string): Promise<Patient[]> {
  const session = await getSession();
  if (!session) redirect("/login");
  return searchPatients(session.clinicId, query);
}
