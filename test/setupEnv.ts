// Vitest doesn't load .env.local the way Next.js does — the integration
// test in lib/db/receiptNumber.test.ts needs the real DATABASE_URL to
// exercise the actual Postgres upsert, so load it the same way every
// one-off script in this repo already does.
import { config } from "dotenv";
config({ path: ".env.local" });
