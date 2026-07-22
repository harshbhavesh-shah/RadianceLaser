"use client";

import { useRef, useState } from "react";
import { X } from "lucide-react";
import type { PatientPhoto } from "@/types";

function formatPhotoDate(photo: PatientPhoto): string {
  const d = photo.date ? new Date(`${photo.date}T00:00:00`) : new Date(photo.createdAt);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/** Full-screen drag-to-reveal comparison between any two photos — doesn't
 * assume `before` is chronologically earlier than `after`; whichever two
 * photos the gallery hands it just get compared left vs. right. */
export default function PhotoCompareSlider({
  before,
  after,
  onClose,
}: {
  before: PatientPhoto;
  after: PatientPhoto;
  onClose: () => void;
}) {
  const [percent, setPercent] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  function updateFromClientX(clientX: number) {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPercent(Math.min(100, Math.max(0, pct)));
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    updateFromClientX(e.clientX);
  }
  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    updateFromClientX(e.clientX);
  }
  function handlePointerUp() {
    draggingRef.current = false;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/80 px-4"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between text-beige-200">
          <span className="text-sm">
            Drag the handle, or use the slider below, to compare
          </span>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 hover:bg-white/10"
            aria-label="Close comparison"
          >
            <X size={18} />
          </button>
        </div>

        <div
          ref={containerRef}
          className="animate-scale-in relative aspect-[4/3] touch-none select-none overflow-hidden rounded-xl bg-black shadow-card"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- embedded base64 data URL, not a remote asset */}
          <img
            src={after.dataUrl}
            alt={after.label || "After"}
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
          <div
            className="absolute inset-0 overflow-hidden"
            style={{ clipPath: `inset(0 ${100 - percent}% 0 0)` }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- embedded base64 data URL, not a remote asset */}
            <img
              src={before.dataUrl}
              alt={before.label || "Before"}
              className="h-full w-full object-cover"
              draggable={false}
            />
          </div>

          <div className="pointer-events-none absolute inset-y-0 w-0.5 bg-white" style={{ left: `${percent}%` }}>
            <div className="absolute left-1/2 top-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white text-brown-900 shadow-card">
              <span aria-hidden className="text-xs">
                ↔
              </span>
            </div>
          </div>

          <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {before.label || "Before"} {formatPhotoDate(before)}
          </span>
          <span className="pointer-events-none absolute right-2 top-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-white">
            {after.label || "After"} {formatPhotoDate(after)}
          </span>
        </div>

        <input
          type="range"
          min={0}
          max={100}
          value={percent}
          onChange={(e) => setPercent(Number(e.target.value))}
          aria-label="Reveal slider"
          className="mt-4 w-full accent-gold-500"
        />
      </div>
    </div>
  );
}
