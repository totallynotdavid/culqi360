import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// Shared state from globalSetup to Playwright workers.
const MANIFEST_PATH = resolve(process.cwd(), ".e2e-manifest.json");

export interface GuardCount {
  table: string;
  count: number;
}

export interface ResetPlan {
  truncateSql: string | null;
  deleteSql: string[];
  guardCounts: GuardCount[];
}

export interface E2EManifest {
  maintenanceUrl: string;
  templateDb: string;
  serverEntry: string;
  reset: ResetPlan;
}

export function writeManifest(manifest: E2EManifest): void {
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function readManifest(): E2EManifest {
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  } catch (error) {
    throw new Error(
      `could not read ${MANIFEST_PATH}; run e2e tests via 'bun run test:e2e' so ` +
        "globalSetup provisions the template and writes the manifest first",
      { cause: error },
    );
  }
}
