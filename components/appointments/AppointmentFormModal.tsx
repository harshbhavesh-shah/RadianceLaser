"use client";

import { useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { useSessionTypeConfig } from "@/lib/sessionTypeConfigContext";
import { todayLocalStr } from "@/lib/calendar";
import type { Appointment, AppointmentStatus, Patient, SessionType } from "@/types";

const DURATION_OPTIONS = [15, 30, 45, 60];
const STATUS_OPTIONS: { value: AppointmentStatus; label: string }[] = [
  { value: "booked", label: "Booked" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no-show", label: "No-Show" },
];

export default function AppointmentFormModal({
  clinicId,
  patients,
  appointment,
  presetDate,
  presetTime,
  onClose,
  onSaved,
  onDeleted,
}: {
  clinicId: string;
  patients: Patient[];
  appointment?: Appointment | null;
  presetDate?: string;
  presetTime?: string;
  onClose: () => void;
  onSaved: (appt: Appointment) => void;
  onDeleted?: (id: string) => void;
}) {
  const SESSION_TYPE_CONFIG = useSessionTypeConfig();
  const isEditing = !!appointment;

  const [patientQuery, setPatientQuery] = useState(appointment?.patientName || "");
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(
    appointment ? { id: appointment.patientId, name: appointment.patientName, phone: appointment.patientPhone } as Patient : null
  );
  const [showPatientResults, setShowPatientResults] = useState(false);

  const [sessionType, setSessionType] = useState<SessionType>(appointment?.sessionType || "qs");
  const [date, setDate] = useState(appointment?.date || presetDate || todayLocalStr());
  const [time, setTime] = useState(appointment?.time || presetTime || "10:00");
  const [durationMinutes, setDurationMinutes] = useState(appointment?.durationMinutes || 30);
  const [status, setStatus] = useState<AppointmentStatus>(appointment?.status || "booked");
  const [notes, setNotes] = useState(appointment?.notes || "");

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patientMatches = useMemo(() => {
    const q = patientQuery.trim().toLowerCase();
    if (!q || selectedPatient?.name === patientQuery) return [];
    return patients
      .filter((p) => p.name.toLowerCase().includes(q) || p.phone.includes(q))
      .slice(0, 6);
  }, [patientQuery, patients, selectedPatient]);

  function selectPatient(p: Patient) {
    setSelectedPatient(p);
    setPatientQuery(p.name);
    setShowPatientResults(false);
  }

  async function handleSave() {
    if (!selectedPatient) return setError("Select a patient first.");
    if (!time) return setError("Set a time.");

    setSaving(true);
    setError(null);

    const payload = {
      clinicId,
      patientId: selectedPatient.id,
      patientName: selectedPatient.name,
      patientPhone: selectedPatient.phone,
      sessionType,
      date,
      time,
      durationMinutes,
      status,
      ...(notes.trim() ? { notes: notes.trim() } : {}),
    };

    try {
      if (isEditing && appointment) {
        await updateDoc(doc(db, "appointments", appointment.id), payload);
        onSaved({ ...appointment, ...payload });
      } else {
        const createPayload = { ...payload, createdAt: Date.now() };
        const docRef = await addDoc(collection(db, "appointments"), createPayload);
        onSaved({ id: docRef.id, ...createPayload });
      }
    } catch (err) {
      console.error("Failed to save appointment:", err);
      setError("Couldn't save this appointment. Please try again.");
      setSaving(false);
      return;
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!appointment) return;
    if (!confirm("Delete this appointment? This can't be undone.")) return;

    setDeleting(true);
    try {
      await deleteDoc(doc(db, "appointments", appointment.id));
      onDeleted?.(appointment.id);
    } catch (err) {
      console.error("Failed to delete appointment:", err);
      setError("Couldn't delete this appointment. Please try again.");
      setDeleting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-brown-900/40 px-4">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-surface p-5 shadow-card sm:p-6">
        <h2 className="font-display text-lg font-medium text-brown-900">
          {isEditing ? "Edit Appointment" : "New Appointment"}
        </h2>
        <div className="mb-5 mt-1 h-[2px] w-8 bg-gold-500" />

        <div className="relative mb-4">
          <label className="mb-1.5 block text-sm font-medium text-brown-700">Patient</label>
          <input
            type="text"
            value={patientQuery}
            onChange={(e) => {
              setPatientQuery(e.target.value);
              setSelectedPatient(null);
              setShowPatientResults(true);
            }}
            onFocus={() => setShowPatientResults(true)}
            placeholder="Search by name or phone…"
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          />
          {showPatientResults && patientMatches.length > 0 && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-beige-300 bg-surface shadow-card">
              {patientMatches.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectPatient(p)}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gold-100/50"
                >
                  <span className="font-medium text-brown-900">{p.name}</span>
                  <span className="text-brown-400">{p.phone}</span>
                </button>
              ))}
            </div>
          )}
          {selectedPatient && (
            <p className="mt-1.5 text-xs text-gold-600">
              Selected: {selectedPatient.name} · {selectedPatient.phone}
            </p>
          )}
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Treatment</label>
            <select
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value as SessionType)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            >
              {(Object.keys(SESSION_TYPE_CONFIG) as SessionType[]).map((type) => (
                <option key={type} value={type}>
                  {SESSION_TYPE_CONFIG[type].label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Duration</label>
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(Number(e.target.value))}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            >
              {DURATION_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} min
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Time</label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            />
          </div>
        </div>

        {isEditing && (
          <div className="mb-4">
            <label className="mb-1.5 block text-sm font-medium text-brown-700">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as AppointmentStatus)}
              className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="mb-2">
          <label className="mb-1.5 block text-sm font-medium text-brown-700">
            Notes <span className="text-brown-400">(optional)</span>
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          />
        </div>

        {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

        <div className="mt-6 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="text-sm font-medium text-red-700 hover:underline disabled:opacity-60"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
