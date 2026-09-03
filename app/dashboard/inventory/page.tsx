import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getClinicInventoryItems, getRecentInventoryLogs } from "@/lib/db/inventory";
import { todayLocalStr } from "@/lib/calendar";
import InventoryDashboard from "@/components/inventory/InventoryDashboard";

export default async function InventoryPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [items, recentLogs] = await Promise.all([
    getClinicInventoryItems(session.clinicId),
    getRecentInventoryLogs(session.clinicId),
  ]);

  return (
    <div className="max-w-6xl">
      <h1 className="font-display text-2xl font-medium text-brown-900">Inventory</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <InventoryDashboard
        initialItems={items}
        recentLogs={recentLogs}
        todayStr={todayLocalStr()}
        canEdit={session.role === "owner"}
      />
    </div>
  );
}
