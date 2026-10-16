import { rm } from "node:fs/promises";
import { join } from "node:path";

import { prepareTestDbTemplate } from "@tests/support/runtime/db";
import { acquirePostgresServer } from "@tests/support/runtime/postgres-server";
import { TEST_WEB_DB_URL_CONTEXT } from "@tests/support/runtime/test-context";
import type { TestProject } from "vitest/node";

const ARTIFACT_DIR = join(
  process.cwd(),
  ".vitest-db",
  process.env.TEST_DB_NAMESPACE ?? "default",
  "artifacts",
);

async function removeArtifacts(): Promise<void> {
  try {
    await rm(ARTIFACT_DIR, { recursive: true, force: true });
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !("code" in error) ||
      error.code !== "EBUSY"
    ) {
      throw error;
    }
  }
}

export async function setup(project: TestProject) {
  await removeArtifacts();

  const postgresServer = await acquirePostgresServer();
  project.provide(TEST_WEB_DB_URL_CONTEXT, postgresServer.connectionString);

  try {
    await prepareTestDbTemplate(postgresServer.connectionString);
  } catch (error) {
    await postgresServer.release();
    throw error;
  }

  return async () => {
    await removeArtifacts();
    await postgresServer.release();
  };
}
