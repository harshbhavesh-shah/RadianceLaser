// Resizes and compresses an image client-side before it's embedded as a
// base64 data URL in a Firestore document — this project runs on the free
// Firebase Spark plan (no Storage), so photos live directly in Firestore
// instead of an object store, which means they need to stay well under
// Firestore's 1MiB-per-document limit.

const DEFAULT_MAX_DIMENSION = 1000; // px, longest side
const DEFAULT_MAX_DATA_URL_LENGTH = 850_000; // chars — leaves headroom under 1MiB/doc

/** Draws `file` onto a canvas at a capped resolution, then re-encodes it as
 * JPEG, backing off quality until the resulting data URL fits the budget.
 * Returns the data URL (e.g. "data:image/jpeg;base64,...") ready to store
 * directly as a Firestore field. */
export async function compressImageToDataUrl(
  file: File,
  opts?: { maxDimension?: number; maxDataUrlLength?: number }
): Promise<string> {
  const maxDimension = opts?.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const maxDataUrlLength = opts?.maxDataUrlLength ?? DEFAULT_MAX_DATA_URL_LENGTH;

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  let quality = 0.85;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);
  while (dataUrl.length > maxDataUrlLength && quality > 0.3) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL("image/jpeg", quality);
  }

  if (dataUrl.length > maxDataUrlLength && maxDimension > 250) {
    // Still too big even at the lowest quality we'll go — shrink dimensions
    // further and try again rather than saving something that risks failing
    // to write. The maxDimension floor guarantees this terminates even for
    // a pathological image.
    return compressImageToDataUrl(file, {
      maxDimension: Math.round(maxDimension * 0.75),
      maxDataUrlLength,
    });
  }

  return dataUrl;
}
