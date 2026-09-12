import * as Sentry from "@sentry/nextjs";

// Runs once per server instance (Node.js runtime — see instrumentation.ts).
// Reuses the same DSN as the client config; a single Sentry project holds
// both browser and server events, distinguished by their own tags.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  // 100% of errors are always captured regardless of this — this only
  // controls performance-trace sampling, which costs quota. Low on purpose
  // for a single-clinic-scale app; raise it if request tracing (not just
  // errors) becomes worth the quota.
  tracesSampleRate: 0.1,
});
