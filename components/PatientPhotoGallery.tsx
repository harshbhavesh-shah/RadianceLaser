"use client";

import { useMemo, useState } from "react";
import { deleteDoc, doc } from "firebase/firestore";
import { Eye, EyeOff, Images, X } from "lucide-react";
import { db } from "@/lib/firebase/client";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import PatientPhotoUploadModal from "./PatientPhotoUploadModal";
import PhotoCompareSlider from "./PhotoCompareSlider";
import type { PatientPhoto, Visit } from "@/types";

function formatPhotoDate(photo: PatientPhoto): string {
  const d = photo.date ? new Date(`${photo.date}T00:00:00`) : new Date(photo.createdAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

export default function PatientPhotoGallery({
  clinicId,
  patientId,
  visits,
  initialPhotos,
  currentUid,
  currentName,
}: {
  clinicId: string;
  patientId: string;
  visits: Visit[];
  initialPhotos: PatientPhoto[];
  currentUid: string;
  currentName: string;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const [photos, setPhotos] = useState<PatientPhoto[]>(initialPhotos);
  const [filterVisitId, setFilterVisitId] = useState<string>("all");
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [comparing, setComparing] = useState<[PatientPhoto, PatientPhoto] | null>(null);
  const [lightboxPhoto, setLightboxPhoto] = useState<PatientPhoto | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const visitFilterOptions = useMemo(() => {
    const byVisit = new Map<string, { label: string; date: string; count: number }>();
    for (const p of photos) {
      if (!p.visitId) continue;
      const existing = byVisit.get(p.visitId);
      if (existing) {
        existing.count++;
        continue;
      }
      const visit = visits.find((v) => v.id === p.visitId);
      const cfg = visit ? SESSION_TYPE_CONFIG[visit.sessionType] : undefined;
      const area = visit?.fields?.area;
      const date = visit?.date || p.date || "";
      const label = `${date || "Undated"} · ${cfg?.label || visit?.sessionType || "Session"}${
        typeof area === "string" && area ? ` · ${area}` : ""
      }`;
      byVisit.set(p.visitId, { label, date, count: 1 });
    }
    return [...byVisit.entries()]
      .map(([visitId, v]) => ({ visitId, ...v }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [photos, visits, SESSION_TYPE_CONFIG]);

  const filteredPhotos =
    filterVisitId === "all" ? photos : photos.filter((p) => p.visitId === filterVisitId);

  function toggleReveal(id: string) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleCompareMode() {
    setCompareMode((v) => !v);
    setSelectedIds([]);
  }

  function toggleSelect(photo: PatientPhoto) {
    setSelectedIds((prev) => {
      if (prev.includes(photo.id)) return prev.filter((id) => id !== photo.id);
      const next = [...prev, photo.id];
      return next.length > 2 ? next.slice(1) : next; // keep the most recent 2 picks
    });
  }

  function openCompare() {
    const chosen = selectedIds
      .map((id) => photos.find((p) => p.id === id))
      .filter((p): p is PatientPhoto => !!p)
      .sort(
        (a, b) =>
          (a.date || new Date(a.createdAt).toISOString().slice(0, 10)).localeCompare(
            b.date || new Date(b.createdAt).toISOString().slice(0, 10)
          ) || a.createdAt - b.createdAt
      );
    if (chosen.length !== 2) return;
    setComparing([chosen[0], chosen[1]]);
  }

  function handleUploaded(newPhotos: PatientPhoto[]) {
    setPhotos((prev) => [...newPhotos, ...prev]);
    setUploadOpen(false);
  }

  async function handleDelete(photo: PatientPhoto) {
    if (!confirm("Delete this photo? This can't be undone.")) return;
    setDeletingId(photo.id);
    try {
      await deleteDoc(doc(db, "patientPhotos", photo.id));
      setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setLightboxPhoto(null);
    } catch (err) {
      console.error("Failed to delete photo:", err);
      alert("Couldn't delete this photo. Please try again.");
    }
    setDeletingId(null);
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-medium text-brown-900">Photos</h2>
          <p className="mt-0.5 text-xs text-brown-400">
            Before/after progress — linked to sessions where relevant. Sensitive-area photos stay
            blurred until clicked.
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          {photos.length >= 2 && (
            <button
              onClick={toggleCompareMode}
              className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                compareMode
                  ? "bg-brown-900 text-beige-200"
                  : "border border-beige-300 text-brown-700 hover:border-gold-500 hover:text-gold-600"
              }`}
            >
              {compareMode ? "Cancel Compare" : "Compare"}
            </button>
          )}
          <button
            onClick={() => setUploadOpen(true)}
            className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + Add Photos
          </button>
        </div>
      </div>

      {compareMode && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-gold-500/40 bg-gold-100/50 px-4 py-2.5 text-sm">
          <span className="text-brown-700">
            {selectedIds.length === 0
              ? "Pick any two photos to compare."
              : selectedIds.length === 1
                ? "Pick one more photo."
                : "Ready to compare."}
          </span>
          <button
            onClick={openCompare}
            disabled={selectedIds.length !== 2}
            className="rounded-md bg-brown-900 px-3 py-1.5 text-xs font-semibold text-beige-200 disabled:opacity-40"
          >
            Compare Selected
          </button>
        </div>
      )}

      {visitFilterOptions.length > 0 && (
        <div className="mb-4">
          <select
            value={filterVisitId}
            onChange={(e) => setFilterVisitId(e.target.value)}
            className="rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          >
            <option value="all">All Photos ({photos.length})</option>
            {visitFilterOptions.map((opt) => (
              <option key={opt.visitId} value={opt.visitId}>
                {opt.label} ({opt.count})
              </option>
            ))}
          </select>
        </div>
      )}

      {filteredPhotos.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-beige-300 py-10 text-center">
          <Images className="text-brown-400" size={28} />
          <p className="mt-2 text-sm text-brown-400">
            {photos.length === 0 ? "No photos yet." : "No photos for this session."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {filteredPhotos.map((photo, i) => {
            const isRevealed = !photo.sensitive || revealedIds.has(photo.id);
            const isSelected = selectedIds.includes(photo.id);
            const cfg = photo.sessionType ? SESSION_TYPE_CONFIG[photo.sessionType] : undefined;
            return (
              <button
                key={photo.id}
                onClick={() => (compareMode ? toggleSelect(photo) : setLightboxPhoto(photo))}
                style={{ animationDelay: `${i * 25}ms` }}
                className={`animate-fade-up group relative aspect-square overflow-hidden rounded-md bg-beige-200 ring-2 transition-all ${
                  isSelected ? "ring-gold-500" : "ring-transparent hover:ring-beige-300"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- embedded base64 data URL, not a remote asset */}
                <img
                  src={photo.dataUrl}
                  alt={photo.label || "Patient photo"}
                  className={`h-full w-full object-cover transition-transform group-hover:scale-105 ${
                    isRevealed ? "" : "blur-md"
                  }`}
                />
                {!isRevealed && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleReveal(photo.id);
                    }}
                    className="absolute inset-0 flex items-center justify-center bg-brown-900/30 text-white"
                  >
                    <Eye size={20} />
                  </span>
                )}
                {cfg && (
                  <span
                    className={`absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-bold ${cfg.badgeClassName}`}
                  >
                    {cfg.badgeText}
                  </span>
                )}
                {compareMode && (
                  <span
                    className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border-2 text-[10px] font-bold ${
                      isSelected
                        ? "border-gold-500 bg-gold-500 text-white"
                        : "border-white bg-black/30 text-transparent"
                    }`}
                  >
                    {isSelected ? selectedIds.indexOf(photo.id) + 1 : ""}
                  </span>
                )}
                {photo.label && (
                  <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/60 to-transparent px-1.5 py-1 text-left text-[9px] font-medium text-white">
                    {photo.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {uploadOpen && (
        <PatientPhotoUploadModal
          clinicId={clinicId}
          patientId={patientId}
          visits={visits}
          currentUid={currentUid}
          currentName={currentName}
          onClose={() => setUploadOpen(false)}
          onUploaded={handleUploaded}
        />
      )}

      {comparing && (
        <PhotoCompareSlider before={comparing[0]} after={comparing[1]} onClose={() => setComparing(null)} />
      )}

      {lightboxPhoto && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/80 px-4"
          onClick={() => setLightboxPhoto(null)}
        >
          <div className="w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between text-beige-200">
              <span className="text-sm">
                {lightboxPhoto.label || "Photo"} · {formatPhotoDate(lightboxPhoto)}
              </span>
              <button
                onClick={() => setLightboxPhoto(null)}
                className="rounded-md p-1.5 hover:bg-white/10"
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative overflow-hidden rounded-xl bg-black shadow-card">
              {/* eslint-disable-next-line @next/next/no-img-element -- embedded base64 data URL, not a remote asset */}
              <img
                src={lightboxPhoto.dataUrl}
                alt={lightboxPhoto.label || "Patient photo"}
                className={`max-h-[70vh] w-full object-contain ${
                  lightboxPhoto.sensitive && !revealedIds.has(lightboxPhoto.id) ? "blur-lg" : ""
                }`}
              />
              {lightboxPhoto.sensitive && !revealedIds.has(lightboxPhoto.id) && (
                <button
                  onClick={() => toggleReveal(lightboxPhoto.id)}
                  className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-brown-900/40 text-white"
                >
                  <Eye size={28} />
                  <span className="text-sm font-medium">Click to reveal</span>
                </button>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs text-beige-200/80">
              <span>
                Uploaded by {lightboxPhoto.uploadedByName}
                {lightboxPhoto.sensitive && (
                  <button
                    onClick={() => toggleReveal(lightboxPhoto.id)}
                    className="ml-3 inline-flex items-center gap-1 text-gold-400 hover:underline"
                  >
                    {revealedIds.has(lightboxPhoto.id) ? <EyeOff size={12} /> : <Eye size={12} />}
                    {revealedIds.has(lightboxPhoto.id) ? "Blur" : "Marked sensitive"}
                  </button>
                )}
              </span>
              <button
                onClick={() => handleDelete(lightboxPhoto)}
                disabled={deletingId === lightboxPhoto.id}
                className="font-medium text-red-400 hover:underline disabled:opacity-60"
              >
                {deletingId === lightboxPhoto.id ? "Deleting…" : "Delete Photo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
