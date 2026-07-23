"use client";

import { useState } from "react";
import { Receipt as ReceiptIcon } from "lucide-react";
import ReceiptFormModal from "@/components/documents/ReceiptFormModal";
import ReceiptViewModal from "@/components/documents/ReceiptViewModal";
import type { Package, Patient, Receipt, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** This patient's receipts, right on their own record — the other end of
 * the same pipeline that starts with "Log Visit" on an appointment (see
 * lib/pipeline.ts). The clinic-wide list of every receipt still lives in
 * Documents; this is just this one patient's slice of it. */
export default function PatientReceipts({
  clinicId,
  clinicName,
  clinicAddress,
  patient,
  visits,
  packages,
  initialReceipts,
  currentUid,
  currentName,
}: {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  patient: Patient;
  visits: Visit[];
  packages: Package[];
  initialReceipts: Receipt[];
  currentUid: string;
  currentName: string;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [formOpen, setFormOpen] = useState(false);
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);

  function handleCreated(receipt: Receipt) {
    setReceipts((prev) => [receipt, ...prev]);
    setFormOpen(false);
  }

  function handleDeleted(id: string) {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    setViewingReceipt(null);
  }

  const sorted = [...receipts].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Receipts</h2>
          <p className="mt-0.5 text-xs text-brown-400">Billing history for this patient.</p>
        </div>
        <button
          onClick={() => setFormOpen(true)}
          className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + New Receipt
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-8 text-center">
          <ReceiptIcon className="text-brown-400" size={26} />
          <p className="mt-2 text-sm text-brown-400">No receipts generated yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sorted.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setViewingReceipt(r)}
              style={{ animationDelay: `${i * 30}ms` }}
              className="animate-fade-up flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors hover:bg-gold-100/40"
            >
              <div>
                <div className="text-sm font-medium text-brown-900">{r.receiptNumber}</div>
                <div className="text-xs text-brown-400">{formatDate(r.date)}</div>
              </div>
              <span className="font-display text-sm font-medium text-brown-900">{formatCurrency(r.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {formOpen && (
        <ReceiptFormModal
          clinicId={clinicId}
          patient={patient}
          visits={visits}
          packages={packages}
          currentUid={currentUid}
          currentName={currentName}
          onClose={() => setFormOpen(false)}
          onCreated={handleCreated}
        />
      )}

      {viewingReceipt && (
        <ReceiptViewModal
          receipt={viewingReceipt}
          clinicName={clinicName}
          clinicAddress={clinicAddress}
          onClose={() => setViewingReceipt(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
