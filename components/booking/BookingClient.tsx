"use client";

import { useState } from "react";
import { ArrowLeft, CalendarCheck, CheckCircle2, MapPin, RotateCcw } from "lucide-react";
import { lookupPatientAction, submitBookingAction, type MatchedPatient } from "@/app/book/[slug]/actions";
import { todayLocalStr, addDays, toDateStr, formatTime12h } from "@/lib/calendar";

// Two distinct screens after identify, matching design/
// DashboardOverviewDesign's Booking() mockup — its renderStep2A (returning
// client: "Welcome back" + "Book Again" cards for their last couple of
// treatments) vs. renderStep2B (new client, straight to the date/time
// picker). The cards use this patient's real visit history (see
// MatchedPatient.recentTreatments in app/book/[slug]/actions.ts) —
// but unlike the mockup, clicking one doesn't actually pick that
// treatment for the new booking, since this app's real booking backend
// has no treatment picker at all (see submitBookingAction's own comment):
// every path here, "Book Again" or "book something else", ends up
// booking the same consultation. The cards are recognition/reassurance
// ("we know you, we know what you've had done"), not a real choice.
type Step = "identify" | "welcome" | "datetime" | "success";

// Matches CALENDAR_START_HOUR/END_HOUR in lib/calendar.ts (the same
// clinic hours the staff-side Schedule view uses) — half-hour slots, none
// past closing.
function buildTimeSlots(): string[] {
  const slots: string[] = [];
  for (let hour = 9; hour < 21; hour++) {
    slots.push(`${String(hour).padStart(2, "0")}:00`);
    slots.push(`${String(hour).padStart(2, "0")}:30`);
  }
  return slots;
}
const TIME_SLOTS = buildTimeSlots();

function buildNextDays(count: number): { dateStr: string; dayLabel: string; dayNum: string }[] {
  const today = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = addDays(today, i);
    return {
      dateStr: toDateStr(d),
      dayLabel: d.toLocaleDateString("en-US", { weekday: "short" }),
      // Just the day number — the chip only has room for one line under
      // the weekday label (see the button markup below).
      dayNum: String(d.getDate()),
    };
  });
}
const NEXT_DAYS = buildNextDays(7);

