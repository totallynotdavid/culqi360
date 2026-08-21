import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Hashes a set of source roots into a staleness marker.
 *
 * Size and mtime stand in for content: a full read of `src` costs far more than
 * these tools save, and a false rebuild is cheap while a missed one is not. The
 * lockfile is always folded in, because a dependency change invalidates a build
 * and a seeded database without touching a single tracked file.
 */
export function sourceFingerprint(roots: readonly string[]): string {
  const hash = createHash("sha256");

  const walk = (path: string): void => {
    const stat = statSync(path, { throwIfNoEntry: false });

    if (!stat) {
      return;
    }

    if (stat.isDirectory()) {
      for (const entry of readdirSync(path)) {
        walk(join(path, entry));
      }

      return;
    }

    hash.update(path);
    hash.update(String(stat.size));
    hash.update(String(Math.trunc(stat.mtimeMs)));
  };

  for (const root of roots) {
    walk(resolve(process.cwd(), root));
  }

  const lockfileStat = statSync(resolve(process.cwd(), "../../bun.lock"), {
    throwIfNoEntry: false,
  });

  if (lockfileStat) {
    hash.update(String(lockfileStat.mtimeMs));
  }

  return hash.digest("hex");
}
