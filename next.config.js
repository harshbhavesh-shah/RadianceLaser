const { withSentryConfig } = require("@sentry/nextjs");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Required for instrumentation.ts (Sentry's server/edge init hook) to
    // load on this Next.js version — stabilized (no flag needed) in Next 15.
    instrumentationHook: true,
    serverActions: {
      // Default is 1mb. PatientPhotoUploadModal sends a compressed base64
      // image (up to ~830KB — see lib/imageCompression.ts) as a Server
      // Action's request body — the image is decoded and uploaded to
      // Cloudflare R2 server-side (lib/db/patientPhotos.ts, lib/r2.ts)
      // rather than stored inline, but the request itself still carries
      // the full base64 payload, hence the raised limit.
      bodySizeLimit: "2mb",
    },
  },
};

// Wraps the build to upload source maps to Sentry so stack traces show
// real file/line numbers instead of minified bundle positions. Silently
// skips the upload step (build still succeeds) if SENTRY_AUTH_TOKEN/
// SENTRY_ORG aren't set — only SENTRY_PROJECT and the DSN are configured
// so far, so uploads are a no-op until an auth token is added.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  disableLogger: true,
});
