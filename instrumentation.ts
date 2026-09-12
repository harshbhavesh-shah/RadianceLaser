import * as Sentry from "@sentry/nextjs";

// Next.js calls this once per server runtime it spins up (Node.js for
// normal pages/API routes, Edge for middleware.ts) — this is the one place
// that knows which runtime it's in, so it's what decides which of the two
// server-side Sentry configs actually loads.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Reports errors thrown inside Server Components/Server Actions that Next
// itself catches and turns into a rendered error boundary — without this
// hook those never reach Sentry.init's own instrumentation at all.
export const onRequestError = Sentry.captureRequestError;
