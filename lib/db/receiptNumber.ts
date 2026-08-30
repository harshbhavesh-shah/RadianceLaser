import "server-only";
import { prisma } from "@/lib/db/client";

// Postgres replacement for lib/receiptNumber.ts (now unused) — same
// contract: allocates sequential, never-reused receipt numbers per clinic.
// The Firestore version used a transaction against a per-clinic counter
// doc; this uses a single INSERT ... ON CONFLICT DO UPDATE ... RETURNING
// statement against ReceiptCounter, which Postgres executes atomically on
// its own — no explicit transaction needed, and no risk of two staff
// members issuing receipts at the same moment colliding on the same
// number.

const RECEIPT_NUMBER_PAD = 6;

export function formatReceiptNumber(n: number): string {
  return `RCPT-${String(n).padStart(RECEIPT_NUMBER_PAD, "0")}`;
}

export async function allocateReceiptNumber(clinicId: string): Promise<string> {
  const rows = await prisma.$queryRaw<{ value: number }[]>`
    INSERT INTO "receipt_counters" ("clinicId", "value")
    VALUES (${clinicId}, 1)
    ON CONFLICT ("clinicId") DO UPDATE SET "value" = "receipt_counters"."value" + 1
    RETURNING "value"
  `;
  return formatReceiptNumber(rows[0].value);
}
