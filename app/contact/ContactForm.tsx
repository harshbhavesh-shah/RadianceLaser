"use client";

import { useFormState, useFormStatus } from "react-dom";
import { submitContactAction, type ContactFormState } from "./actions";

const initialState: ContactFormState = {};

const fieldClasses =
  "w-full rounded-md border border-beige-300 bg-canvas px-3.5 py-2.5 text-sm text-brown-900 outline-none placeholder:text-brown-400 focus:border-gold-500 focus:bg-surface focus:ring-1 focus:ring-gold-500";

export default function ContactForm() {
  const [state, formAction] = useFormState(submitContactAction, initialState);

  if (state.success) {
    return (
      <div className="rounded-xl border border-beige-300 bg-surface p-8 text-center">
        <p className="font-display text-lg font-bold text-brown-900">Message sent.</p>
        <p className="mt-1.5 text-sm text-brown-600">
          We&apos;ll get back to you by email as soon as we can.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Honeypot: real visitors never see this field, so anything that
          fills it in is a bot. Kept off-screen rather than display:none —
          some bots skip fields hidden that way. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute -left-[9999px] h-0 w-0"
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-brown-700">
            Name
          </label>
          <input id="name" name="name" type="text" required className={fieldClasses} placeholder="Your name" />
        </div>
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-brown-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className={fieldClasses}
            placeholder="you@clinic.com"
          />
        </div>
      </div>

      <div>
        <label htmlFor="message" className="mb-1.5 block text-sm font-medium text-brown-700">
          Message
        </label>
        <textarea
          id="message"
          name="message"
          required
          rows={6}
          className={fieldClasses}
          placeholder="What's going on? Include your clinic name if this is about your account."
        />
      </div>

      {state.error && <p className="text-sm text-red-700">{state.error}</p>}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center gap-2 rounded-md bg-brown-900 px-6 py-3 text-sm font-semibold text-beige-100 transition-colors hover:bg-gold-600 disabled:opacity-50"
    >
      {pending ? "Sending…" : "Send message"}
    </button>
  );
}
