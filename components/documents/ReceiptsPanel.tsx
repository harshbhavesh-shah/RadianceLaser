"use client";

import { useMemo, useState } from "react";
import { Receipt as ReceiptIcon, Search } from "lucide-react";
import PatientPicker from "./PatientPicker";
import ReceiptFormModal from "./ReceiptFormModal";
import ReceiptViewModal from "./ReceiptViewModal";
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

export default function ReceiptsPanel({
  clinicId,
  clinicName,
  clinicAddress,
  patients,
  visits,
  packages,
  initialReceipts,
  currentUid,
  currentName,
  autoOpenPatientId,
  autoAddVisitId,
}: {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  patients: Patient[];
  visits: Visit[];
  packages: Package[];
  initialReceipts: Receipt[];
  currentUid: string;
  currentName: string;
  // Set by the "Generate Receipt" deep link from an appointment (see
  // app/dashboard/documents/page.tsx) — skips the patient picker and jumps
  // straight into the receipt form with that visit pre-added.
  autoOpenPatientId?: string;
  autoAddVisitId?: string;
}) {
  const [receipts, setReceipts] = useState<Receipt[]>(initialReceipts);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [billingPatient, setBillingPatient] = useState<Patient | null>(
    () => patients.find((p) => p.id === autoOpenPatientId) || null
  );
  const [viewingReceipt, setViewingReceipt] = useState<Receipt | null>(null);
  const [search, setSearch] = useState("");

  const filteredReceipts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const sorted = [...receipts].sort((a, b) => b.createdAt - a.createdAt);
    if (!q) return sorted;
    return sorted.filter(
      (r) => r.patientName.toLowerCase().includes(q) || r.receiptNumber.toLowerCase().includes(q)
    );
  }, [receipts, search]);

  function handleCreated(receipt: Receipt) {
    setReceipts((prev) => [receipt, ...prev]);
    setBillingPatient(null);
    setViewingReceipt(receipt);
  }

  function handleDeleted(id: string) {
    setReceipts((prev) => prev.filter((r) => r.id !== id));
    setViewingReceipt(null);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Receipts</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Patient-wise receipts, auto-filled from logged sessions or packages.
          </p>
        </div>
        <button
          onClick={() => setPickerOpen(true)}
          className="flex-shrink-0 rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
        >
          + New Receipt
        </button>
      </div>

      {receipts.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-beige-300 bg-canvas px-3 py-2">
          <Search size={16} className="text-brown-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by patient or receipt number…"
            className="w-full bg-transparent text-sm text-brown-900 outline-none placeholder:text-brown-400"
          />
        </div>
      )}

      {filteredReceipts.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-8 text-center">
          <ReceiptIcon className="text-brown-400" size={26} />
          <p className="mt-2 text-sm text-brown-400">
            {receipts.length === 0 ? "No receipts generated yet." : "No receipts match that search."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredReceipts.map((r, i) => (
            <button
              key={r.id}
              onClick={() => setViewingReceipt(r)}
              style={{ animationDelay: `${i * 30}ms` }}
              className="animate-fade-up flex w-full items-center justify-between gap-3 rounded-lg border border-beige-300 px-4 py-3 text-left transition-colors hover:bg-gold-100/40"
            >
              <div>
                <div className="text-sm font-medium text-brown-900">{r.patientName}</div>
                <div className="text-xs text-brown-400">
                  {r.receiptNumber} · {formatDate(r.date)}
                </div>
              </div>
              <span className="font-display text-sm font-medium text-brown-900">{formatCurrency(r.amount)}</span>
            </button>
          ))}
        </div>
      )}

      {pickerOpen && (
        <PatientPicker
          patients={patients}
          title="Choose a patient"
          onClose={() => setPickerOpen(false)}
          onSelect={(p) => {
            setPickerOpen(false);
            setBillingPatient(p);
          }}
        />
      )}

      {billingPatient && (
        <ReceiptFormModal
          clinicId={clinicId}
          patient={billingPatient}
          visits={visits.filter((v) => v.patientId === billingPatient.id)}
          packages={packages.filter((p) => p.patientId === billingPatient.id)}
          currentUid={currentUid}
          currentName={currentName}
          autoAddVisitId={billingPatient.id === autoOpenPatientId ? autoAddVisitId : undefined}
          onClose={() => setBillingPatient(null)}
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
