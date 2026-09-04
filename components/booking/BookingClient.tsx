"use client";

import { useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, RotateCcw } from "lucide-react";
import { lookupPatientAction, submitBookingAction, type MatchedPatient } from "@/app/book/[clinicId]/actions";
import { todayLocalStr, parseDateStr } from "@/lib/calendar";
import type { SessionTypeConfig } from "@/lib/sessionTypes";

type Step = "lookup" | "book" | "success";

const INPUT_CLASS =
  "w-full rounded-md border border-beige-300 bg-canvas px-3.5 py-2.5 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-brown-700";

function formatVisitDate(dateStr: string): string {
  if (!dateStr) return "";
  return parseDateStr(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function BookingClient({
  clinicId,
  sessionTypeConfig,
}: {
  clinicId: string;
  sessionTypeConfig: Record<string, SessionTypeConfig>;
}) {
  const [step, setStep] = useState<Step>("lookup");

  // Carried from the lookup step into the booking form.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<MatchedPatient | null>(null);
  const [checkedMatch, setCheckedMatch] = useState(false); // true once lookup has run, even if it found nothing

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [sessionType, setSessionType] = useState("");
  const [date, setDate] = useState(todayLocalStr());
  const [time, setTime] = useState("10:00");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [confirmedType, setConfirmedType] = useState("");

  const sessionTypeEntries = useMemo(
    () => Object.entries(sessionTypeConfig).sort((a, b) => a[1].label.localeCompare(b[1].label)),
    [sessionTypeConfig]
  );

  async function handleLookup(e: React.FormEvent) {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);
    const result = await lookupPatientAction(clinicId, name, phone);
    setLookupLoading(false);

    if ("error" in result) {
      setLookupError(result.error);
      return;
    }
    setCheckedMatch(true);
    if (result.matched) {
      setMatchedPatient(result.patient);
      setSessionType(result.patient.recentVisits[0]?.sessionType || "");
    } else {
      setMatchedPatient(null);
      setSessionType("");
    }
    setStep("book");
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
    setBookingError(null);
    setBooking(true);
    const result = await submitBookingAction(clinicId, { name, phone, sessionType, date, time, notes });
    setBooking(false);

    if ("error" in result) {
      setBookingError(result.error);
      return;
    }
    setConfirmedType(sessionTypeConfig[sessionType]?.label || sessionType);
    setStep("success");
  }

  function startOver() {
    setStep("lookup");
    setName("");
    setPhone("");
    setMatchedPatient(null);
    setCheckedMatch(false);
    setSessionType("");
    setNotes("");
    setBookingError(null);
    setLookupError(null);
  }

  if (step === "success") {
    return (
      <div className="rounded-xl bg-surface p-8 text-center shadow-card ring-1 ring-beige-300">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold-100">
          <CalendarCheck size={22} className="text-gold-600" />
        </div>
        <h1 className="mt-4 font-display text-xl font-medium text-brown-900">You&apos;re booked!</h1>
        <p className="mt-2 text-sm leading-relaxed text-brown-600">
          {confirmedType} on {formatVisitDate(date)} at {formatTimeLabel(time)}. We&apos;ll see you then — call the
          clinic if you need to reschedule.
        </p>
        <button
          type="button"
          onClick={startOver}
          className="mx-auto mt-6 flex items-center gap-1.5 text-sm font-medium text-gold-600 hover:underline"
        >
          <RotateCcw size={14} />
          Book another appointment
        </button>
      </div>
    );
  }

  if (step === "book") {
    return (
      <div className="rounded-xl bg-surface p-6 shadow-card ring-1 ring-beige-300 sm:p-7">
        <button
          type="button"
          onClick={() => setStep("lookup")}
          className="flex items-center gap-1 text-xs font-medium text-brown-400 hover:text-brown-700"
        >
          <ChevronLeft size={14} /> Back
        </button>

        {matchedPatient ? (
          <>
            <h1 className="mt-3 font-display text-lg font-medium text-brown-900">
              Welcome back, {matchedPatient.patientName.split(" ")[0]}
            </h1>
            <p className="mt-1 text-sm text-brown-600">Book another session, or choose something new below.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-lg font-medium text-brown-900">Let&apos;s get you booked</h1>
            <p className="mt-1 text-sm text-brown-600">
              {checkedMatch
                ? "We couldn't find you as an existing patient — no problem, book as a new patient below."
                : ""}
            </p>
          </>
        )}

        <form onSubmit={handleBook} className="mt-5 space-y-4">
          {matchedPatient && matchedPatient.recentVisits.length > 0 && (
            <div>
              <label className={LABEL_CLASS}>Book again</label>
              <div className="flex flex-col gap-2">
                {matchedPatient.recentVisits.map((v) => {
                  const cfg = sessionTypeConfig[v.sessionType];
                  if (!cfg) return null;
                  const selected = sessionType === v.sessionType;
                  return (
                    <button
                      key={v.sessionType}
                      type="button"
                      onClick={() => setSessionType(v.sessionType)}
                      className={`flex items-center justify-between rounded-md border px-3.5 py-2.5 text-left text-sm transition-colors ${
                        selected
                          ? "border-gold-500 bg-gold-100/50"
                          : "border-beige-300 bg-canvas hover:border-gold-400"
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold tracking-wide ${cfg.badgeClassName}`}>
                          {cfg.badgeText}
                        </span>
                        <span className="font-medium text-brown-900">{cfg.label}</span>
                      </span>
                      <span className="text-xs text-brown-400">Last: {formatVisitDate(v.date)}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div>
            <label className={LABEL_CLASS}>
              {matchedPatient && matchedPatient.recentVisits.length > 0 ? "Or choose a different treatment" : "Treatment"}
            </label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className={INPUT_CLASS}
              required
            >
              <option value="" disabled>
                Select a treatment
              </option>
              {sessionTypeEntries.map(([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS}>Date</label>
              <input
                type="date"
                value={date}
                min={todayLocalStr()}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT_CLASS}
                required
              />
            </div>
            <div>
              <label className={LABEL_CLASS}>Time</label>
              <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={INPUT_CLASS} required />
            </div>
          </div>

          <div>
            <label className={LABEL_CLASS}>
              Anything we should know? <span className="text-brown-400">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={INPUT_CLASS}
              placeholder="e.g. first time getting this treatment"
            />
          </div>

          {bookingError && <p className="text-sm text-red-700">{bookingError}</p>}

          <button
            type="submit"
            disabled={booking || !sessionType}
            className="w-full rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {booking ? "Booking…" : "Confirm Appointment"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-card ring-1 ring-beige-300 sm:p-7">
      <h1 className="font-display text-lg font-medium text-brown-900">Book an Appointment</h1>
      <p className="mt-1 text-sm text-brown-600">
        Already a patient? Enter your details and we&apos;ll pull up your past sessions.
      </p>

      <form onSubmit={handleLookup} className="mt-5 space-y-4">
        <div>
          <label className={LABEL_CLASS}>Full name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoFocus
            className={INPUT_CLASS}
            required
          />
        </div>
        <div>
          <label className={LABEL_CLASS}>Phone number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            className={INPUT_CLASS}
            required
          />
        </div>

        {lookupError && <p className="text-sm text-red-700">{lookupError}</p>}

        <button
          type="submit"
          disabled={lookupLoading}
          className="w-full rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
        >
          {lookupLoading ? "Checking…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

function formatTimeLabel(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${period}`;
}
