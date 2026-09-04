import type { Clinic } from "@/types";

const DAY_MS = 24 * 60 * 60 * 1000;

// How long a brand-new clinic's free trial lasts. Only applied at
// clinic-creation time (scripts/createClinic.mjs bakes this into
// trialEndsAt) — changing this constant later doesn't retroactively change
// any clinic that was already created.
export const TRIAL_LENGTH_DAYS = 30;

// The one and only plan for now: a flat annual price, no tiers. See
// app/dashboard/billing/actions.ts for where this is actually charged.
export const ANNUAL_PRICE_INR = 20000;
export const ANNUAL_PRICE_PAISE = ANNUAL_PRICE_INR * 100; // Razorpay amounts are in the smallest currency unit
export const SUBSCRIPTION_LENGTH_DAYS = 365;

// Once a trialing clinic has this many days or fewer left, or a paying
// clinic is this many days or fewer from its next renewal, the dashboard
// shows a reminder banner (see components/TrialBanner.tsx). This is the
// only "reminder" mechanism that exists so far — an in-app banner, not an
// email/SMS. Actual outbound reminders are follow-up work once there's a
// transactional email provider wired up.
// Kept well under TRIAL_LENGTH_DAYS (a "last week" warning, not the whole
// trial) — this was 30 back when the trial itself was 365 days; left equal
// to the trial length here would make the banner show from day one.
export const REMINDER_THRESHOLD_DAYS = 7;

export type ClinicAccess =
  | { status: "active"; renewsInDays?: number }
  | { status: "trialing"; daysRemaining: number }
  | { status: "locked" };

/**
 * The single source of truth for "can this clinic do anything right now" on
 * the UI side — used to decide when to show the trial/renewal banner or the
 * lock notice. This is NOT the actual security boundary: that's
 * firestore.rules' clinicIsActive(), which every tenant-scoped collection's
 * create/update/delete rule checks independently, the same way
 * middleware.ts's cookie-presence check is a UX nicety while
 * lib/session.ts's getSession() is the real auth boundary. Keep the two in
 * sync if this logic changes.
 *
 * "active" isn't unconditional forever — it's only active through
 * subscriptionRenewsAt (the end of the period the last payment covered).
 * Once that passes with no new payment, an "active" clinic locks out the
 * same way an expired trial does — there's no separate cron job flipping
 * status to "canceled"; the date comparison here does that implicitly.
 */
export function getClinicAccess(
  clinic: Pick<Clinic, "subscriptionStatus" | "trialEndsAt" | "subscriptionRenewsAt">
): ClinicAccess {
  if (clinic.subscriptionStatus === "active") {
    // No renewsAt on an "active" clinic shouldn't happen once a payment has
    // gone through, but don't lock someone out over missing data.
    if (!clinic.subscriptionRenewsAt) return { status: "active" };

    const msRemaining = clinic.subscriptionRenewsAt - Date.now();
    if (msRemaining <= 0) return { status: "locked" };

    const daysRemaining = Math.ceil(msRemaining / DAY_MS);
    return daysRemaining <= REMINDER_THRESHOLD_DAYS
      ? { status: "active", renewsInDays: daysRemaining }
      : { status: "active" };
  }

  if (clinic.subscriptionStatus === "trialing") {
    const msRemaining = clinic.trialEndsAt - Date.now();
    if (msRemaining <= 0) return { status: "locked" };

    const daysRemaining = Math.ceil(msRemaining / DAY_MS);
    return { status: "trialing", daysRemaining };
  }

  return { status: "locked" }; // "canceled"
}
