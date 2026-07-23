"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { updatePatientAction, type UpdatePatientState } from "./actions";
import type { Patient } from "@/types";

const initialState: UpdatePatientState = {};

export default function EditPatientForm({ patient }: { patient: Patient }) {
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
    </div>
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
