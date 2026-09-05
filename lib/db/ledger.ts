import "server-only";
import { prisma } from "@/lib/db/client";
import type { LedgerEntry as PrismaLedgerEntryRow } from "@prisma/client";
import type { LedgerEntry, LedgerEntryType } from "@/types";

// Radiance Laser's own bookkeeping — see prisma/schema.prisma's LedgerEntry
// comment. Platform-wide, no clinicId; only reachable from /admin/ledger.

function toLedgerEntry(row: PrismaLedgerEntryRow): LedgerEntry {
  return {
    id: row.id,
    type: row.type as LedgerEntryType,
    amountInr: row.amountInr,
    description: row.description,
    date: row.date,
    createdAt: Number(row.createdAt),
    ...(row.createdByEmail ? { createdByEmail: row.createdByEmail } : {}),
  };
}

/** Newest-dated entry first — same-day entries then break ties by
 * createdAt so today's freshly-added rows land above older same-day ones. */
export async function getLedgerEntries(): Promise<LedgerEntry[]> {
  const rows = await prisma.ledgerEntry.findMany({
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toLedgerEntry);
}

export interface CreateLedgerEntryInput {
  type: LedgerEntryType;
  amountInr: number;
  description: string;
  date: string;
  createdByEmail?: string;
}

export async function createLedgerEntry(input: CreateLedgerEntryInput): Promise<LedgerEntry> {
  const row = await prisma.ledgerEntry.create({
    data: {
      type: input.type,
      amountInr: input.amountInr,
      description: input.description,
      date: input.date,
      createdByEmail: input.createdByEmail ?? null,
      createdAt: BigInt(Date.now()),
    },
  });
  return toLedgerEntry(row);
}

export async function deleteLedgerEntry(id: string): Promise<void> {
  await prisma.ledgerEntry.delete({ where: { id } });
}
