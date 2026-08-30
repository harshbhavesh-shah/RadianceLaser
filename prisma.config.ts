// Prisma 7 moved connection config out of schema.prisma's datasource block
// and into this file for the CLI (migrate/db push/studio) — the generated
// PrismaClient at app runtime still reads DATABASE_URL itself, this is
// just what `npx prisma ...` commands use.
//
// This project keeps secrets in .env.local (matching Next.js's own env
// convention), not the bare .env plain `dotenv/config` loads by default —
// load that file explicitly instead.
import { config } from "dotenv";
config({ path: ".env.local" });
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
