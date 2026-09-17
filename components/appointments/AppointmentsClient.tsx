"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import AppointmentListView from "./AppointmentListView";
import CalendarDayView from "./CalendarDayView";
import CalendarWeekView from "./CalendarWeekView";
import CalendarMonthView from "./CalendarMonthView";
import AppointmentFormModal from "./AppointmentFormModal";
import PatientMiniPanel from "./PatientMiniPanel";
import UnlinkedBookingPanel from "./UnlinkedBookingPanel";
import { useIsDesktop } from "@/hooks/useIsDesktop";
import { useSidebarCollapse } from "@/components/SidebarContext";
import {
  addDays,
  getWeekDays,
  formatMonthLabel,
  formatWeekLabel,
  formatDayLabel,
} from "@/lib/calendar";
import type { Appointment, Package, Patient, Visit } from "@/types";

type ViewMode = "list" | "calendar";
type CalendarMode = "day" | "week" | "month";
type ModalState =
  | { mode: "closed" }
  | { mode: "create"; date?: string; time?: string }
  | { mode: "edit"; appointment: Appointment };

// Keep both animations (sidebar collapse + panel slide) on the exact same
// timing so they read as one coordinated motion instead of two things
// racing each other.
const PANEL_TRANSITION_MS = 300;

export default function AppointmentsClient({
  clinicId,
  patients: initialPatients,
  initialAppointments,
  visits,
  packages,
  visitIdByAppointmentId,
  receiptedAppointmentIds,
}: {
  clinicId: string;
  patients: Patient[];
  initialAppointments: Appointment[];
  visits: Visit[];
  packages: Package[];
  visitIdByAppointmentId: Record<string, string>;
  receiptedAppointmentIds: Record<string, true>;
}) {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [patients, setPatients] = useState<Patient[]>(initialPatients);
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" });
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lets the "Patient Visit" shortcut elsewhere in the app (the dashboard
  // header) land straight on an already-open booking form instead of just
  // this page — see the button's href (?newAppointment=1). Stripped from
  // the URL right after so a refresh or back-navigation doesn't reopen it.
  useEffect(() => {
    if (searchParams.get("newAppointment") === "1") {
      setModalState({ mode: "create" });
      router.replace("/dashboard/appointments");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // panelAppointment drives the open/closed animation state; renderedPanelAppointment
  // stays populated for a moment after closing so the exit animation has
  // something to show instead of the content vanishing mid-slide.
  const [panelAppointment, setPanelAppointment] = useState<Appointment | null>(null);
  const [renderedPanelAppointment, setRenderedPanelAppointment] = useState<Appointment | null>(null);
  const unmountTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDesktop = useIsDesktop();
  const { setTemporaryOverride } = useSidebarCollapse();

  const patientsById = new Map(patients.map((p) => [p.id, p]));

  function handleAppointmentClick(appt: Appointment) {
    if (isDesktop) {
      openPatientPanel(appt);
    } else {
      // No room for the side panel on mobile — keep the direct-edit
      // behavior that existed before this feature.
      setModalState({ mode: "edit", appointment: appt });
    }
  }

  function openPatientPanel(appt: Appointment) {
    if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
    setRenderedPanelAppointment(appt);
    setPanelAppointment(appt);
    setTemporaryOverride(true); // auto-collapse the main sidebar to make room
  }

  function closePatientPanel() {
    setPanelAppointment(null);
    setTemporaryOverride(null); // hand control back to the user's own preference
    // Keep rendering the last patient's content while the panel slides/fades
    // out, then actually drop it once the transition has finished.
    unmountTimerRef.current = setTimeout(() => {
      setRenderedPanelAppointment(null);
    }, PANEL_TRANSITION_MS);
  }

  useEffect(() => {
    return () => {
      if (unmountTimerRef.current) clearTimeout(unmountTimerRef.current);
      // Bug fix: navigating to another /dashboard page (via the sidebar,
      // browser back, etc.) while the mini patient panel is still open
      // unmounts this component WITHOUT ever calling closePatientPanel(),
      // so the sidebar's temporary "collapsed to make room for the panel"
      // override was never being reset. Since SidebarProvider lives above
      // this component at the persistent dashboard layout level, that stuck
      // override then forced the sidebar collapsed on every other page too
      // — and since collapsed prefers the override over the user's own
      // preference, even the sidebar's own expand/collapse button couldn't
      // undo it (it only ever touches the preference, not the override).
      // Clearing the override on unmount, unconditionally, means leaving
      // this page always hands control back, no matter how the panel was
      // left open.
      setTemporaryOverride(null);
    };
  }, [setTemporaryOverride]);

  function handleSaved(saved: Appointment) {
    setAppointments((prev) => {
      const exists = prev.some((a) => a.id === saved.id);
      return exists ? prev.map((a) => (a.id === saved.id ? saved : a)) : [saved, ...prev];
    });
    setModalState({ mode: "closed" });
    // Keep the panel in sync if we just edited the appointment it's showing.
    setPanelAppointment((prev) => (prev && prev.id === saved.id ? saved : prev));
    setRenderedPanelAppointment((prev) => (prev && prev.id === saved.id ? saved : prev));
  }

  function handleLinked(updatedAppointment: Appointment, patient: Patient) {
    handleSaved(updatedAppointment);
    setPatients((prev) => (prev.some((p) => p.id === patient.id) ? prev : [...prev, patient]));
  }

  function handleDeleted(id: string) {
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    setModalState({ mode: "closed" });
    if (panelAppointment?.id === id) closePatientPanel();
  }

  function goToday() {
    setAnchor(new Date());
  }

  function goPrev() {
    setAnchor((prev) =>
      calendarMode === "day"
        ? addDays(prev, -1)
        : calendarMode === "week"
          ? addDays(prev, -7)
          : new Date(prev.getFullYear(), prev.getMonth() - 1, 1)
    );
  }

  function goNext() {
    setAnchor((prev) =>
      calendarMode === "day"
        ? addDays(prev, 1)
        : calendarMode === "week"
          ? addDays(prev, 7)
          : new Date(prev.getFullYear(), prev.getMonth() + 1, 1)
    );
  }

  const periodLabel =
    calendarMode === "day"
      ? formatDayLabel(anchor)
      : calendarMode === "week"
        ? formatWeekLabel(getWeekDays(anchor))
        : formatMonthLabel(anchor);

  const isPanelOpen = !!panelAppointment;
  const renderedPanelPatient =
    renderedPanelAppointment && renderedPanelAppointment.patientId
      ? patientsById.get(renderedPanelAppointment.patientId)
      : null;

  return (
    <div className="flex items-stretch gap-5">
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h1 className="m-0 text-3xl font-extrabold tracking-tight text-brown-900">Schedule</h1>
          <button
            onClick={() => setModalState({ mode: "create" })}
            className="inline-flex flex-shrink-0 items-center gap-2 rounded-xl bg-rust-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-rust-700"
          >
            <Plus size={16} strokeWidth={2.5} />
            New Appointment
          </button>
        </div>

        <div className="mb-6 flex flex-col items-center justify-between gap-4 rounded-[18px] border border-beige-300 bg-surface p-2 shadow-soft xl:flex-row">
          <div className="flex w-full items-center rounded-2xl bg-beige-100 p-1 xl:w-auto">
            <button
              onClick={() => setViewMode("list")}
              className={`flex-1 rounded-xl px-5 py-2 text-sm font-bold transition-colors xl:flex-none ${
                viewMode === "list" ? "bg-surface text-rust-600 shadow-sm" : "text-brown-400 hover:text-brown-900"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`flex-1 rounded-xl px-5 py-2 text-sm font-bold transition-colors xl:flex-none ${
                viewMode === "calendar" ? "bg-surface text-rust-600 shadow-sm" : "text-brown-400 hover:text-brown-900"
              }`}
            >
              Calendar
            </button>
          </div>

          {viewMode === "calendar" && (
            <>
              <div className="flex items-center gap-3">
                <button
                  onClick={goPrev}
                  className="rounded-xl p-2 text-brown-400 transition-colors hover:bg-beige-100 hover:text-brown-900"
                  aria-label="Previous"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goToday}
                  className="rounded-xl bg-beige-100 px-4 py-2 text-sm font-bold text-brown-900 transition-colors hover:bg-beige-200"
                >
                  Today
                </button>
                <span className="min-w-[150px] text-center text-sm font-extrabold text-brown-900">
                  {periodLabel}
                </span>
                <button
                  onClick={goNext}
                  className="rounded-xl p-2 text-brown-400 transition-colors hover:bg-beige-100 hover:text-brown-900"
                  aria-label="Next"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              <div className="flex w-full items-center rounded-2xl bg-beige-100 p-1 xl:w-auto">
                {(["day", "week", "month"] as CalendarMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCalendarMode(mode)}
                    className={`flex-1 rounded-xl px-5 py-2 text-sm font-bold capitalize transition-colors xl:flex-none ${
                      calendarMode === mode
                        ? "bg-surface text-rust-600 shadow-sm"
                        : "text-brown-400 hover:text-brown-900"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {viewMode === "list" && (
          <AppointmentListView
            appointments={appointments}
            onEdit={handleAppointmentClick}
            onCreateNew={() => setModalState({ mode: "create" })}
            visitIdByAppointmentId={visitIdByAppointmentId}
            receiptedAppointmentIds={receiptedAppointmentIds}
          />
        )}

        {viewMode === "calendar" && calendarMode === "day" && (
          <CalendarDayView
            date={anchor}
            appointments={appointments}
            onEdit={handleAppointmentClick}
            onCreateAt={(date, time) => setModalState({ mode: "create", date, time })}
          />
        )}

        {viewMode === "calendar" && calendarMode === "week" && (
          <CalendarWeekView
            days={getWeekDays(anchor)}
            appointments={appointments}
            onEdit={handleAppointmentClick}
            onCreateAt={(date, time) => setModalState({ mode: "create", date, time })}
          />
        )}

        {viewMode === "calendar" && calendarMode === "month" && (
          <CalendarMonthView
            anchor={anchor}
            appointments={appointments}
            onEdit={handleAppointmentClick}
            onCreateAt={(date, time) => setModalState({ mode: "create", date, time })}
            onShowDay={(date) => {
              setAnchor(date);
              setCalendarMode("day");
            }}
          />
        )}
      </div>

      <div
        className="hidden h-full flex-shrink-0 overflow-hidden md:block"
        style={{ width: isPanelOpen ? 320 : 0, transition: "width 300ms ease-in-out" }}
      >
        <div
          className="h-full"
          style={{
            width: 320,
            opacity: isPanelOpen ? 1 : 0,
            transition: `opacity 200ms ease-in-out ${isPanelOpen ? "100ms" : "0ms"}`,
          }}
        >
          {renderedPanelAppointment && renderedPanelPatient && (
            <PatientMiniPanel
              patient={renderedPanelPatient}
              appointment={renderedPanelAppointment}
              visits={visits.filter((v) => v.patientId === renderedPanelPatient.id)}
              packages={packages.filter((p) => p.patientId === renderedPanelPatient.id)}
              visitIdByAppointmentId={visitIdByAppointmentId}
              receiptedAppointmentIds={receiptedAppointmentIds}
              onClose={closePatientPanel}
              onEditAppointment={() =>
                setModalState({ mode: "edit", appointment: renderedPanelAppointment })
              }
            />
          )}
          {renderedPanelAppointment && !renderedPanelPatient && (
            <UnlinkedBookingPanel
              appointment={renderedPanelAppointment}
              onClose={closePatientPanel}
              onLinked={handleLinked}
              onEditAppointment={() =>
                setModalState({ mode: "edit", appointment: renderedPanelAppointment })
              }
            />
          )}
        </div>
      </div>

      {modalState.mode !== "closed" && (
        <AppointmentFormModal
          clinicId={clinicId}
          patients={patients}
          appointments={appointments}
          appointment={modalState.mode === "edit" ? modalState.appointment : null}
          presetDate={modalState.mode === "create" ? modalState.date : undefined}
          presetTime={modalState.mode === "create" ? modalState.time : undefined}
          onClose={() => setModalState({ mode: "closed" })}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onPatientCreated={(patient) => setPatients((prev) => [...prev, patient])}
        />
      )}
    </div>
  );
}
