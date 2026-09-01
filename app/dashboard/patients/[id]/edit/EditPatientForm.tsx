"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { updatePatientAction, erasePatientAction, type UpdatePatientState, type EraseState } from "./actions";
import type { Patient } from "@/types";
import type { PatientRetentionCheck } from "@/lib/db/patients";

const initialState: UpdatePatientState = {};
const initialEraseState: EraseState = {};

export default function EditPatientForm({
  patient,
  canErase,
  retention,
}: {
  patient: Patient;
  canErase: boolean;
  retention: PatientRetentionCheck | null;
}) {
  const boundAction = updatePatientAction.bind(null, patient.id);
  const [state, formAction] = useFormState(boundAction, initialState);

  return (
    <div className="max-w-2xl">
      <Link href={`/dashboard/patients/${patient.id}`} className="text-sm text-brown-600 hover:text-gold-600">
        ← Back to {patient.name}
      </Link>

      <h1 className="mt-3 font-display text-2xl font-medium text-brown-900">Edit Patient</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <form action={formAction} className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Full Name" name="name" required defaultValue={patient.name} />
          <Field label="Contact Number" name="phone" type="tel" required defaultValue={patient.phone} />
          <Field label="Email" name="email" type="email" defaultValue={patient.email} />
          <Field label="Age" name="age" type="number" min={0} defaultValue={patient.age?.toString()} />
          <SelectField
            label="Gender"
            name="gender"
            options={["Female", "Male", "Other"]}
            defaultValue={patient.gender}
          />
          <SelectField
            label="Fitzpatrick Skin Type"
            name="skinType"
            options={["I", "II", "III", "IV", "V", "VI"]}
            optionLabel={(v) => `Type ${v}`}
            defaultValue={patient.skinType}
          />
        </div>

        <div className="mt-5">
          <Field label="Address" name="address" defaultValue={patient.address} />
        </div>

        <div className="mt-5">
          <label htmlFor="contraindications" className="mb-1.5 block text-sm font-medium text-brown-700">
            Contraindications / Notes
          </label>
          <textarea
            id="contraindications"
            name="contraindications"
            rows={3}
            defaultValue={patient.contraindications}
            placeholder="Pregnancy, isotretinoin use, photosensitizing medication, recent sun exposure, etc."
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          />
        </div>

        {state.error && <p className="mt-4 text-sm text-red-700">{state.error}</p>}

        {state.duplicate && state.duplicate.id !== patient.id && (
          <div className="mt-4 rounded-md border border-gold-500/40 bg-gold-100/50 p-4 text-sm">
            <p className="text-brown-800">
              A different patient, <span className="font-medium">{state.duplicate.name}</span>, already has this
              phone number ({state.duplicate.phone}).
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-4">
              <Link
                href={`/dashboard/patients/${state.duplicate.id}`}
                className="text-sm font-medium text-gold-600 hover:underline"
              >
                View that patient →
              </Link>
              <input type="hidden" name="confirmDuplicate" value="1" />
              <SubmitButton label="Save Anyway" />
            </div>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href={`/dashboard/patients/${patient.id}`}
            className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
          >
            Cancel
          </Link>
          <SubmitButton />
        </div>
      </form>

      {canErase && retention && <ErasePatientSection patient={patient} retention={retention} />}
    </div>
  );
}

function ErasePatientSection({ patient, retention }: { patient: Patient; retention: PatientRetentionCheck }) {
  const boundAction = erasePatientAction.bind(null, patient.id);
  const [state, formAction] = useFormState(boundAction, initialEraseState);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6">
      <h2 className="font-display text-lg font-medium text-red-900">Erase Patient Data</h2>
      <p className="mt-1.5 text-sm text-red-800">
        Permanently deletes {patient.name}&apos;s record and everything tied to it — visits, packages,
        appointments, receipts, consent forms, and photos. This cannot be undone.
      </p>

      {retention.eligible ? (
        <p className="mt-2 text-xs text-red-700">
          Eligible for erasure — the 3-year retention period required by Indian Medical Council Regulation 1.3.1
          has passed.
        </p>
      ) : (
        <p className="mt-2 text-xs text-red-700">
          Not yet eligible — Indian Medical Council Regulation 1.3.1 requires patient records to be retained for
          3 years from the last visit. This record can be erased starting{" "}
          {new Date(retention.retentionFloorEndsAt).toLocaleDateString("en-IN")}.
        </p>
      )}

      {!confirming ? (
        <button
          type="button"
          disabled={!retention.eligible}
          onClick={() => setConfirming(true)}
          className="mt-4 rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-800 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Erase this patient&apos;s data…
        </button>
      ) : (
        <form action={formAction} className="mt-4 space-y-3">
          <label htmlFor="confirmName" className="block text-sm font-medium text-red-900">
            Type <span className="font-semibold">{patient.name}</span> to confirm
          </label>
          <input
            id="confirmName"
            name="confirmName"
            type="text"
            autoComplete="off"
            className="w-full max-w-sm rounded-md border border-red-300 bg-white px-3 py-2 text-sm text-brown-900 outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500"
          />
          {state.error && <p className="text-sm text-red-700">{state.error}</p>}
          <div className="flex gap-3">
            <EraseSubmitButton />
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="rounded-md px-4 py-2 text-sm font-medium text-brown-600 hover:bg-beige-200"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function EraseSubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-800 disabled:opacity-60"
    >
      {pending ? "Erasing…" : "Permanently Erase"}
    </button>
  );
}

function SubmitButton({ label = "Save Changes" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  min,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-brown-700">
        {label}
        {required && <span className="text-gold-600"> *</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        min={min}
        defaultValue={defaultValue}
        className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  optionLabel,
  defaultValue,
}: {
  label: string;
  name: string;
  options: string[];
  optionLabel?: (value: string) => string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-brown-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue={defaultValue || ""}
        className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
      >
        <option value="">— Select —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {optionLabel ? optionLabel(opt) : opt}
          </option>
        ))}
      </select>
    </div>
  );
}
