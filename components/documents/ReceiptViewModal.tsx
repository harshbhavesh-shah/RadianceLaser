"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Printer, X } from "lucide-react";
import { db } from "@/lib/firebase/client";
import type { Receipt } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString("en-GB"); // DD/MM/YYYY, matches the clinic's paper receipt format
}

function ageGenderLabel(age?: number, gender?: string): string {
  const parts = [age !== undefined ? `${age}Y` : null, gender || null].filter(Boolean);
  return parts.length ? parts.join(" ") : "—";
}

export default function ReceiptViewModal({
  receipt,
  clinicName,
  clinicAddress,
  onClose,
  onDeleted,
}: {
  receipt: Receipt;
  clinicName: string;
  clinicAddress?: string;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Delete receipt ${receipt.receiptNumber}? This can't be undone.`)) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "receipts", receipt.id));
      onDeleted(receipt.id);
    } catch (err) {
      console.error("Failed to delete receipt:", err);
      setError("Couldn't delete this receipt. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4 print:static print:block print:bg-white print:px-0">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface shadow-card print:max-h-none print:w-auto print:max-w-none print:overflow-visible print:rounded-none print:shadow-none">
        <div className="flex items-center justify-between border-b border-beige-300 px-6 py-4 print:hidden">
          <div>
            <h2 className="font-display text-lg font-medium text-brown-900">{receipt.receiptNumber}</h2>
            <p className="mt-0.5 text-xs text-brown-400">{receipt.patientName}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => window.print()}
              className="rounded-md p-1.5 text-brown-600 hover:bg-beige-200"
              aria-label="Print"
              title="Print"
            >
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="rounded-md p-1.5 text-brown-600 hover:bg-beige-200" aria-label="Close">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* The receipt itself — styled as a standalone printable document,
            not just a modal body, so it looks right both on screen and on
            paper. Only this block prints (see .print-area in globals.css). */}
        <div className="print-area bg-white px-8 py-8 print:px-10 print:py-10">
          <div className="text-center">
            <h1 className="font-display text-3xl font-medium text-brown-900">{clinicName}</h1>
            {clinicAddress && <p className="mt-1.5 text-sm text-brown-600">{clinicAddress}</p>}
          </div>

          <div className="mt-6 text-center">
            <h2 className="inline-block border-y-2 border-gold-500 px-6 py-1.5 font-display text-xl font-medium text-brown-900">
              OPD Receipt
            </h2>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-x-6 gap-y-1.5 border-b border-brown-900/70 pb-4 text-sm sm:grid-cols-3">
            <div className="text-brown-800">
              <span className="text-brown-500">Name:</span> {receipt.patientName}
            </div>
            <div className="text-brown-800">
              <span className="text-brown-500">Age &amp; Gender:</span>{" "}
              {ageGenderLabel(receipt.patientAge, receipt.patientGender)}
            </div>
            <div className="text-brown-800 sm:text-right">
              <span className="text-brown-500">Date:</span> {formatDate(receipt.date)}
            </div>
            <div className="text-brown-800">
              <span className="text-brown-500">Contact number:</span> {receipt.patientPhone || "—"}
            </div>
            <div className="text-brown-800">
              <span className="text-brown-500">Address:</span> {receipt.patientAddress || "—"}
            </div>
            <div className="text-brown-800 sm:text-right">
              <span className="text-brown-500">Invoice:</span> {receipt.receiptNumber}
            </div>
          </div>

          {receipt.consultingDoctor && (
            <div className="mt-3 text-sm text-brown-800">
              <span className="text-brown-500">Consulting doctor:</span> {receipt.consultingDoctor}
            </div>
          )}

          <div className="mt-5 overflow-hidden rounded-md border border-brown-900/20">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="bg-gold-100 text-xs uppercase tracking-wide text-brown-700">
                  <th className="w-10 px-3 py-2 font-semibold">#</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 text-right font-semibold">Price</th>
                  <th className="px-3 py-2 text-right font-semibold">Discount</th>
                </tr>
              </thead>
              <tbody>
                {receipt.items.map((item, i) => (
                  <tr key={i} className="border-t border-brown-900/10">
                    <td className="px-3 py-2 text-brown-600">{i + 1}</td>
                    <td className="px-3 py-2 text-brown-900">{item.description}</td>
                    <td className="px-3 py-2 text-right text-brown-800">{formatCurrency(item.amount)}</td>
                    <td className="px-3 py-2 text-right text-brown-800">
                      {item.discount ? formatCurrency(item.discount) : "0"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex justify-end">
            <div className="text-right">
              <div className="border-b border-brown-900 pb-1 text-sm font-medium uppercase tracking-wide text-brown-600">
                Grand Total
              </div>
              <div className="mt-1 font-display text-2xl font-medium text-brown-900">
                {formatCurrency(receipt.amount)}
              </div>
            </div>
          </div>

          {receipt.notes && <p className="mt-5 text-sm text-brown-600">Note: {receipt.notes}</p>}

          <p className="mt-8 text-center text-xs text-brown-400">Issued by {receipt.issuedByName}</p>
        </div>

        {error && <p className="px-6 pb-2 text-sm text-red-700 print:hidden">{error}</p>}

        <div className="flex justify-end border-t border-beige-300 px-6 py-4 print:hidden">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Receipt"}
          </button>
        </div>
      </div>
    </div>
  );
}
