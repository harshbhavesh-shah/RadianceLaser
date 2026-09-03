"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { submitNoShowSurveyAction, type SubmitNoShowSurveyState } from "./actions";
import type { NoShowReason } from "@/types";

const REASON_OPTIONS: { value: NoShowReason; label: string }[] = [
  { value: "forgot", label: "I forgot" },
  { value: "schedule_conflict", label: "Something came up" },
  { value: "found_elsewhere", label: "I went somewhere else" },
  { value: "cost", label: "It was too expensive" },
  { value: "other", label: "Something else" },
];

const initialState: SubmitNoShowSurveyState = {};

export default function NoShowSurveyForm({
  token,
  alreadyResponded,
  initialReason,
  initialComment,
}: {
  token: string;
  alreadyResponded: boolean;
  initialReason?: NoShowReason;
  initialComment?: string;
}) {
  const boundAction = submitNoShowSurveyAction.bind(null, token);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [reason, setReason] = useState<NoShowReason | "">(initialReason || "");
  const [justSubmitted, setJustSubmitted] = useState(false);

  if (state.success && !justSubmitted) setJustSubmitted(true);

  if (justSubmitted || (alreadyResponded && !state.success)) {
    return (
      <div className="mt-8 text-center">
        <p className="font-display text-lg font-medium text-brown-900">Thanks for letting us know.</p>
        <p className="mt-1.5 text-sm text-brown-600">
          {justSubmitted
            ? "We've noted this and hope to see you again soon."
            : "You've already answered this for us. Thank you."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="reason" value={reason} />

      <div className="space-y-2">
        {REASON_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setReason(opt.value)}
            className={`w-full rounded-md border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
              reason === opt.value
                ? "border-gold-500 bg-gold-100 text-gold-600"
                : "border-beige-300 text-brown-700 hover:border-gold-500"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        defaultValue={initialComment}
        rows={2}
        placeholder="Anything else you'd like to add? (optional)"
        className="mt-4 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
      />

      {state.error && <p className="mt-3 text-center text-sm text-red-700">{state.error}</p>}

      <SubmitButton disabled={!reason} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="mt-5 w-full rounded-md bg-brown-900 px-5 py-2.5 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Submit"}
    </button>
  );
}
