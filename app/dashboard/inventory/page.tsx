import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicInventoryItems, getRecentInventoryLogs } from "@/lib/db/inventory";
import { todayLocalStr } from "@/lib/calendar";
import { getClinic } from "@/lib/db/clinics";
import { getClinicTier, getEntitlements } from "@/lib/entitlements";
import InventoryDashboard from "@/components/inventory/InventoryDashboard";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/api/auth/force-logout");

  const clinic = await getClinic(session.clinicId);
  const tier = getClinicTier(
    clinic ?? { subscriptionStatus: "active", trialEndsAt: 0, planTier: null }
  );
  if (!getEntitlements(tier).inventory) redirect("/dashboard");

  const [items, recentLogs] = await Promise.all([
    getClinicInventoryItems(session.clinicId),
    getRecentInventoryLogs(session.clinicId),
  ]);

  return (
    <div className="max-w-6xl">
      <h1 className="mb-8 inline-block border-b-4 border-rust-600 pb-1 font-display text-2xl font-bold text-brown-900">
        Inventory
      </h1>

      <InventoryDashboard
        initialItems={items}
        recentLogs={recentLogs}
        todayStr={todayLocalStr()}
        canEdit={session.role === "owner"}
      />
    </div>
  );
}
