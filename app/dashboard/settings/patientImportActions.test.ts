import { afterAll, describe, expect, it, vi } from "vitest";
import { prisma } from "@/lib/db/client";
import { importPatientsAction } from "./patientImportActions";
import type { ImportPatientRow } from "@/lib/patientImport";
import type { Session } from "@/types";

// The pure column-mapping/validation logic in lib/patientImport.ts is
// already unit-tested; this covers what that logic feeds into — the actual
// Postgres writes, duplicate detection against real existing patients, and
// the skip vs. replace behavior — the exact path a clinic migrating their
// patient list actually runs through. Real Postgres on purpose, same
// reasoning as lib/db/receiptNumber.test.ts: a mocked Prisma client would
// only prove the mock behaves correctly, not the duplicate-detection query.
const TEST_CLINIC_ID = `_test_patient_import_${Date.now()}`;

let mockSession: Session | null = null;
vi.mock("@/lib/session", () => ({
  getSession: () => Promise.resolve(mockSession),
}));

function ownerSession(): Session {
  return {
    uid: "_test_owner_uid",
    clinicId: TEST_CLINIC_ID,
    role: "owner",
    email: "owner@example.com",
    isSuperAdmin: false,
  };
}

function row(overrides: Partial<ImportPatientRow> = {}): ImportPatientRow {
  return { name: "Jane Doe", phone: "9876543210", ...overrides };
}

describe("importPatientsAction (integration, real Postgres)", () => {
  afterAll(async () => {
    await prisma.patient.deleteMany({ where: { clinicId: TEST_CLINIC_ID } });
  });

  it("rejects when not signed in", async () => {
    mockSession = null;
    const result = await importPatientsAction([row()]);
    expect(result).toEqual({
      imported: 0,
      updated: 0,
      skippedDuplicates: 0,
      failed: 1,
      errorSamples: ["Not signed in."],
    });
  });

  it("rejects a non-owner role", async () => {
    mockSession = { ...ownerSession(), role: "reception" };
    const result = await importPatientsAction([row()]);
    expect(result.failed).toBe(1);
    expect(result.errorSamples[0]).toMatch(/only the clinic owner/i);
  });

  it("creates new patients and writes rows visible in a real query", async () => {
    mockSession = ownerSession();
    const result = await importPatientsAction([
      row({ name: "Asha Rao", phone: "9000000001" }),
      row({ name: "Vikram Shah", phone: "9000000002" }),
    ]);
    expect(result).toMatchObject({ imported: 2, updated: 0, skippedDuplicates: 0, failed: 0 });

    const saved = await prisma.patient.findMany({ where: { clinicId: TEST_CLINIC_ID } });
    expect(saved.map((p) => p.phone).sort()).toEqual(["9000000001", "9000000002"]);
  });

  it("skips a duplicate phone number by default, leaving the existing record untouched", async () => {
    mockSession = ownerSession();
    const result = await importPatientsAction([row({ name: "Asha Rao (renamed)", phone: "9000000001" })]);
    expect(result).toMatchObject({ imported: 0, updated: 0, skippedDuplicates: 1, failed: 0 });

    const existing = await prisma.patient.findFirst({ where: { clinicId: TEST_CLINIC_ID, phone: "9000000001" } });
    expect(existing?.name).toBe("Asha Rao");
  });

  it("overwrites a duplicate when duplicateAction is 'replace'", async () => {
    mockSession = ownerSession();
    const result = await importPatientsAction(
      [row({ name: "Asha Rao Updated", phone: "9000000001", age: 41 })],
      "replace"
    );
    expect(result).toMatchObject({ imported: 0, updated: 1, skippedDuplicates: 0, failed: 0 });

    const existing = await prisma.patient.findFirst({ where: { clinicId: TEST_CLINIC_ID, phone: "9000000001" } });
    expect(existing?.name).toBe("Asha Rao Updated");
    expect(existing?.age).toBe(41);
  });

  it("treats two rows in the same file with the same phone number as duplicates of each other", async () => {
    mockSession = ownerSession();
    const result = await importPatientsAction([
      row({ name: "First Of Pair", phone: "9000000099" }),
      row({ name: "Second Of Pair", phone: "9000000099" }),
    ]);
    // First row creates the patient; the second, processed in the same
    // batch, must see it as already-seen rather than creating a duplicate
    // Patient row for the same phone number.
    expect(result.imported).toBe(1);
    expect(result.skippedDuplicates).toBe(1);

    const matches = await prisma.patient.findMany({ where: { clinicId: TEST_CLINIC_ID, phone: "9000000099" } });
    expect(matches).toHaveLength(1);
  });
});
