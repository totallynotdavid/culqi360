import type { ProjectionField } from "./parse.ts";

// Objects whose container is nullable in the SearchRow/SearchResult types.
export const NULLABLE_OBJECTS = new Set(["org", "role", "rep"]);

// Preferred display order; any object not in this list is appended alphabetically.
const PREFERRED_ORDER = ["doc", "company", "org", "rep", "role", "phones"];

export type ObjectGroup = {
  objectName: string;
  fields: ProjectionField[];
};

/**
 * Groups fields by the object prefix of their `path` (e.g. "person.dni" → "person").
 * Throws if any path does not follow the `object.property` format.
 */
export function groupByObject(fields: ProjectionField[]): ObjectGroup[] {
  const map = new Map<string, ProjectionField[]>();

  for (const field of fields) {
    const dot = field.path.indexOf(".");
    if (dot <= 0 || dot === field.path.length - 1) {
      throw new Error(
        `projection field path must follow object.property format: ${field.path}`,
      );
    }
    const objectName = field.path.slice(0, dot);
    const list = map.get(objectName);
    if (list) {
      list.push(field);
    } else {
      map.set(objectName, [field]);
    }
  }

  return orderedKeys(map).map((name) => ({
    objectName: name,
    fields: map.get(name) ?? [],
  }));
}

/** Returns the property name for a field (the part after the first dot). */
export function fieldProp(field: ProjectionField): string {
  return field.path.slice(field.path.indexOf(".") + 1);
}

/** Derives the Info struct/interface name for an object group. */
export function infoTypeName(objectName: string): string {
  // "phones" is the only group whose type name is singular; everything else
  // is just PascalCase + "Info" (e.g. "org" -> "OrgInfo").
  if (objectName === "phones") return "PhoneInfo";
  return `${pascalCase(objectName)}Info`;
}

function orderedKeys(map: Map<string, unknown>): string[] {
  const discovered = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
  const out: string[] = [];
  for (const key of PREFERRED_ORDER) {
    if (map.has(key)) out.push(key);
  }
  for (const key of discovered) {
    if (!out.includes(key)) out.push(key);
  }
  return out;
}

function pascalCase(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]/)
    .filter((s) => s.length > 0)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join("");
}
