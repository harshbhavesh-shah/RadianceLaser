import { defineConfig } from "vitest/config";
import path from "path";

const dirname = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(dirname, "."),
      // See test/emptyServerOnly.ts for why this needs stubbing out.
      "server-only": path.resolve(dirname, "test/emptyServerOnly.ts"),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setupEnv.ts"],
    // Integration tests here hit the real dev database (allocateReceiptNumber's
    // atomic-upsert guarantee is the entire thing worth testing — a mock
    // would just test the mock) — sequential, not parallel workers, so two
    // test files can't race on the same ReceiptCounter row.
    fileParallelism: false,
  },
});
