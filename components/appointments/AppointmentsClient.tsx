"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import AppointmentListView from "./AppointmentListView";
import CalendarDayView from "./CalendarDayView";
import CalendarWeekView from "./CalendarWeekView";
import CalendarMonthView from "./CalendarMonthView";
import AppointmentFormModal from "./AppointmentFormModal";
import PatientMiniPanel from "./PatientMiniPanel";
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
  patients,
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
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("week");
  const [anchor, setAnchor] = useState(new Date());
  const [modalState, setModalState] = useState<ModalState>({ mode: "closed" });

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
    };
  }, []);

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
  const renderedPanelPatient = renderedPanelAppointment
    ? patientsById.get(renderedPanelAppointment.patientId)
    : null;

  return (
    <div className="flex items-stretch gap-5">
      <div className="min-w-0 flex-1">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-medium text-brown-900">Schedule</h1>
            <div className="mt-2 h-[2px] w-8 bg-gold-500" />
          </div>
          <button
            onClick={() => setModalState({ mode: "create" })}
            className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            + New Appointment
          </button>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-lg bg-surface p-1 shadow-soft ring-1 ring-beige-300">
            <button
              onClick={() => setViewMode("list")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "list" ? "bg-brown-900 text-beige-200" : "text-brown-600 hover:text-brown-900"
              }`}
            >
              List
            </button>
            <button
              onClick={() => setViewMode("calendar")}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "calendar" ? "bg-brown-900 text-beige-200" : "text-brown-600 hover:text-brown-900"
              }`}
            >
              Calendar
            </button>
          </div>

          {viewMode === "calendar" && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={goPrev}
                  className="rounded-md p-1.5 text-brown-600 hover:bg-beige-200"
                  aria-label="Previous"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={goToday}
                  className="rounded-md border border-beige-300 px-3 py-1 text-sm font-medium text-brown-700 hover:border-gold-500 hover:text-gold-600"
                >
                  Today
                </button>
                <button
                  onClick={goNext}
                  className="rounded-md p-1.5 text-brown-600 hover:bg-beige-200"
                  aria-label="Next"
                >
                  <ChevronRight size={18} />
                </button>
                <span className="ml-1 text-sm font-medium text-brown-900">{periodLabel}</span>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-surface p-1 shadow-soft ring-1 ring-beige-300">
                {(["day", "week", "month"] as CalendarMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setCalendarMode(mode)}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                      calendarMode === mode
                        ? "bg-brown-900 text-beige-200"
                        : "text-brown-600 hover:text-brown-900"
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
        />
      )}
    </div>
  );
}
