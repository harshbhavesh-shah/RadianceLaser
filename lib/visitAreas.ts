// A Visit can log multiple treated areas in one session (e.g. Chin + Upper
// Lips, each with its own HP/Eng/Pass/Repeat/Fee) — see VisitAreaEntry in
// types/index.ts. Every other part of the app (receipts, analytics, the
// photo gallery, consent forms, the package ledger) only ever reads the
// single flat `visit.fields` object, so instead of teaching all of those
// about `areas` too, a multi-area visit keeps `fields` populated as a
// computed rollup of its `areas`. This is the one place that rollup is
// computed, so the "how do N areas collapse into one fields object" rule
// lives in exactly one spot.

import type { SessionColumnDef } from "@/types";

/** Combines N per-area field-sets (from the multi-area visit form) into the
 * single flat `fields` object every other reader expects:
 *  - "area" (or any other text/select column): every distinct non-empty
 *    value across areas, joined with ", " — e.g. "Chin, Upper Lips".
 *  - "fee" (or any other number column): summed across areas — a receipt or
 *    revenue chart reading `fields.fee` should see the whole session's cost,
 *    not just one area's.
 * An empty `areaFields` array rolls up to `{}`. */
export function rollupAreaFields(
  areaFields: Record<string, string | number>[],
  columns: SessionColumnDef[]
): Record<string, string | number> {
  const rollup: Record<string, string | number> = {};

  for (const col of columns) {
    const values = areaFields
      .map((f) => f[col.key])
      .filter((v) => v !== undefined && v !== null && v !== "");

    if (values.length === 0) continue;

    if (col.type === "number") {
      rollup[col.key] = values.reduce((sum: number, v) => sum + (Number(v) || 0), 0);
    } else {
      const distinct = Array.from(new Set(values.map((v) => String(v))));
      rollup[col.key] = distinct.join(", ");
    }
  }

  return rollup;
}
