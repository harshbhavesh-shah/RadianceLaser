import Link from "next/link";
import { X } from "lucide-react";
import { computePackageLedger } from "@/lib/packages";
import { SESSION_TYPE_CONFIG } from "@/lib/sessionTypes";
import { formatTime12h, parseDateStr } from "@/lib/calendar";
import { STATUS_STYLES, STATUS_LABELS } from "./statusStyles";
import type { Appointment, Package, Patient, Visit } from "@/types";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

export default function PatientMiniPanel({
  patient,
  appointment,
  visits,
  packages,
  onClose,
  onEditAppointment,
}: {
  patient: Patient;
  appointment: Appointment;
  visits: Visit[];
  packages: Package[];
  onClose: () => void;
  onEditAppointment: () => void;
}) {
  const recentVisits = [...visits].sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 5);
  const activePackages = packages.filter((p) => computePackageLedger(p, visits).status === "active");
  const apptCfg = SESSION_TYPE_CONFIG[appointment.sessionType];
  const apptStatusStyle = STATUS_STYLES[appointment.status];

  return (
    <aside className="h-full w-80 overflow-y-auto border-l border-beige-300 bg-surface p-5 shadow-[-12px_0_28px_-16px_rgba(44,29,20,0.25)]">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-display text-lg font-medium text-brown-900">{patient.name}</div>
          <span className="mt-1 inline-block rounded-full bg-beige-200 px-2 py-0.5 font-mono text-[10px] text-brown-600">
            {patient.patientCode}
          </span>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-brown-400 hover:bg-beige-200 hover:text-brown-700"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className="mt-4 space-y-1 text-sm">
        <div className="text-brown-600">{patient.phone}</div>
        {patient.email && <div className="text-brown-600">{patient.email}</div>}
        {patient.skinType && <div className="text-brown-400">Skin Type {patient.skinType}</div>}
      </div>

      <div className="mt-5 border-t border-beige-300 pt-5">
        <div className="rounded-lg border border-beige-300 bg-canvas p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${apptCfg.badgeClassName}`}>
              {apptCfg.badgeText}
            </span>
            <span
              className={`ml-auto flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${apptStatusStyle.bg} ${apptStatusStyle.text}`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${apptStatusStyle.dot}`} />
              {STATUS_LABELS[appointment.status]}
            </span>
          </div>
          <div className="text-sm font-medium text-brown-900">
            {parseDateStr(appointment.date).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {" · "}
            {formatTime12h(appointment.time)}
          </div>
          <button
            onClick={onEditAppointment}
            className="mt-2 w-full rounded-md border border-gold-500 py-1.5 text-xs font-medium text-gold-600 transition-colors hover:bg-gold-100"
          >
            Edit This Appointment
          </button>
        </div>
      </div>

      {activePackages.length > 0 && (
        <div className="mt-5 border-t border-beige-300 pt-5">
          <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-brown-400">
            Active Packages
          </div>
          <div className="space-y-2">
            {activePackages.map((pkg) => {
              const ledger = computePackageLedger(pkg, visits);
              const usedPct = Math.min((ledger.sessionsUsed / pkg.totalSessions) * 100, 100);
              return (
                <div key={pkg.id} className="rounded-lg border border-beige-300 p-2.5">
                  <div className="mb-1 truncate text-xs font-medium text-brown-900">{pkg.label}</div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-beige-200">
                    <div className="h-full rounded-full bg-gold-500" style={{ width: `${usedPct}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-brown-400">
                    {ledger.sessionsRemaining} sessions left · {formatCurrency(ledger.amountRemaining)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-beige-300 pt-5">
        <div className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-brown-400">
          Recent Visits
        </div>
        {recentVisits.length === 0 ? (
          <p className="text-xs text-brown-400">No visits logged yet.</p>
        ) : (
          <div className="space-y-2">
            {recentVisits.map((v) => {
              const cfg = SESSION_TYPE_CONFIG[v.sessionType];
              const area = v.fields?.area;
              return (
                <div key={v.id} className="flex items-center gap-2 text-xs">
                  <span className={`rounded px-1 py-0.5 text-[9px] font-bold ${cfg.badgeClassName}`}>
                    {cfg.badgeText}
                  </span>
                  <span className="text-brown-600">{v.date || "No date"}</span>
                  {area && <span className="truncate text-brown-400">· {area}</span>}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-5 border-t border-beige-300 pt-5">
        <Link
          href={`/dashboard/patients/${patient.id}`}
          className="block text-center text-sm font-medium text-gold-600 hover:underline"
        >
          View Full Patient Record →
        </Link>
      </div>
    </aside>
  );
}
