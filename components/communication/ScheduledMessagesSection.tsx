"use client";

import { useState } from "react";
import { updateMessagingSettingsAction } from "@/app/dashboard/communication/actions";
import type { Clinic, MessageTemplate } from "@/types";

const REMINDER_HOUR_OPTIONS = [2, 4, 12, 24, 48, 72];
const SURVEY_HOUR_OPTIONS = [1, 2, 3, 6, 12, 24];

function Toggle({ on, onChange, disabled }: { on: boolean; onChange: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={onChange}
      disabled={disabled}
      className={`relative h-6 w-11 flex-shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        on ? "bg-gold-600" : "bg-beige-300"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[22px]" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}

/** Settings > Communication's reminder/feedback-survey toggles. The
 * automation itself runs server-side; this just edits the flags and
 * timing values on Clinic. Both toggles stay disabled until WhatsApp is
 * connected and the matching template exists. */
export default function ScheduledMessagesSection({
  initialClinic,
  templates,
  isConnected,
  canEdit,
}: {
  initialClinic: Pick<
    Clinic,
    "reminderEnabled" | "reminderHoursBefore" | "feedbackSurveyEnabled" | "feedbackSurveyDelayHours"
  >;
  templates: MessageTemplate[];
  isConnected: boolean;
  canEdit: boolean;
}) {
  const [reminderEnabled, setReminderEnabled] = useState(initialClinic.reminderEnabled);
  const [reminderHoursBefore, setReminderHoursBefore] = useState(initialClinic.reminderHoursBefore);
  const [feedbackSurveyEnabled, setFeedbackSurveyEnabled] = useState(initialClinic.feedbackSurveyEnabled);
  const [feedbackSurveyDelayHours, setFeedbackSurveyDelayHours] = useState(initialClinic.feedbackSurveyDelayHours);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const hasReminderTemplate = templates.some((t) => t.category === "appointment_reminder");
  const hasFeedbackTemplate = templates.some((t) => t.category === "visit_feedback");

  async function save(next: {
    reminderEnabled: boolean;
    reminderHoursBefore: number;
    feedbackSurveyEnabled: boolean;
    feedbackSurveyDelayHours: number;
  }) {
    setSaving(true);
    setError(null);
    setSaved(false);
    const result = await updateMessagingSettingsAction(next);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReminderToggle() {
    const next = !reminderEnabled;
    setReminderEnabled(next);
    save({ reminderEnabled: next, reminderHoursBefore, feedbackSurveyEnabled, feedbackSurveyDelayHours });
  }

  function handleReminderHours(value: number) {
    setReminderHoursBefore(value);
    save({ reminderEnabled, reminderHoursBefore: value, feedbackSurveyEnabled, feedbackSurveyDelayHours });
  }

  function handleSurveyToggle() {
    const next = !feedbackSurveyEnabled;
    setFeedbackSurveyEnabled(next);
    save({ reminderEnabled, reminderHoursBefore, feedbackSurveyEnabled: next, feedbackSurveyDelayHours });
  }

  function handleSurveyHours(value: number) {
    setFeedbackSurveyDelayHours(value);
    save({ reminderEnabled, reminderHoursBefore, feedbackSurveyEnabled, feedbackSurveyDelayHours: value });
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
      <h2 className="font-display text-lg font-medium text-brown-900">Automated Messages</h2>
      <p className="mt-0.5 text-xs text-brown-400">
        Sent automatically over WhatsApp — no one has to remember to send these by hand.
      </p>

      {!canEdit ? (
        <p className="mt-4 text-sm text-brown-400">Only the clinic owner can manage this.</p>
      ) : (
        <div className="mt-5 space-y-5">
          <div className="flex items-start justify-between gap-4 border-t border-beige-300 pt-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brown-900">Appointment reminders</p>
              <p className="mt-0.5 text-xs text-brown-400">
                A WhatsApp reminder before every upcoming appointment, sent once, automatically.
              </p>
              {reminderEnabled && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-brown-600">Send</span>
                  <select
                    value={reminderHoursBefore}
                    onChange={(e) => handleReminderHours(Number(e.target.value))}
                    className="rounded-md border border-beige-300 bg-canvas px-2 py-1 text-xs text-brown-900 outline-none focus:border-gold-500"
                  >
                    {REMINDER_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h < 24 ? `${h} hour${h === 1 ? "" : "s"}` : `${h / 24} day${h === 24 ? "" : "s"}`} before
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isConnected && <p className="mt-1.5 text-xs text-red-700">Connect WhatsApp first.</p>}
              {isConnected && !hasReminderTemplate && (
                <p className="mt-1.5 text-xs text-red-700">
                  Add an &quot;Appointment Reminder&quot; template below first.
                </p>
              )}
            </div>
            <Toggle
              on={reminderEnabled}
              onChange={handleReminderToggle}
              disabled={saving || !isConnected || !hasReminderTemplate}
            />
          </div>

          <div className="flex items-start justify-between gap-4 border-t border-beige-300 pt-5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-brown-900">Post-visit feedback</p>
              <p className="mt-0.5 text-xs text-brown-400">
                A short WhatsApp survey after each visit — see responses below once patients reply.
              </p>
              {feedbackSurveyEnabled && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-brown-600">Send</span>
                  <select
                    value={feedbackSurveyDelayHours}
                    onChange={(e) => handleSurveyHours(Number(e.target.value))}
                    className="rounded-md border border-beige-300 bg-canvas px-2 py-1 text-xs text-brown-900 outline-none focus:border-gold-500"
                  >
                    {SURVEY_HOUR_OPTIONS.map((h) => (
                      <option key={h} value={h}>
                        {h} hour{h === 1 ? "" : "s"} after the visit
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {!isConnected && <p className="mt-1.5 text-xs text-red-700">Connect WhatsApp first.</p>}
              {isConnected && !hasFeedbackTemplate && (
                <p className="mt-1.5 text-xs text-red-700">
                  Add a &quot;Post-Visit Feedback&quot; template below first.
                </p>
              )}
            </div>
            <Toggle
              on={feedbackSurveyEnabled}
              onChange={handleSurveyToggle}
              disabled={saving || !isConnected || !hasFeedbackTemplate}
            />
          </div>
        </div>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
      {saved && <p className="mt-3 text-sm text-gold-600">Saved.</p>}
    </div>
  );
}
