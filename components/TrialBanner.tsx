import type { ClinicAccess } from "@/lib/subscription";
import { TRIAL_REMINDER_THRESHOLD_DAYS } from "@/lib/subscription";
import type { UserRole } from "@/types";

/**
 * Full-width strip shown above the dashboard when a clinic isn't on an
 * active paid subscription — either a reminder as the trial winds down, or
 * the post-trial lock notice. Purely informational: the actual hard lock is
 * enforced in firestore.rules (clinicIsActive()), not here. Renders nothing
 * once a clinic is "active", and nothing early in a trial (see
 * TRIAL_REMINDER_THRESHOLD_DAYS) so a brand-new signup isn't immediately
 * greeted with a countdown.
 */
export default function TrialBanner({ access, role }: { access: ClinicAccess; role: UserRole }) {
  if (access.status === "active") return null;

  if (access.status === "trialing") {
    if (access.daysRemaining > TRIAL_REMINDER_THRESHOLD_DAYS) return null;
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gold-100 px-4 py-2 text-center text-sm text-brown-800">
        <span>
          {access.daysRemaining <= 1
            ? "Your free trial ends tomorrow."
            : `Your free trial ends in ${access.daysRemaining} days.`}
        </span>
        {role === "owner" && (
          <span className="font-medium text-gold-700">Subscribe to keep access after it ends.</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-red-100 px-4 py-2 text-center text-sm text-red-900">
      <span>
        Your free trial has ended. Your data is safe, but nothing can be added or changed until{" "}
        {role === "owner" ? "you subscribe." : "your clinic owner subscribes."}
      </span>
    </div>
  );
}
