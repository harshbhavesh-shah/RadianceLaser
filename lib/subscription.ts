import type { Clinic } from "@/types";

// How long a brand-new clinic's free trial lasts. Only applied at
// clinic-creation time (scripts/createClinic.mjs bakes this into
// trialEndsAt) — changing this constant later doesn't retroactively change
// any clinic that was already created.
export const TRIAL_LENGTH_DAYS = 365;

// Once a trialing clinic has this many days or fewer left, the dashboard
// shows the "trial ending soon" reminder banner (see
// components/TrialBanner.tsx). This is the only "reminder" mechanism that
// exists so far — it's an in-app banner, not an email/SMS. Actual outbound
// reminders (email at 30/14/7/1 days out) are follow-up work once there's a
// transactional email provider wired up.
export const TRIAL_REMINDER_THRESHOLD_DAYS = 30;

export type ClinicAccess =
  | { status: "active" }
  | { status: "trialing"; daysRemaining: number }
  | { status: "locked" };

/**
 * The single source of truth for "can this clinic do anything right now" on
 * the UI side — used to decide when to show the trial banner or the
 * post-trial lock notice. This is NOT the actual security boundary: that's
 * firestore.rules' clinicIsActive(), which every tenant-scoped collection's
 * create/update/delete rule checks independently, the same way
 * middleware.ts's cookie-presence check is a UX nicety while
 * lib/session.ts's getSession() is the real auth boundary. Keep the two in
 * sync if this logic changes.
 */
export function getClinicAccess(
  clinic: Pick<Clinic, "subscriptionStatus" | "trialEndsAt">
): ClinicAccess {
  if (clinic.subscriptionStatus === "active") return { status: "active" };

  const msRemaining = clinic.trialEndsAt - Date.now();
  if (msRemaining <= 0) return { status: "locked" };

  const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
  return { status: "trialing", daysRemaining };
}
