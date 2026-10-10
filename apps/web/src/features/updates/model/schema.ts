import type { Component } from "solid-js";

import { buildUpdateId } from "~/features/updates/model/id";
import type {
  UpdateCadence,
  UpdateEntry,
  UpdateFilter,
  UpdateFrontmatterInput,
  UpdateKind,
  UpdateVisibility,
} from "~/features/updates/model/types";

type ValidationIssue = {
  path: string;
  field: string;
  reason: string;
};

type UpdateModule = {
  default: Component;
  frontmatter?: unknown;
};

function getFrontmatterValue(
  frontmatter: unknown,
  key: keyof UpdateFrontmatterInput,
): unknown {
  if (typeof frontmatter !== "object" || frontmatter === null) {
    return undefined;
  }

  return Reflect.get(frontmatter, key);
}

function getSlug(path: string): string {
  const match = path.match(/\/([^/]+)\.mdx?$/);

  return match?.[1] ?? path;
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year = 0, month = 0, day = 0] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeKind(value: unknown): UpdateKind | null {
  return value === "release" || value === "technical" ? value : null;
}

function normalizeCadence(value: unknown): UpdateCadence | null {
  return value === "nightly" || value === "weekly" || value === "none"
    ? value
    : null;
}

function normalizeVisibility(value: unknown): UpdateVisibility | null {
  return value === "internal" ? value : null;
}

function normalizeTags(value: unknown): string[] | null {
  if (value == null) {
    return [];
  }

  if (!Array.isArray(value)) {
    return null;
  }

  const tags = value.filter(
    (entry): entry is string =>
      typeof entry === "string" && entry.trim() !== "",
  );

  if (tags.length !== value.length || tags.length > 8) {
    return null;
  }

  return tags;
}

function parseUpdateModule(path: string, module: UpdateModule) {
  const issues: ValidationIssue[] = [];

  const titleValue = getFrontmatterValue(module.frontmatter, "title");
  const title = typeof titleValue === "string" ? titleValue.trim() : "";

  if (!title) {
    issues.push({
      path,
      field: "title",
      reason: "required non-empty string",
    });
  }

  const rawDate = getFrontmatterValue(module.frontmatter, "date");
  const date = isIsoDate(rawDate) ? rawDate : null;

  if (!date) {
    issues.push({
      path,
      field: "date",
      reason: "must be YYYY-MM-DD",
    });
  }

  const kind = normalizeKind(getFrontmatterValue(module.frontmatter, "kind"));

  if (!kind) {
    issues.push({
      path,
      field: "kind",
      reason: 'must be "release" or "technical"',
    });
  }

  const cadence = normalizeCadence(
    getFrontmatterValue(module.frontmatter, "cadence"),
  );

  if (!cadence) {
    issues.push({
      path,
      field: "cadence",
      reason: 'must be "nightly", "weekly", or "none"',
    });
  }

  const visibility = normalizeVisibility(
    getFrontmatterValue(module.frontmatter, "visibility"),
  );

  if (!visibility) {
    issues.push({
      path,
      field: "visibility",
      reason: 'must be "internal"',
    });
  }

  const tags = normalizeTags(getFrontmatterValue(module.frontmatter, "tags"));

  if (!tags) {
    issues.push({
      path,
      field: "tags",
      reason: "must be array of 0-8 non-empty strings",
    });
  }

  if (kind && cadence) {
    if (kind === "release" && cadence === "none") {
      issues.push({
        path,
        field: "cadence",
        reason: 'must be "nightly" or "weekly" when kind is "release"',
      });
    }

    if (kind === "technical" && cadence !== "none") {
      issues.push({
        path,
        field: "cadence",
        reason: 'must be "none" when kind is "technical"',
      });
    }
  }

  if (issues.length > 0 || !date || !kind || !cadence || !visibility || !tags) {
    return { entry: null, issues };
  }

  const entry: UpdateEntry = {
    id: buildUpdateId(date, kind, cadence, title),
    slug: getSlug(path),
    title,
    date,
    kind,
    cadence,
    visibility,
    tags,
    content: module.default,
  };

  return { entry, issues };
}

function compareEntries(left: UpdateEntry, right: UpdateEntry): number {
  if (left.date !== right.date) {
    return left.date < right.date ? 1 : -1;
  }

  if (left.id === right.id) {
    return 0;
  }

  return left.id < right.id ? 1 : -1;
}

function validateNoDuplicateIds(entries: UpdateEntry[]): ValidationIssue[] {
  const seen = new Map<string, string>();
  const issues: ValidationIssue[] = [];

  for (const entry of entries) {
    const existing = seen.get(entry.id);

    if (existing) {
      issues.push({
        path: entry.slug,
        field: "id",
        reason: `duplicate derived id with ${existing}: ${entry.id}`,
      });
      continue;
    }

    seen.set(entry.id, entry.slug);
  }

  return issues;
}

function formatIssues(issues: ValidationIssue[]): string {
  return issues
    .map((issue) => `- ${issue.path} [${issue.field}]: ${issue.reason}`)
    .join("\n");
}

export function parseAndValidateUpdates(
  modules: Record<string, UpdateModule>,
): readonly UpdateEntry[] {
  const issues: ValidationIssue[] = [];

  const entries = Object.entries(modules)
    .map(([path, module]) => parseUpdateModule(path, module))
    .flatMap((result) => {
      issues.push(...result.issues);
      return result.entry ? [result.entry] : [];
    });

  issues.push(...validateNoDuplicateIds(entries));

  if (issues.length > 0) {
    throw new Error(
      `[updates] content validation failed:\n${formatIssues(issues)}`,
    );
  }

  return entries.toSorted(compareEntries);
}

export function parseUpdateFilter(value: string | undefined): UpdateFilter {
  switch (value) {
    case "technical":
    case "release-nightly":
    case "release-weekly":
      return value;
    default:
      return "all";
  }
}
