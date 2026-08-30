"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import type { Patient } from "@/types";
import { loadMorePatientsAction, searchPatientsAction } from "@/app/dashboard/patients/actions";
import EmptyState from "@/components/ui/EmptyState";

const SEARCH_DEBOUNCE_MS = 300;
// Keep in sync with SEARCH_RESULT_LIMIT in lib/db/patients.ts.
const SEARCH_RESULT_LIMIT = 20;

/** Patients list with a search bar. Below a couple hundred patients this
 * would be a simple client-side filter, but a clinic's roster can grow into
 * the thousands over its lifetime, so the list is paginated ("Load more")
 * and the search bar runs a real query against the whole clinic
 * (searchPatientsAction) rather than only ever seeing whatever page happens
 * to be loaded — see lib/db/patients.ts searchPatients for how that
 * query works (name/phone/code prefix match, not substring, which is the
 * one behavior change from the old fully-client-side version of this
 * component). This is the "find a patient" entry point for the app —
 * previously a separate sidebar search modal, moved here to sit with the
 * list it searches. */
export default function PatientsTable({
  initialPatients,
  initialCursor,
}: {
  initialPatients: Patient[];
  initialCursor: string | null;
}) {
  const [query, setQuery] = useState("");
  const [browsePatients, setBrowsePatients] = useState(initialPatients);
  const [cursor, setCursor] = useState(initialCursor);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [searchResults, setSearchResults] = useState<Patient[] | null>(null);
  const [isSearchPending, setIsSearchPending] = useState(false);
  const searchRequestId = useRef(0);

  const trimmedQuery = query.trim();
  const isSearchMode = trimmedQuery.length > 0;

  useEffect(() => {
    if (!trimmedQuery) {
      setSearchResults(null);
      setIsSearchPending(false);
      return;
    }

    setIsSearchPending(true);
    const requestId = ++searchRequestId.current;

    const timer = setTimeout(async () => {
      const results = await searchPatientsAction(trimmedQuery);
      // Ignore a stale response if the query changed again while this was
      // in flight — otherwise a slower earlier request could overwrite the
      // results of a faster, more recent one.
      if (searchRequestId.current === requestId) {
        setSearchResults(results);
        setIsSearchPending(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [trimmedQuery]);

  async function handleLoadMore() {
    if (!cursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const page = await loadMorePatientsAction(cursor);
      setBrowsePatients((prev) => [...prev, ...page.patients]);
      setCursor(page.nextCursor);
    } finally {
      setIsLoadingMore(false);
    }
  }

  const displayed = isSearchMode ? searchResults ?? [] : browsePatients;
  const showNoPatientsYet = !isSearchMode && browsePatients.length === 0;
  const showNoSearchMatches = isSearchMode && !isSearchPending && displayed.length === 0;

  return (
    <div>
      <div className="mb-5 flex items-center gap-2 rounded-md border border-beige-300 bg-surface px-3 py-2.5 shadow-soft">
        <Search size={18} className="flex-shrink-0 text-brown-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, phone, or patient ID…"
          className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
        />
      </div>

      {showNoPatientsYet || showNoSearchMatches ? (
        <EmptyState
          icon={Users}
          title={showNoPatientsYet ? "No patients yet." : "No patients match that search."}
          description={showNoPatientsYet ? "Add your first patient to get started." : undefined}
          action={showNoPatientsYet ? { label: "Add your first patient", href: "/dashboard/patients/new" } : undefined}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl bg-surface shadow-soft ring-1 ring-beige-300">
            <table className="w-full min-w-[600px] text-left text-sm">
              <thead>
                <tr className="border-b border-beige-300 bg-beige-200/50 text-xs uppercase tracking-wide text-brown-600">
                  <th className="px-5 py-3 font-medium">Patient</th>
                  <th className="px-5 py-3 font-medium">Contact</th>
                  <th className="px-5 py-3 font-medium">Skin Type</th>
                  <th className="px-5 py-3 font-medium">Patient ID</th>
                </tr>
              </thead>
              <tbody>
                {displayed.map((patient) => (
                  <tr key={patient.id} className="border-b border-beige-300 last:border-0 hover:bg-gold-100/40">
                    <td className="px-5 py-3">
                      <Link
                        href={`/dashboard/patients/${patient.id}`}
                        className="font-medium text-brown-900 hover:text-gold-600"
                      >
                        {patient.name}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-brown-600">{patient.phone}</td>
                    <td className="px-5 py-3 text-brown-600">
                      {patient.skinType ? `Type ${patient.skinType}` : "—"}
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-brown-600">{patient.patientCode}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {isSearchMode ? (
            <p className="mt-3 text-center text-xs text-brown-400">
              {isSearchPending
                ? "Searching…"
                : displayed.length === SEARCH_RESULT_LIMIT
                  ? `Showing the first ${SEARCH_RESULT_LIMIT} matches — refine your search to narrow it down.`
                  : `${displayed.length} match${displayed.length === 1 ? "" : "es"}.`}
            </p>
          ) : (
            cursor && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                  className="rounded-md border border-beige-300 bg-surface px-4 py-2 text-sm font-medium text-brown-700 transition-colors hover:bg-beige-100 disabled:opacity-50"
                >
                  {isLoadingMore ? "Loading…" : "Load more"}
                </button>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}
