import { resolve } from "node:path";

import codspeedPlugin from "@codspeed/vitest-plugin";
import { defineConfig } from "vitest/config";

import { testAliases } from "./paths.ts";

export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    globalSetup: [
      "../../packages/email-composer/tests/global-setup.ts",
      "./tests/setup/global-setup.ts",
    ],
    benchmark: {
      include: ["tests/**/*.bench.ts"],
    },
    runner: "./tests/bench/runner.ts",
    environment: "node",
    fileParallelism: false,
    server: {
      deps: {
        inline: ["@solidjs/start"],
      },
    },
  },
  resolve: {
    alias: {
      ...testAliases,

      // Benchmarks use deterministic UUIDs so generated ids are stable across runs.
      bun: resolve(import.meta.dirname, "./tests/mocks/bun.ts"),
    },
  },
});
