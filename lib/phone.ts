// Shared phone handling — used by the single-patient create/edit forms and
// the bulk CSV/Excel import (app/dashboard/settings/patientImportActions.ts),
// so "is this the same patient" and "is this a real phone number" are
// answered the same way everywhere in the app.

/** Digits only, so "98765 43210" and "+91-9876543210" compare as the same
 * number regardless of how someone typed it in. */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}

/** Loose sanity check, not a strict national-format validator — clinics see
 * patients with international numbers, landlines, etc. Just catches the
 * "someone fat-fingered 3 digits" case rather than a real phone number. */
export function isValidPhone(phone: string): boolean {
  const digits = normalizePhone(phone);
  return digits.length >= 7 && digits.length <= 15;
}
