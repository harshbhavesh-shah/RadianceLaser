"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/session";
import { createLedgerEntry, deleteLedgerEntry } from "@/lib/db/ledger";
import type { AdminSession, LedgerEntry, LedgerEntryType } from "@/types";

async function requireSuperAdmin(): Promise<AdminSession> {
  const session = await getAdminSession();
  if (!session) throw new Error("Not authorized.");
  return session;
}

export interface LedgerActionResult {
  entry?: LedgerEntry;
  error?: string;
}

export async function createLedgerEntryAction(input: {
  type: LedgerEntryType;
  amountInr: number;
  description: string;
  date: string;
}): Promise<LedgerActionResult> {
  try {
    const session = await requireSuperAdmin();

    if (!Number.isFinite(input.amountInr) || input.amountInr <= 0) {
      return { error: "Enter a positive amount." };
    }
    if (!input.description.trim()) {
      return { error: "Enter a description." };
    }
    if (!input.date) {
      return { error: "Pick a date." };
    }

    const entry = await createLedgerEntry({
      type: input.type,
      amountInr: Math.round(input.amountInr),
      description: input.description.trim(),
      date: input.date,
      createdByEmail: session.email || undefined,
    });
    revalidatePath("/admin/ledger");
    return { entry };
  } catch (err) {
    console.error("Failed to create ledger entry:", err);
    return { error: "Couldn't save this entry. Please try again." };
  }
}

export async function deleteLedgerEntryAction(id: string): Promise<{ error?: string }> {
  try {
    await requireSuperAdmin();
    await deleteLedgerEntry(id);
    revalidatePath("/admin/ledger");
    return {};
  } catch (err) {
    console.error("Failed to delete ledger entry:", err);
    return { error: "Couldn't delete this entry. Please try again." };
  }
}
