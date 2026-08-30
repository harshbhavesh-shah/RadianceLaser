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
  },
};

module.exports = nextConfig;
