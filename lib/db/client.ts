import "server-only";
import { readFileSync } from "fs";
import { join } from "path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

// Prisma 7 requires an explicit driver adapter at runtime (separate from
// prisma.config.ts, which only covers the CLI/migrations) — see
// https://pris.ly/d/driver-adapters.
//
// The `ssl` option is passed explicitly (CA contents read from disk) rather
// than relying on `pg` to parse `sslmode`/`sslrootcert` out of the
// connection string itself — that parsing is inconsistent across `pg`
// versions, so this is the reliable way to get AWS RDS's required
// verify-full TLS working. global-bundle.pem is AWS's public RDS CA
// bundle (https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem),
// checked into the project root and INTO git (see .gitignore's explicit
// `!global-bundle.pem` exception to the general `*.pem` rule) — it's not a
// secret, and a deploy that clones from git needs the actual file on disk
// for this readFileSync to find at runtime.
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    ca: readFileSync(join(process.cwd(), "global-bundle.pem"), "utf-8"),
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
