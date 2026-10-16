import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/integration",
  timeout: 90_000,
  fullyParallel: false,
  workers: 1,
  use: {
    trace: "retain-on-failure",
  },
});
