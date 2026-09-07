import { stopImpersonationAction } from "@/app/admin/actions";

/** Shown across the top of every /dashboard page while a super admin is
 * using "View as" (see app/admin/actions.ts startImpersonationAction) —
 * unmissable on purpose, since this is real write access to a clinic's
 * data, not a read-only preview. */
export default function ImpersonationBanner({ clinicName }: { clinicName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-brown-900 px-4 py-2 text-center text-sm text-beige-200">
      <span>
        Viewing as <span className="font-semibold text-white">{clinicName}</span> — changes made here are real.
      </span>
      <form action={stopImpersonationAction}>
        <button type="submit" className="font-medium text-gold-400 underline hover:text-gold-300">
          Return to admin
        </button>
      </form>
    </div>
  );
}
