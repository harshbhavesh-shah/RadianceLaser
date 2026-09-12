import * as Sentry from "@sentry/nextjs";

// Runs in the browser. next.config.js's withSentryConfig wraps the webpack
// build so this file is picked up automatically — no manual import needed
// anywhere else.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  // Session Replay is off by default (it's a separate, much smaller quota
  // on the free tier) — sampleRate 0 means never record a normal session,
  // only ever a session that actually errors, and even that's off until
  // explicitly turned on below.
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
});
