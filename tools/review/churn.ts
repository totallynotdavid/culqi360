#!/usr/bin/env bun
/**
 * Ranks the files a branch touched by how much of them changed, so a review can
 * start where the migration actually landed rather than at the top of an
 * alphabetical diff.
 *
 * Churn alone over-reports mechanical sweeps (a rename hitting 200 files) and
 * under-reports a 30-line rewrite that changed what a module means. The rewrite
 * ratio is what separates them: churn divided by the file's current size. A file
 * whose ratio is at or above 1 was effectively rewritten even when its line count
 * is small, and those are the ones worth reading in full.
 *
 * Usage: bun run tools/review/churn.ts [--base master] [--top 40] [--json]
 */

import { spawnSync } from "node:child_process";

interface FileChurn {
  path: string;
  added: number;
  deleted: number;
  churn: number;
  net: number;
  size: number;
  ratio: number;
  status: "added" | "deleted" | "modified";
}

function git(...args: string[]): string {
  const result = spawnSync("git", args, { encoding: "utf8" });

  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr.trim()}`);
  }

  return result.stdout;
}

function parseArgs(argv: string[]) {
  const base = argv.includes("--base")
    ? argv[argv.indexOf("--base") + 1]
    : "master";
  const top = argv.includes("--top")
    ? Number(argv[argv.indexOf("--top") + 1])
    : 40;

  if (!base) {
    throw new Error("--base needs a ref");
  }

  return { base, top, json: argv.includes("--json") };
}

/** Lines in the file as it stands now; 0 once the branch deleted it. */
function currentSize(path: string): number {
  const result = spawnSync("git", ["show", `HEAD:${path}`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });

  if (result.status !== 0) {
    return 0;
  }

  return result.stdout.split("\n").length - 1;
}

function collect(mergeBase: string): FileChurn[] {
  const numstat = git("diff", "--numstat", "-M", `${mergeBase}...HEAD`);

  return numstat
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [addedRaw, deletedRaw, ...pathParts] = line.split("\t");
      const path = pathParts.join("\t");

      // Binary files report "-" for both counts.
      const added = Number(addedRaw) || 0;
      const deleted = Number(deletedRaw) || 0;
      const size = currentSize(path);
      const churn = added + deleted;

      return {
        path,
        added,
        deleted,
        churn,
        net: added - deleted,
        size,
        // A deleted file has no "after" to compare against, so its ratio is
        // meaningless rather than infinite.
        ratio: size === 0 ? 0 : churn / size,
        status: size === 0 ? "deleted" : deleted === 0 ? "added" : "modified",
      } satisfies FileChurn;
    });
}

function rollup(files: FileChurn[], depth: number) {
  const byPrefix = new Map<string, { churn: number; files: number }>();

  for (const file of files) {
    const prefix = file.path.split("/").slice(0, depth).join("/");
    const entry = byPrefix.get(prefix) ?? { churn: 0, files: 0 };

    entry.churn += file.churn;
    entry.files += 1;
    byPrefix.set(prefix, entry);
  }

  return [...byPrefix.entries()].sort(([, a], [, b]) => b.churn - a.churn);
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width);
}

const { base, top, json } = parseArgs(process.argv.slice(2));
const mergeBase = git("merge-base", "HEAD", base).trim();
const files = collect(mergeBase);

if (json) {
  console.log(JSON.stringify({ base, mergeBase, files }, null, 2));
  process.exit(0);
}

const totalChurn = files.reduce((sum, file) => sum + file.churn, 0);

console.log(`base ${base} @ ${mergeBase.slice(0, 8)}`);
console.log(`${files.length} files, ${totalChurn} lines churned\n`);

console.log("== churn by area ==");
for (const [prefix, entry] of rollup(files, 4).slice(0, 15)) {
  console.log(`${pad(entry.churn, 7)}  ${pad(entry.files, 4)}f  ${prefix}`);
}

console.log("\n== most changed files ==");
console.log("  churn   +add   -del   size  rewrite  path");
for (const file of files.toSorted((a, b) => b.churn - a.churn).slice(0, top)) {
  const ratio = file.status === "deleted" ? "  gone" : file.ratio.toFixed(2);

  console.log(
    `${pad(file.churn, 7)} ${pad(file.added, 6)} ${pad(file.deleted, 6)} ${pad(file.size, 6)}  ${pad(ratio, 6)}  ${file.path}`,
  );
}

// Small files can be rewritten end to end without ever reaching the churn
// ranking above, and those are exactly the ones where meaning changed.
console.log("\n== effectively rewritten (ratio >= 1, still present) ==");
const rewritten = files
  .filter((file) => file.status !== "deleted" && file.ratio >= 1)
  .toSorted((a, b) => b.size - a.size);

for (const file of rewritten.slice(0, top)) {
  console.log(
    `${pad(file.size, 6)} lines  ${pad(file.ratio.toFixed(2), 6)}  ${file.path}`,
  );
}
console.log(`${rewritten.length} files rewritten end to end`);
