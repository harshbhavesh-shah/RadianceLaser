import Link from "next/link";
import type { ClinicAccess } from "@/lib/subscription";
import type { UserRole } from "@/types";

/**
 * Full-width strip shown above the dashboard whenever a clinic isn't
 * comfortably far from needing to pay — a reminder as a trial or paid
 * period winds down, or the lock notice once either has actually lapsed.
 * Purely informational: the actual hard lock is enforced in
 * firestore.rules (clinicIsActive()), not here. Renders nothing once a
 * clinic is safely "active" (see REMINDER_THRESHOLD_DAYS in
 * lib/subscription.ts for how close to the deadline "reminder" means).
 */
export default function TrialBanner({ access, role }: { access: ClinicAccess; role: UserRole }) {
  if (access.status === "active" && access.renewsInDays === undefined) return null;

  if (access.status === "trialing") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gold-100 px-4 py-2 text-center text-sm text-brown-800">
        <span>
          {access.daysRemaining <= 1
            ? "Your free trial ends tomorrow."
            : `Your free trial ends in ${access.daysRemaining} days.`}
        </span>
        {role === "owner" && (
          <Link href="/dashboard/settings#billing" className="font-medium text-gold-700 underline">
            Subscribe to keep access after it ends.
          </Link>
        )}
      </div>
    );
  }

  if (access.status === "active") {
    return (
      <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-gold-100 px-4 py-2 text-center text-sm text-brown-800">
        <span>
          {access.renewsInDays! <= 1
            ? "Your subscription renews tomorrow."
            : `Your subscription needs renewing in ${access.renewsInDays} days.`}
        </span>
        {role === "owner" && (
          <Link href="/dashboard/settings#billing" className="font-medium text-gold-700 underline">
            Renew now.
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-red-100 px-4 py-2 text-center text-sm text-red-900">
      <span>
        Your free trial or subscription has ended. Your data is safe, but nothing can be added or
        changed until {role === "owner" ? "you renew." : "your clinic owner renews."}
      </span>
      {role === "owner" && (
        <Link href="/dashboard/settings#billing" className="font-medium underline">
          Renew now.
        </Link>
      )}
    </div>
  );
}
