"use client";

import { useState } from "react";
import { CalendarCheck, ChevronLeft, RotateCcw } from "lucide-react";
import { lookupPatientAction, submitBookingAction, type MatchedPatient } from "@/app/book/[clinicId]/actions";
import { todayLocalStr, parseDateStr } from "@/lib/calendar";

type Step = "lookup" | "book" | "success";

const INPUT_CLASS =
  "w-full rounded-md border border-beige-300 bg-canvas px-3.5 py-2.5 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500";
const LABEL_CLASS = "mb-1.5 block text-sm font-medium text-brown-700";

function formatVisitDate(dateStr: string): string {
  if (!dateStr) return "";
  return parseDateStr(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

// This page only ever books a consultation — a visitor booking online
// doesn't know which treatment they need yet, new patient or returning.
// The doctor decides that at the consultation itself, so there's
// deliberately no treatment picker anywhere in this flow (see
// app/book/[clinicId]/actions.ts).
export default function BookingClient({ clinicId }: { clinicId: string }) {
  const [step, setStep] = useState<Step>("lookup");

  // Carried from the lookup step into the booking form.
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [matchedPatient, setMatchedPatient] = useState<MatchedPatient | null>(null);
  const [checkedMatch, setCheckedMatch] = useState(false); // true once lookup has run, even if it found nothing

  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [date, setDate] = useState(todayLocalStr());
  const [time, setTime] = useState("10:00");
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
    setMatchedPatient(result.matched ? result.patient : null);
    setStep("book");
  }

  async function handleBook(e: React.FormEvent) {
    e.preventDefault();
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
    setStep("lookup");
    setName("");
    setPhone("");
    setMatchedPatient(null);
    setCheckedMatch(false);
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
          Consultation on {formatVisitDate(date)} at {formatTimeLabel(time)}. We&apos;ll see you then — call the
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
            <p className="mt-1 text-sm text-brown-600">Let&apos;s get your next consultation booked.</p>
          </>
        ) : (
          <>
            <h1 className="mt-3 font-display text-lg font-medium text-brown-900">Book your consultation</h1>
            <p className="mt-1 text-sm text-brown-600">
              {checkedMatch
                ? "We couldn't find you as an existing patient — no problem, book as a new patient below."
                : "The doctor will assess you and recommend the right treatment, so there's nothing to choose here."}
            </p>
          </>
        )}

        <form onSubmit={handleBook} className="mt-5 space-y-4">
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
              placeholder="e.g. concerns you'd like the doctor to look at"
            />
          </div>

          {bookingError && <p className="text-sm text-red-700">{bookingError}</p>}

          <button
            type="submit"
            disabled={booking}
            className="w-full rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
          >
            {booking ? "Booking…" : "Confirm Consultation"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface p-6 shadow-card ring-1 ring-beige-300 sm:p-7">
      <h1 className="font-display text-lg font-medium text-brown-900">Book a Consultation</h1>
      <p className="mt-1 text-sm text-brown-600">
        Enter your details and we&apos;ll get you on the schedule. New or returning, this books a consultation with
        the doctor, who&apos;ll recommend the right treatment for you.
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
