import Link from "next/link";
import { AlertTriangle, PackageX, ShieldAlert } from "lucide-react";
import type { OverviewAlert } from "@/lib/overview";

const ICONS: Record<OverviewAlert["kind"], typeof AlertTriangle> = {
  "package-low": PackageX,
  "package-expiring": PackageX,
  contraindication: ShieldAlert,
};

/** Everything that needs a follow-up today, in one place — package renewals
 * to raise with a patient while they're in, and contraindication notes for
 * anyone on today's schedule. Nothing here is urgent-emergency, just easy to
 * miss if it's buried on an individual patient record. */
export default function AlertsPanel({ alerts }: { alerts: OverviewAlert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl bg-surface p-6 text-center shadow-soft ring-1 ring-beige-300">
        <p className="text-sm text-brown-400">Nothing needs attention right now.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert, i) => {
        const Icon = ICONS[alert.kind];
        const isClinical = alert.kind === "contraindication";
        return (
          <Link
            key={`${alert.kind}-${alert.patientId}-${i}`}
            href={alert.href}
            style={{ animationDelay: `${i * 30}ms` }}
            className={`animate-fade-up flex items-start gap-3 rounded-lg border px-4 py-3 text-sm transition-colors hover:bg-gold-100/40 ${
              isClinical ? "border-red-200 bg-red-50/50" : "border-beige-300 bg-surface"
            }`}
          >
            <Icon size={16} className={`mt-0.5 flex-shrink-0 ${isClinical ? "text-red-600" : "text-gold-600"}`} />
            <span>
              <span className="font-medium text-brown-900">{alert.patientName}</span>
              <span className="text-brown-600"> — {alert.detail}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
