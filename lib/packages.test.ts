import { describe, it, expect } from "vitest";
import { computePackageLedger, perSessionValue } from "@/lib/packages";
import type { Package, Visit } from "@/types";

// Bugs here turn into billing disputes, not just UI glitches (a patient
// disagreeing about how many sessions they have left, or what a package
// is worth) — see README's "Known limitations". computePackageLedger is
// deliberately pure (derived from Visits, nothing stored), which is what
// makes it cheap to pin down exactly here without touching a database.

const BASE_PACKAGE: Package = {
  id: "pkg1",
  clinicId: "clinic1",
  patientId: "patient1",
  sessionType: "lhr",
  label: "10-Session Package",
  totalSessions: 10,
  totalAmount: 10000,
  purchaseDate: "2020-01-01",
  createdAt: 0,
};

function makeVisit(overrides: Partial<Visit>): Visit {
  return {
    id: "v",
    clinicId: "clinic1",
    patientId: "patient1",
    sessionType: "lhr",
    date: "2020-01-01",
    fields: {},
    createdAt: 0,
    ...overrides,
  };
}

describe("perSessionValue", () => {
  it("divides total amount by total sessions", () => {
    expect(perSessionValue({ ...BASE_PACKAGE, totalAmount: 10000, totalSessions: 10 })).toBe(1000);
  });

  it("returns 0 rather than dividing by zero for a 0-session package", () => {
    expect(perSessionValue({ ...BASE_PACKAGE, totalSessions: 0 })).toBe(0);
  });
});

describe("computePackageLedger", () => {
  it("is fully unused with no linked visits", () => {
    const ledger = computePackageLedger(BASE_PACKAGE, []);
    expect(ledger.sessionsUsed).toBe(0);
    expect(ledger.sessionsRemaining).toBe(10);
    expect(ledger.amountUsed).toBe(0);
    expect(ledger.amountRemaining).toBe(10000);
    expect(ledger.status).toBe("active");
    expect(ledger.entries).toHaveLength(0);
  });

  it("only counts visits actually linked to this package (by packageId)", () => {
    const visits = [
      makeVisit({ id: "v1", packageId: "pkg1" }),
      makeVisit({ id: "v2", packageId: "some-other-package" }),
      makeVisit({ id: "v3" }), // no packageId at all — a direct-pay visit
    ];
    const ledger = computePackageLedger(BASE_PACKAGE, visits);
    expect(ledger.sessionsUsed).toBe(1);
    expect(ledger.entries.map((e) => e.visitId)).toEqual(["v1"]);
  });

  it("orders entries chronologically by date regardless of input order, assigning sessionNumber accordingly", () => {
    const visits = [
      makeVisit({ id: "v-mar", packageId: "pkg1", date: "2020-03-01", createdAt: 3 }),
      makeVisit({ id: "v-jan", packageId: "pkg1", date: "2020-01-01", createdAt: 1 }),
      makeVisit({ id: "v-feb", packageId: "pkg1", date: "2020-02-01", createdAt: 2 }),
    ];
    const ledger = computePackageLedger(BASE_PACKAGE, visits);
    expect(ledger.entries.map((e) => e.visitId)).toEqual(["v-jan", "v-feb", "v-mar"]);
    expect(ledger.entries.map((e) => e.sessionNumber)).toEqual([1, 2, 3]);
  });

  it("breaks ties on the same date by createdAt", () => {
    const visits = [
      makeVisit({ id: "v-second", packageId: "pkg1", date: "2020-01-01", createdAt: 200 }),
      makeVisit({ id: "v-first", packageId: "pkg1", date: "2020-01-01", createdAt: 100 }),
    ];
    const ledger = computePackageLedger(BASE_PACKAGE, visits);
    expect(ledger.entries.map((e) => e.visitId)).toEqual(["v-first", "v-second"]);
  });

  it("computes amountUsed/amountRemaining from the actual per-session value, not a guess", () => {
    const pkg: Package = { ...BASE_PACKAGE, totalSessions: 3, totalAmount: 9999 }; // doesn't divide evenly
    const visits = [makeVisit({ id: "v1", packageId: "pkg1" }), makeVisit({ id: "v2", packageId: "pkg1" })];
    const ledger = computePackageLedger(pkg, visits);
    expect(ledger.perSession).toBeCloseTo(3333, 0);
    expect(ledger.sessionsUsed).toBe(2);
    expect(ledger.amountUsed).toBeCloseTo(6666, 0);
    // The remainder is whatever's left of the real total, not
    // perSession * sessionsRemaining (which would silently lose the
    // rounding remainder over many sessions).
    expect(ledger.amountRemaining).toBeCloseTo(9999 - ledger.amountUsed, 6);
  });

  it("is completed once every session is used, with sessionsRemaining/amountRemaining floored at 0", () => {
    const pkg: Package = { ...BASE_PACKAGE, totalSessions: 2 };
    const visits = [
      makeVisit({ id: "v1", packageId: "pkg1" }),
      makeVisit({ id: "v2", packageId: "pkg1" }),
      // A third redemption shouldn't be possible in practice, but the
      // ledger math must not go negative if it somehow happens.
      makeVisit({ id: "v3", packageId: "pkg1" }),
    ];
    const ledger = computePackageLedger(pkg, visits);
    expect(ledger.status).toBe("completed");
    expect(ledger.sessionsRemaining).toBe(0);
    expect(ledger.amountRemaining).toBe(0);
  });

  it("is expired once past its expiry date with sessions still remaining", () => {
    const pkg: Package = { ...BASE_PACKAGE, expiryDate: "2000-01-01" };
    const ledger = computePackageLedger(pkg, []);
    expect(ledger.status).toBe("expired");
  });

  it("is active when an expiry date is set but hasn't passed yet", () => {
    const pkg: Package = { ...BASE_PACKAGE, expiryDate: "2999-01-01" };
    const ledger = computePackageLedger(pkg, []);
    expect(ledger.status).toBe("active");
  });

  it("is completed rather than expired when fully used past its expiry date — using up a package should never look like a problem", () => {
    const pkg: Package = { ...BASE_PACKAGE, totalSessions: 1, expiryDate: "2000-01-01" };
    const ledger = computePackageLedger(pkg, [makeVisit({ id: "v1", packageId: "pkg1" })]);
    expect(ledger.status).toBe("completed");
  });
});
