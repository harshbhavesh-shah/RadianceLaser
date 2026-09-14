"use client";

import { useState } from "react";
import NoShowStatsStrip from "@/components/no-shows/NoShowStatsStrip";
import NoShowList from "@/components/no-shows/NoShowList";
import FollowUpsSection from "@/components/no-shows/FollowUpsSection";
import FollowUpList, { type FollowUpRow } from "@/components/follow-ups/FollowUpList";
import type { NoShowStats, NoShowWeekPoint } from "@/lib/analyticsPage";
import type { NoShowLogEntry } from "@/lib/db/noShowMessageLog";
import type { Appointment, MessageTemplate, NoShowFollowUp, NoShowSurveyResponse } from "@/types";
import type { SessionTypeConfig } from "@/lib/sessionTypes";

type Tab = "no-shows" | "follow-ups";

/** No Shows and (visit) Follow-Ups used to be two separate sidebar pages
 * under the same "Patient Retention" group — merged into one page with a
 * tab bar instead, same pattern as Documents/Patients. Note this
 * "Follow-Ups" tab (due-for-a-call reminders from Visit.followUpDate) is
 * a different feature from the "No Show Follow-Ups" panel inside the No
 * Shows tab (automated messaging after a missed appointment) — the name
 * overlap predates this merge and wasn't introduced by it. */
export default function PatientRetentionTabs({
  stats,
  trend,
  recentNoShows,
  noShowFollowUps,
  messageLog,
  surveyResponses,
  templates,
  isWhatsAppConnected,
  isOwner,
  todayLabel,
  tomorrowLabel,
  todayRows,
  tomorrowRows,
  sessionTypeConfig,
  initialTab,
}: {
  stats: NoShowStats;
  trend: NoShowWeekPoint[];
  recentNoShows: Appointment[];
  noShowFollowUps: NoShowFollowUp[];
  messageLog: NoShowLogEntry[];
  surveyResponses: NoShowSurveyResponse[];
  templates: MessageTemplate[];
  isWhatsAppConnected: boolean;
  isOwner: boolean;
  todayLabel: string;
  tomorrowLabel: string;
  todayRows: FollowUpRow[];
  tomorrowRows: FollowUpRow[];
  sessionTypeConfig: Record<string, SessionTypeConfig>;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab || "no-shows");

  const TABS: { key: Tab; label: string }[] = [
    { key: "no-shows", label: "No Shows" },
    { key: "follow-ups", label: "Follow-Ups" },
  ];

  return (
    <div>
      <div className="mb-6 flex max-w-xs gap-1 rounded-lg border border-beige-300 bg-surface p-1 shadow-soft">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === t.key ? "bg-rust-100 text-rust-700" : "text-brown-600 hover:text-brown-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "no-shows" && (
        <div className="space-y-6">
          <NoShowStatsStrip stats={stats} trend={trend} />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px] lg:items-start">
            <NoShowList
              appointments={recentNoShows}
              followUps={noShowFollowUps}
              messageLog={messageLog}
              surveyResponses={surveyResponses}
            />

            <FollowUpsSection
              initialFollowUps={noShowFollowUps}
              templates={templates}
              isConnected={isWhatsAppConnected}
              canEdit={isOwner}
            />
          </div>
        </div>
      )}

      {tab === "follow-ups" && (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <FollowUpList title="Today" dateLabel={todayLabel} rows={todayRows} sessionTypeConfig={sessionTypeConfig} />
          <FollowUpList
            title="Tomorrow"
            dateLabel={tomorrowLabel}
            rows={tomorrowRows}
            sessionTypeConfig={sessionTypeConfig}
          />
        </div>
      )}
    </div>
  );
}
