import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { RDS_GLOBAL_CA_BUNDLE } from "@/lib/db/rdsCaBundle";

// Prisma 7 requires an explicit driver adapter at runtime (separate from
// prisma.config.ts, which only covers the CLI/migrations) — see
// https://pris.ly/d/driver-adapters.
//
// The `ssl` option is passed explicitly rather than relying on `pg` to
// parse `sslmode`/`sslrootcert` out of the connection string itself — that
// parsing is inconsistent across `pg` versions, so this is the reliable
// way to get AWS RDS's required verify-full TLS working.
//
// The CA bundle used to be read from disk at runtime (readFileSync a
// global-bundle.pem in the project root) — that broke in production on
// Vercel: a serverless function's deployed bundle only includes files its
// code statically imports/requires (via @vercel/nft file tracing), so a
// file only ever touched through a dynamic fs call was silently dropped,
// throwing ENOENT even though `next build && next start` locally (running
// from the full repo, not a traced bundle) never showed the problem, and
// even though outputFileTracingIncludes (tried first) didn't reliably fix
// it either. Embedding the cert as a source-level string constant (see
// lib/db/rdsCaBundle.ts) sidesteps the whole file-tracing question — there
// is no runtime file read to trace.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: RDS_GLOBAL_CA_BUNDLE,
    rejectUnauthorized: true,
  },
});

// Standard Next.js + Prisma singleton pattern — in dev, Next's hot reload
// re-executes this module on every file change, which would otherwise spin
// up a fresh PrismaClient (and a fresh connection pool) each time until the
// database refuses new connections. Stashing the instance on `globalThis`
// survives the reload; production only ever creates one anyway since there's
// no hot-reloading there.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
