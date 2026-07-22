"use client";

import { useMemo, useState } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { isLikelySensitiveArea } from "@/lib/patientPhotos";
import { compressImageToDataUrl } from "@/lib/imageCompression";
import type { PatientPhoto, Visit } from "@/types";

const LABEL_PRESETS = ["Before", "After", "Front", "Side", "Back", "Progress"];

function formatVisitOption(visit: Visit, label: string): string {
  const date = visit.date || "Undated";
  const area = visit.fields?.area;
  return `${date} · ${label}${area ? ` · ${area}` : ""}`;
}

export default function PatientPhotoUploadModal({
  clinicId,
  patientId,
  visits,
  currentUid,
  currentName,
  onClose,
  onUploaded,
}: {
  clinicId: string;
  patientId: string;
  visits: Visit[]; // this patient's visits, for the "link to session" picker
  currentUid: string;
  currentName: string;
  onClose: () => void;
  onUploaded: (photos: PatientPhoto[]) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();

  const sortedVisits = useMemo(
    () => [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.createdAt - a.createdAt),
    [visits]
  );

  const [files, setFiles] = useState<File[]>([]);
  const [visitId, setVisitId] = useState("");
  const [label, setLabel] = useState("");
  const [sensitive, setSensitive] = useState(false);
  const [sensitiveTouched, setSensitiveTouched] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0); // count of files processed so far
  const [error, setError] = useState<string | null>(null);

  const selectedVisit = sortedVisits.find((v) => v.id === visitId);

  function handleFilesChosen(fileList: FileList | null) {
    if (!fileList) return;
    setFiles(Array.from(fileList));
  }

  function handleVisitChange(id: string) {
    setVisitId(id);
    if (sensitiveTouched) return; // don't override an explicit manual choice
    const visit = sortedVisits.find((v) => v.id === id);
    const area = visit?.fields?.area;
    setSensitive(isLikelySensitiveArea(typeof area === "string" ? area : undefined));
  }

  function handleSensitiveChange(value: boolean) {
    setSensitiveTouched(true);
    setSensitive(value);
  }

  async function handleUpload() {
    if (files.length === 0) return setError("Choose at least one photo.");

    setUploading(true);
    setError(null);
    setProgress(0);

    const area = typeof selectedVisit?.fields?.area === "string" ? selectedVisit.fields.area : undefined;

    try {
      const uploaded: PatientPhoto[] = [];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const id = crypto.randomUUID();
        const dataUrl = await compressImageToDataUrl(file);

        const payload = {
          clinicId,
          patientId,
          ...(visitId ? { visitId } : {}),
          ...(selectedVisit ? { sessionType: selectedVisit.sessionType } : {}),
          ...(area ? { area } : {}),
          ...(selectedVisit?.date ? { date: selectedVisit.date } : {}),
          dataUrl,
          ...(label ? { label } : {}),
          sensitive,
          uploadedByUid: currentUid,
          uploadedByName: currentName,
          createdAt: Date.now(),
        };
        await setDoc(doc(db, "patientPhotos", id), payload);
        uploaded.push({ id, ...payload });
        setProgress(i + 1);
      }
      onUploaded(uploaded);
    } catch (err) {
      console.error("Failed to upload photo:", err);
      const code = (err as { code?: string })?.code;
      setError(
        code === "permission-denied"
          ? "You don't have permission to save this. Check that Firestore rules are deployed and try signing in again."
          : "Couldn't save one or more photos. Please try again."
      );
      setUploading(false);
      return;
    }
    setUploading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-6 shadow-card">
        <h2 className="font-display text-lg font-medium text-brown-900">Add Photos</h2>
        <div className="mb-5 mt-3 h-[2px] w-8 bg-gold-500" />

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Photos</label>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => handleFilesChosen(e.target.files)}
              className="block w-full text-sm text-brown-700 file:mr-3 file:rounded-md file:border-0 file:bg-brown-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-beige-200 hover:file:bg-gold-600"
            />
            {files.length > 0 && (
              <div className="mt-3 grid grid-cols-4 gap-2">
                {files.map((f, i) => (
                  <div
                    key={i}
                    className="aspect-square overflow-hidden rounded-md border border-beige-300 bg-canvas"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- local blob preview, not a remote asset */}
                    <img
                      src={URL.createObjectURL(f)}
                      alt={f.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Link to Session <span className="text-brown-400">(optional)</span>
            </label>
            <select
              value={visitId}
              onChange={(e) => handleVisitChange(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            >
              <option value="">No specific session</option>
              {sortedVisits.map((v) => (
                <option key={v.id} value={v.id}>
                  {formatVisitOption(v, SESSION_TYPE_CONFIG[v.sessionType]?.label || v.sessionType)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">
              Label <span className="text-brown-400">(optional)</span>
            </label>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {LABEL_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setLabel(preset)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    label === preset
                      ? "bg-brown-900 text-beige-200"
                      : "bg-beige-200 text-brown-600 hover:bg-beige-300"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Front, Before"
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>

          <label className="flex items-start gap-2.5 rounded-lg border border-beige-300 px-3 py-2.5">
            <input
              type="checkbox"
              checked={sensitive}
              onChange={(e) => handleSensitiveChange(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-gold-600"
            />
            <span className="text-sm text-brown-700">
              Sensitive area
              <span className="block text-xs text-brown-400">
                Blurred by default in the gallery until someone clicks to reveal it. Pre-checked
                automatically for areas like underarms or bikini — adjust if needed.
              </span>
            </span>
          </label>
        </div>

        {uploading && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
              <div
                className="h-full rounded-full bg-gold-500 transition-all"
                style={{ width: `${Math.round((progress / files.length) * 100)}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-brown-400">
              Saving… {progress} of {files.length}
            </p>
          </div>
        )}

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={uploading}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploading || files.length === 0}
            className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
          >
            {uploading ? "Uploading…" : `Upload ${files.length || ""}`.trim()}
          </button>
        </div>
      </div>
    </div>
  );
}
