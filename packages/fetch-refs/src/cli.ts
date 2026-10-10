import {
  getSourceConfig,
  getAllSourceConfigs,
  getSourceNames,
} from "./config/index.ts";
import { injectIndex } from "./core/agents-injector.ts";
import { fetchSource } from "./core/fetch.ts";
import { buildIndex } from "./core/index-builder.ts";
import type { IndexConfig, SourceConfig } from "./core/types.ts";
import { ensureRefsGitignored } from "./utils/gitignore.ts";
import { isErr } from "./utils/result.ts";
import { getWorkspaceRoot } from "./utils/workspace.ts";

async function main(): Promise<void> {
  process.chdir(getWorkspaceRoot());

  const [sourceList] = process.argv.slice(2);
  const sources =
    sourceList === undefined ? getAllSourceConfigs() : parseSources(sourceList);

  if (sources.length === 0) {
    console.error("No valid sources specified");
    console.error(`Available sources: ${getSourceNames().join(", ")}`);
    process.exit(1);
  }

  await ensureRefsGitignored();

  for (const config of sources) {
    // oxlint-disable-next-line no-await-in-loop -- sequential for deterministic logs
    await processSource(config);
  }
}

function parseSources(arg: string): SourceConfig[] {
  if (arg === "--all") return getAllSourceConfigs();

  const names = arg.split(",").map((n) => n.trim().toLowerCase());
  const configs: SourceConfig[] = [];

  for (const name of names) {
    const config = getSourceConfig(name);
    if (!config) {
      console.warn(`Warning: unknown source '${name}', skipping`);
      continue;
    }
    configs.push(config);
  }

  return configs;
}

async function processSource(config: SourceConfig): Promise<void> {
  console.log(`\n  Fetching ${config.name}...`);
  console.log(`  Repo: ${config.repo}`);
  config.mounts.forEach((m) =>
    console.log(`    ${m.repoPath} → ${m.localPath}`),
  );

  const fetchResult = fetchSource(config);
  if (isErr(fetchResult)) {
    console.error(`  Fetch failed: ${fetchResult.error}`);
    process.exit(1);
  }

  if (config.index) {
    const firstMount = config.mounts[0];
    if (!firstMount) {
      console.error(`  ${config.name}: 'index' requires at least one mount`);
      process.exit(1);
    }
    await processIndex(config.name, firstMount.localPath, config.index);
  }

  console.log(`  ${config.name} updated`);
}

async function processIndex(
  name: string,
  localPath: string,
  index: IndexConfig,
): Promise<void> {
  console.log(`  Building index from ${localPath}...`);
  const indexContent = await buildIndex(localPath, name, index);

  console.log(`  Injecting index into AGENTS.md...`);
  const injectResult = await injectIndex(
    index.markerStart,
    index.markerEnd,
    indexContent,
  );
  if (isErr(injectResult)) {
    console.error(`  Injection failed: ${injectResult.error}`);
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
