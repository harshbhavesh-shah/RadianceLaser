"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  isEmpty: () => boolean;
  getDataUrl: () => string | null;
}

/** A draw-to-sign canvas — mouse, touch, or stylus. Exposes an imperative
 * handle (clear/isEmpty/getDataUrl) rather than controlled props, since a
 * signature is fundamentally an imperative drawing surface, not state that
 * makes sense to lift up and re-render from. getDataUrl() returns a base64
 * PNG data URL, ready to store directly as a Firestore field (no Firebase
 * Storage on the free plan — see lib/imageCompression.ts for the same
 * reasoning applied to patient photos). */
const SignaturePad = forwardRef<SignaturePadHandle, { height?: number }>(function SignaturePad(
  { height = 160 },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const [isEmptyState, setIsEmptyState] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(rect.width, 1) * ratio;
    canvas.height = height * ratio;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.scale(ratio, ratio);
      ctx.lineWidth = 2.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = "#2C1D14"; // brown-900 — reads as ink
    }
  }, [height]);

  function getPoint(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    const { x, y } = getPoint(e);
    const ctx = canvas.getContext("2d");
    ctx?.beginPath();
    ctx?.moveTo(x, y);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { x, y } = getPoint(e);
    const ctx = canvas.getContext("2d");
    ctx?.lineTo(x, y);
    ctx?.stroke();
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setIsEmptyState(false);
    }
  }

  function handlePointerUp() {
    drawingRef.current = false;
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasDrawnRef.current = false;
    setIsEmptyState(true);
  }

  useImperativeHandle(ref, () => ({
    clear,
    isEmpty: () => !hasDrawnRef.current,
    getDataUrl: () => canvasRef.current?.toDataURL("image/png") ?? null,
  }));

  return (
    <div>
      <div className="relative overflow-hidden rounded-md border border-beige-300 bg-white">
        <canvas
          ref={canvasRef}
          style={{ width: "100%", height }}
          className="block touch-none"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        />
        {isEmptyState && (
          <span className="pointer-events-none absolute inset-x-0 bottom-3 text-center text-xs text-brown-400">
            Sign here
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-1.5 text-xs font-medium text-brown-600 hover:text-gold-600"
      >
        Clear signature
      </button>
    </div>
  );
});

export default SignaturePad;
