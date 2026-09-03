import Link from "next/link";
import { CalendarClock, Phone } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";
import type { SessionTypeConfig } from "@/lib/sessionTypes";
import type { Visit } from "@/types";

export interface FollowUpRow {
  visit: Visit;
  patientName: string;
  patientPhone: string;
}

function formatVisitDate(dateStr: string): string {
  if (!dateStr) return "an earlier visit";
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString("en-US", { day: "numeric", month: "short" });
}

/** One day's worth of follow-ups — a plain read-only call list, not
 * another place to log or act on the visit itself. */
export default function FollowUpList({
  title,
  dateLabel,
  rows,
  sessionTypeConfig,
}: {
  title: string;
  dateLabel: string;
  rows: FollowUpRow[];
  sessionTypeConfig: Record<string, SessionTypeConfig>;
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <h2 className="font-display text-lg font-medium text-brown-900">{title}</h2>
        <span className="text-sm text-brown-400">
          {dateLabel} · {rows.length} patient{rows.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-3">
        {rows.length === 0 ? (
          <EmptyState compact icon={CalendarClock} title="No follow-ups." />
        ) : (
          <div className="space-y-2">
            {rows.map(({ visit, patientName, patientPhone }) => {
              const cfg = sessionTypeConfig[visit.sessionType];
              return (
                <div key={visit.id} className="rounded-lg border border-beige-300 px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link
                      href={`/dashboard/patients/${visit.patientId}`}
                      className="text-sm font-medium text-brown-900 hover:text-gold-600"
                    >
                      {patientName}
                    </Link>
                    {patientPhone && (
                      <a
                        href={`tel:${patientPhone}`}
                        className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-gold-600 hover:underline"
                      >
                        <Phone size={12} /> {patientPhone}
                      </a>
                    )}
                  </div>
                  {visit.followUpNote && <p className="mt-1.5 text-sm text-brown-600">{visit.followUpNote}</p>}
                  <p className="mt-1.5 text-xs text-brown-400">
                    {cfg && (
                      <span className={`mr-1.5 rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                        {cfg.badgeText}
                      </span>
                    )}
                    From the visit on {formatVisitDate(visit.date)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
