import codspeedPlugin from "@codspeed/vitest-plugin";
import {
  defineConfig,
  type TestProjectInlineConfiguration,
} from "vitest/config";

import { testAliases } from "./paths.ts";

function databaseProject(namespace: string) {
  return {
    globalSetup: ["./tests/setup/global-setup.ts"],
    environment: "node" as const,
    fileParallelism: true,
    env: {
      TEST_DB_NAMESPACE: namespace,
    },
  };
}

const projects: TestProjectInlineConfiguration[] = [
  {
    extends: true,
    test: {
      name: "unit",
      include: ["tests/unit/**/*.test.ts"],
      environment: "node",
      fileParallelism: true,
    },
  },
  {
    // Browser builds of Solid, so effects run and cleanups fire. The unit
    // project resolves the server build, where effects never run.
    extends: true,
    resolve: { conditions: ["browser"] },
    ssr: { resolve: { conditions: ["browser"] } },
    test: {
      name: "client",
      include: ["tests/client/**/*.test.ts"],
      environment: "node",
      server: { deps: { inline: [/solid-js/, /@solidjs/] } },
    },
  },
  {
    extends: true,
    test: {
      name: "contract",
      ...databaseProject("contract"),
      include: ["tests/contract/**/*.test.ts"],
    },
  },
  {
    extends: true,
    test: {
      name: "integration",
      ...databaseProject("integration"),
      include: ["tests/integration/**/*.test.ts"],
    },
  },
  {
    extends: true,
    test: {
      name: "journey",
      ...databaseProject("journey"),
      include: ["tests/journey/**/*.test.ts"],
      fileParallelism: false,
    },
  },
];

export default defineConfig({
  plugins: [codspeedPlugin()],
  test: {
    globalSetup: ["../../packages/email-composer/tests/global-setup.ts"],
    reporters: process.env.GITHUB_ACTIONS
      ? ["dot", "github-actions"]
      : ["default", "github-actions"],
    server: {
      deps: {
        inline: ["@solidjs/start"],
      },
    },
    projects,
  },
  resolve: { alias: { ...testAliases } },
});
