"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Star } from "lucide-react";
import { submitFeedbackAction, type SubmitFeedbackState } from "./actions";

const initialState: SubmitFeedbackState = {};

export default function FeedbackForm({
  token,
  alreadyResponded,
  initialRating,
  initialComment,
}: {
  token: string;
  alreadyResponded: boolean;
  initialRating?: number;
  initialComment?: string;
}) {
  const boundAction = submitFeedbackAction.bind(null, token);
  const [state, formAction] = useFormState(boundAction, initialState);
  const [rating, setRating] = useState(initialRating || 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [justSubmitted, setJustSubmitted] = useState(false);

  if (state.success && !justSubmitted) setJustSubmitted(true);

  if (justSubmitted || (alreadyResponded && !state.success)) {
    return (
      <div className="mt-8 text-center">
        <p className="font-display text-lg font-medium text-brown-900">Thank you!</p>
        <p className="mt-1.5 text-sm text-brown-600">
          {justSubmitted
            ? "Your feedback has been recorded."
            : "You've already shared your feedback for this visit — thank you."}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="rating" value={rating} />

      <div className="flex justify-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setRating(n)}
            onMouseEnter={() => setHoverRating(n)}
            onMouseLeave={() => setHoverRating(0)}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            className="p-1 transition-transform hover:scale-110"
          >
            <Star
              size={32}
              className={(hoverRating || rating) >= n ? "fill-gold-500 text-gold-500" : "text-beige-300"}
            />
          </button>
        ))}
      </div>

      <textarea
        name="comment"
        defaultValue={initialComment}
        rows={3}
        placeholder="Anything you'd like to add? (optional)"
        className="mt-5 w-full rounded-md border border-beige-300 bg-canvas px-3 py-2 text-sm text-brown-900 outline-none focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500"
      />

      {state.error && <p className="mt-3 text-center text-sm text-red-700">{state.error}</p>}

      <SubmitButton disabled={rating === 0} />
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
      {pending ? "Sending…" : "Submit Feedback"}
    </button>
  );
}
