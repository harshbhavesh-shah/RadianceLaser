"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// The root error boundary for the whole app — catches any render error
// that escapes every page's own error handling. Next.js only ever mounts
// this in place of the real root layout, so it has to render its own
// <html>/<body> from scratch rather than relying on app/layout.tsx.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas font-sans text-brown-900 antialiased">
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
          <h1 className="font-display text-xl font-medium text-brown-900">Something went wrong.</h1>
          <p className="max-w-sm text-sm text-brown-400">
            We've been notified and are looking into it. Try reloading the page.
          </p>
          <button
            onClick={reset}
            className="rounded-md bg-brown-900 px-4 py-2 text-sm font-semibold text-beige-200 transition-colors hover:bg-gold-600"
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
