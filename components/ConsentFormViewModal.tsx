"use client";

import { useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Printer, X } from "lucide-react";
import { db } from "@/lib/firebase/client";
import type { ConsentForm } from "@/types";

function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString("en-US", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function ConsentFormViewModal({
  form,
  onClose,
  onDeleted,
}: {
  form: ConsentForm;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm("Delete this signed consent form? This can't be undone.")) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteDoc(doc(db, "consentForms", form.id));
      onDeleted(form.id);
    } catch (err) {
      console.error("Failed to delete consent form:", err);
      setError("Couldn't delete this form. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4 print:static print:block print:bg-white print:px-0">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface p-6 shadow-card print:max-h-none print:w-auto print:max-w-none print:overflow-visible print:rounded-none print:p-0 print:shadow-none">
        <div className="print-consent print-area">
          <div className="mb-4 flex items-start justify-between print:hidden">
            <div>
              <h2 className="font-display text-lg font-medium text-brown-900">{form.templateTitle}</h2>
              <p className="mt-0.5 text-xs text-brown-400">
                Signed {formatDateTime(form.signedAt)}
                {form.witnessName && ` · witnessed by ${form.witnessName}`}
              </p>
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
              <button
                onClick={onClose}
                className="rounded-md p-1.5 text-brown-600 hover:bg-beige-200"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          <div className="hidden print:mb-6 print:block">
            <h1 className="font-display text-xl font-medium text-brown-900">{form.templateTitle}</h1>
            <p className="mt-1 text-sm text-brown-600">Signed {formatDateTime(form.signedAt)}</p>
          </div>

          <div className="whitespace-pre-wrap rounded-md border border-beige-300 bg-canvas px-4 py-3 text-sm leading-relaxed text-brown-800 print:border-0 print:bg-white print:px-0 print:py-0">
            {form.renderedBody}
          </div>

          <div className="mt-5">
            <div className="text-xs font-medium uppercase tracking-wide text-brown-400">
              Signed by {form.signedByName}
            </div>
            <div className="mt-2 overflow-hidden rounded-md border border-beige-300 bg-white p-2 print:border-brown-400">
              {/* eslint-disable-next-line @next/next/no-img-element -- embedded base64 data URL, not a remote asset */}
              <img src={form.signatureDataUrl} alt={`Signature of ${form.signedByName}`} className="h-24 object-contain" />
            </div>
            {form.witnessName && (
              <p className="mt-2 text-xs text-brown-400">Witnessed by {form.witnessName}</p>
            )}
          </div>
        </div>

        {error && <p className="mt-4 text-sm text-red-700 print:hidden">{error}</p>}

        <div className="mt-6 flex justify-end print:hidden">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
          >
            {deleting ? "Deleting…" : "Delete Signed Form"}
          </button>
        </div>
      </div>
    </div>
  );
}
