import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import type { InventoryLog } from "@/types";

/** The append-only audit trail behind the item list's running quantities —
 * every restock and use, newest first, with who logged it and any note. */
export default function RecentActivity({
  logs,
  itemNameById,
}: {
  logs: InventoryLog[];
  itemNameById: Record<string, string>;
}) {
  if (logs.length === 0) return null;

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Recent Stock Activity</h2>
      <p className="mt-0.5 text-xs text-brown-400">Every restock and use, most recent first.</p>

      <div className="mt-4 divide-y divide-beige-300">
        {logs.map((log) => (
          <div key={log.id} className="flex items-start gap-3 py-2.5 text-sm">
            {log.type === "in" ? (
              <ArrowDownLeft size={16} className="mt-0.5 flex-shrink-0 text-green-600" />
            ) : (
              <ArrowUpRight size={16} className="mt-0.5 flex-shrink-0 text-brown-500" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate">
                <span className="font-medium text-brown-900">{itemNameById[log.itemId] ?? "Deleted item"}</span>{" "}
                <span className="text-brown-500">
                  {log.type === "in" ? "+" : "-"}
                  {log.delta}
                  {log.note ? ` · ${log.note}` : ""}
                </span>
              </p>
              <p className="mt-0.5 truncate text-xs text-brown-400">
                {log.actorName} · {new Date(log.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
