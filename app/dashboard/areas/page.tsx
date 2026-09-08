import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import AreaDefsManager from "@/components/areas/AreaDefsManager";

// Split out of Settings (see components/areas/AreaDefsManager.tsx, moved
// from components/settings/) — Settings was accumulating unrelated
// clinic-config sections, and this one's substantial enough (its own list
// per treatment type, its own add/edit modal) to stand on its own instead
// of being one more card in that grid. Reads AreaDefsContext the same way
// it always has (see app/dashboard/layout.tsx) — that context is app-wide,
// not Settings-specific, so nothing about the data layer changed here.
export default async function AreasPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  return (
    <div>
      <h1 className="font-display text-2xl font-medium text-brown-900">Treatment Areas</h1>
      <p className="mt-1 text-sm text-brown-400">
        The options staff pick from on the Area field when logging a Q-Switch or Laser Hair Removal visit.
      </p>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <AreaDefsManager canEdit={session.role === "owner"} />
    </div>
  );
}