// This page only ever books a consultation — a visitor booking online
// doesn't know which treatment they need yet, new patient or returning.
// The doctor decides that at the consultation itself, so there's
// deliberately no treatment picker anywhere in this flow (see
// app/book/[slug]/actions.ts). Matches the visual language of
// design/DashboardOverviewDesign's Booking() mockup, adapted to this
// app's real (simpler, no treatment-picker branch) booking backend.
export default function BookingClient({
  clinicId,
  clinicName,
  clinicAddress,
  clinicPhone,
}: {
  clinicId: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
}) {
  const [step, setStep] = useState<Step>("identify");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<MatchedPatient | null>(null);
  const [checkedMatch, setCheckedMatch] = useState(false);

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocalStr());
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);

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
    const matched = result.matched ? result.patient : null;
    setMatchedPatient(matched);
    // Matched an existing patient → its own recognition screen first
    // (design's renderStep2A). No match → straight to the date/time
    // picker (renderStep2B), same as before.
    setStep(matched ? "welcome" : "datetime");
  }

  async function handleBook() {
    setBookingError(null);
    setBooking(true);
    const result = await submitBookingAction(clinicId, { name, phone, date, time, notes });
    setBooking(false);

    if ("error" in result) {
      setBookingError(result.error);
      return;
    }
    setStep("success");
  }

  function startOver() {
    setStep("identify");
    setName("");
    setPhone("");
    setMatchedPatient(null);
    setCheckedMatch(false);
    setDate(todayLocalStr());
    setTime("");
    setNotes("");
    setBookingError(null);
    setLookupError(null);
  }

  if (step === "success") {
    return (
      <div className="mx-auto w-full max-w-md pt-4 text-center">
        <div className="mx-auto mb-8 flex h-24 w-24 items-center justify-center rounded-full bg-green-700/15">
          <CheckCircle2 className="h-12 w-12 text-green-700" strokeWidth={2.5} />
        </div>
        <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-brown-900 sm:text-4xl">You&apos;re all set!</h1>
        <p className="mb-8 text-base font-medium text-brown-400">
          Your consultation is booked for {formatVisitDate(date)} at {formatTime12h(time)}.
        </p>

        {(clinicAddress || clinicPhone) && (
          <div className="mx-auto mb-8 flex max-w-sm items-start gap-4 rounded-[24px] border border-beige-300 bg-surface p-8 text-left shadow-soft">
            <MapPin className="mt-1 h-6 w-6 flex-shrink-0 text-rust-600" />
            <div>
              <h3 className="mb-1 text-lg font-extrabold text-brown-900">{clinicName}</h3>
              {clinicAddress && <p className="mb-3 text-sm font-medium text-brown-400">{clinicAddress}</p>}
              {clinicPhone && <p className="text-sm font-bold text-brown-900">{clinicPhone}</p>}
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={startOver}
          className="inline-flex items-center gap-1.5 text-sm font-bold text-rust-600 transition-colors hover:text-rust-600/80"
        >
          <RotateCcw size={14} />
          Book another appointment
        </button>
      </div>
    );
  }

  if (step === "welcome" && matchedPatient) {
    const hasHistory = matchedPatient.recentTreatments.length > 0;
    return (
      <div className={`mx-auto w-full ${hasHistory ? "max-w-2xl" : "max-w-md"}`}>
        <button
          type="button"
          onClick={() => setStep("identify")}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-brown-400 transition-colors hover:text-brown-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h2 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-brown-900">
          Welcome back, {matchedPatient.patientName.split(" ")[0]}
        </h2>
        <p className="mb-8 text-center text-base font-medium text-brown-400">
          {hasHistory
            ? "Would you like to book one of your previous treatments?"
            : "We found you in our records — ready to book your next consultation?"}
        </p>

        {hasHistory ? (
          <>
            <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
              {matchedPatient.recentTreatments.map((t) => (
                <div key={t.label} className="flex flex-col rounded-[24px] border border-beige-300 bg-surface p-6 shadow-soft">
                  <h3 className="mb-1 text-xl font-extrabold text-brown-900">{t.label}</h3>
                  <p className="mb-6 text-sm font-semibold text-brown-400">Last done: {formatShortDate(t.lastDate)}</p>
                  <button
                    type="button"
                    onClick={() => setStep("datetime")}
                    className="mt-auto w-full rounded-xl bg-rust-100 py-3 text-sm font-bold text-rust-600 transition-colors hover:bg-rust-100/70"
                  >
                    Book Again
                  </button>
                </div>
              ))}
            </div>
            <div className="text-center">
              <button
                type="button"
                onClick={() => setStep("datetime")}
                className="text-sm font-bold text-rust-600 transition-colors hover:text-rust-600/80"
              >
                Or book something else →
              </button>
            </div>
          </>
        ) : (
          <div className="rounded-[24px] border border-beige-300 bg-surface p-8 text-center shadow-soft">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-rust-100">
              <CalendarCheck className="h-6 w-6 text-rust-600" />
            </div>
            <p className="mb-1 text-lg font-extrabold text-brown-900">{matchedPatient.patientName}</p>
            <p className="mb-6 text-sm font-medium text-brown-400">{phone}</p>
            <button
              type="button"
              onClick={() => setStep("datetime")}
              className="w-full rounded-xl bg-rust-600 py-3.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-rust-600/90"
            >
              Continue to booking
            </button>
          </div>
        )}

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => setStep("identify")}
            className="text-sm font-bold text-rust-600 transition-colors hover:text-rust-600/80"
          >
            Not you? Go back
          </button>
        </div>
      </div>
    );
  }

  if (step === "datetime") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <button
          type="button"
          onClick={() => setStep(matchedPatient ? "welcome" : "identify")}
          className="mb-6 flex items-center gap-2 text-sm font-bold text-brown-400 transition-colors hover:text-brown-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </button>

        <h2 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-brown-900">
          Pick a time that works for you
        </h2>
        <p className="mb-8 text-center text-base font-medium text-brown-400">
          {checkedMatch && !matchedPatient
            ? "We couldn't find you as an existing patient — no problem, this books you as a new one."
            : "We'll confirm treatment details at the clinic."}
        </p>

        <div className="rounded-[24px] border border-beige-300 bg-surface p-6 shadow-soft md:p-8">
          <div className="mb-6 flex gap-3 overflow-x-auto pb-1">
            {NEXT_DAYS.map((d) => (
              <button
                key={d.dateStr}
                type="button"
                onClick={() => setDate(d.dateStr)}
                className={`flex min-w-[80px] flex-col items-center rounded-2xl border-2 p-4 transition-all ${
                  date === d.dateStr ? "border-rust-600 bg-white shadow-soft" : "border-transparent bg-beige-100 hover:bg-beige-200"
                }`}
              >
                <span className={`text-xs font-bold uppercase ${date === d.dateStr ? "text-rust-600" : "text-brown-400"}`}>
                  {d.dayLabel}
                </span>
                <span className="mt-1 text-lg font-extrabold text-brown-900">{d.dayNum}</span>
              </button>
            ))}
          </div>

          <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {TIME_SLOTS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTime(t)}
                className={`rounded-xl border py-3 text-sm font-bold transition-all ${
                  time === t
                    ? "border-rust-600 bg-rust-100 text-rust-600"
                    : "border-beige-300 bg-white text-brown-900 hover:border-rust-600/50 hover:text-rust-600"
                }`}
              >
                {formatTime12h(t)}
              </button>
            ))}
          </div>

          {bookingError && <p className="mb-4 text-sm text-red-700">{bookingError}</p>}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleBook}
              disabled={!date || !time || booking}
              className="rounded-xl bg-rust-600 px-8 py-3.5 text-sm font-bold text-white shadow-soft transition-colors hover:bg-rust-600/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {booking ? "Booking…" : "Confirm Appointment"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md rounded-[24px] border border-beige-300 bg-surface p-8 shadow-soft md:p-12">
      <h2 className="mb-2 text-center text-3xl font-extrabold tracking-tight text-brown-900">Let&apos;s get you scheduled</h2>
      <p className="mb-10 text-center font-medium text-brown-400">
        New or returning, this books a consultation with the doctor, who&apos;ll recommend the right treatment for you.
      </p>

      <form onSubmit={handleLookup} className="space-y-5">
        <div>
          <label className="mb-2 block text-sm font-bold text-brown-900">Full Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            autoFocus
            required
            className="w-full rounded-xl border border-beige-300 bg-beige-100/50 px-5 py-4 font-medium text-brown-900 outline-none transition-all focus:border-rust-600 focus:ring-1 focus:ring-rust-600"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold text-brown-900">Phone Number</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            required
            className="w-full rounded-xl border border-beige-300 bg-beige-100/50 px-5 py-4 font-medium text-brown-900 outline-none transition-all focus:border-rust-600 focus:ring-1 focus:ring-rust-600"
          />
        </div>

        {lookupError && <p className="text-sm text-red-700">{lookupError}</p>}

        <button
          type="submit"
          disabled={lookupLoading}
          className="mt-4 w-full rounded-xl bg-rust-600 py-4 text-lg font-bold text-white shadow-soft transition-all hover:bg-rust-600/90 disabled:opacity-50"
        >
          {lookupLoading ? "Checking…" : "Check Availability"}
        </button>
      </form>
    </div>
  );
}

function formatVisitDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

// "Last done: Oct 12, 2024" on a Book Again card — shorter than
// formatVisitDate above (no weekday), matching the design's own label.
function formatShortDate(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
