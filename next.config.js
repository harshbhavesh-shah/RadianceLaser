/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    serverActions: {
      // Default is 1mb. PatientPhotoUploadModal sends a compressed base64
      // image (up to ~830KB — see lib/imageCompression.ts) as a Server
      // Action's request body now that photos live in Postgres
      // (lib/db/patientPhotos.ts) instead of a direct Firestore write —
      // raised for headroom over the encoding/field overhead on top of the
      // image data itself.
      bodySizeLimit: "2mb",
    },
    // lib/db/client.ts reads global-bundle.pem (AWS RDS's CA bundle) off
    // disk at runtime via a plain readFileSync(process.cwd()) — Vercel's
    // build only bundles files a serverless function's code statically
    // imports/requires (via @vercel/nft file tracing), so a file touched
    // only through a dynamic fs call is invisible to it and gets left out
    // of the deployed function, throwing ENOENT in production even though
    // `next build && next start` locally (running from the full repo, not
    // a traced/pruned bundle) works fine. This explicitly forces it into
    // every route's function bundle.
    outputFileTracingIncludes: {
      "/**": ["./global-bundle.pem"],
    },
  },
};

module.exports = nextConfig;
