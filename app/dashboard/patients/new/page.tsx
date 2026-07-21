"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createPatientAction, type CreatePatientState } from "./actions";

const initialState: CreatePatientState = {};

export default function NewPatientPage() {
  const [state, formAction] = useFormState(createPatientAction, initialState);

  return (
    <div className="max-w-2xl">
      <Link href="/dashboard/patients" className="text-sm text-brown-600 hover:text-gold-600">
        ← Back to Patients
      </Link>

      <h1 className="mt-3 font-display text-2xl font-medium text-brown-900">New Patient</h1>
      <div className="mt-2 mb-8 h-[2px] w-8 bg-gold-500" />

      <form action={formAction} className="rounded-xl bg-surface p-6 shadow-soft ring-1 ring-beige-300">
        <div className="grid grid-cols-2 gap-5">
          <Field label="Full Name" name="name" required />
          <Field label="Contact Number" name="phone" type="tel" required />
          <Field label="Email" name="email" type="email" />
          <Field label="Age" name="age" type="number" min={0} />
          <SelectField
            label="Gender"
            name="gender"
            options={["Female", "Male", "Other"]}
          />
          <SelectField
            label="Fitzpatrick Skin Type"
            name="skinType"
            options={["I", "II", "III", "IV", "V", "VI"]}
            optionLabel={(v) => `Type ${v}`}
          />
        </div>

        <div className="mt-5">
          <Field label="Address" name="address" />
        </div>

        <div className="mt-5">
          <label htmlFor="contraindications" className="mb-1.5 block text-sm font-medium text-brown-700">
            Contraindications / Notes
          </label>
          <textarea
            id="contraindications"
            name="contraindications"
            rows={3}
            placeholder="Pregnancy, isotretinoin use, photosensitizing medication, recent sun exposure, etc."
            className="w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none transition-colors focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
          />
        </div>

        {state.error && <p className="mt-4 text-sm text-red-700">{state.error}</p>}

        <div className="mt-6 flex justify-end gap-3">
          <Link
            href="/dashboard/patients"
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

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-brown-900 px-5 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-60"
    >
      {pending ? "Saving…" : "Save Patient"}
    </button>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  min?: number;
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
}: {
  label: string;
  name: string;
  options: string[];
  optionLabel?: (value: string) => string;
}) {
  return (
    <div>
      <label htmlFor={name} className="mb-1.5 block text-sm font-medium text-brown-700">
        {label}
      </label>
      <select
        id={name}
        name={name}
        defaultValue=""
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
