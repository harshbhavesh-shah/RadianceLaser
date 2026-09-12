import * as Sentry from "@sentry/nextjs";

// Runs in the Edge runtime — middleware.ts, and any route explicitly opted
// into it. Kept minimal on purpose: the Edge runtime can't run the
// Firebase Admin SDK either (see middleware.ts's own comment on this), so
// there's little happening here beyond the lightweight cookie-presence
// check, but a crash there would otherwise go unreported same as anywhere
// else.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});
