import {
  ARRAY_OBJECTS,
  fieldProp,
  groupByObject,
  infoTypeName,
  NULLABLE_OBJECTS,
  type ObjectGroup,
} from "./group.ts";
import type { ProjectionField, ProjectionSpec } from "./parse.ts";

export function renderResultContractTs(
  docSpec: ProjectionSpec,
  companySpec: ProjectionSpec,
): string {
  const docGroups = groupByObject(docSpec.fields);
  const companyGroups = groupByObject(companySpec.fields);
  // Doc and company projections share object types. Track what we have emitted
  // so the second projection does not redefine them.
  const defined = new Set<string>();

  const lines = [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Source: contracts/engine/doc-projection.json + contracts/engine/company-projection.json",
    "// Generator: tools/codegen/bin/generate.ts",
    "",
    'import { isPlainRecord } from "~/shared/type-guards";',
    "",
    ...emitInfoInterfaces(docGroups, defined),
    ...emitRow("DocumentRow", docGroups),
    ...emitInfoInterfaces(companyGroups, defined),
    ...emitRow("CompanyRow", companyGroups),
  ];

  lines.push("export type SearchResult =");
  lines.push('  | ({ kind: "document" } & DocumentRow)');
  lines.push('  | ({ kind: "company" } & CompanyRow);');
  lines.push("");

  lines.push("export interface SearchResponse {");
  lines.push("  results: SearchResult[];");
  lines.push("  count: number;");
  lines.push("}");
  lines.push("");

  // Guards are generated from the same fields as the interfaces above, so a
  // contract change cannot leave them behind.
  const guarded = new Set<string>();
  lines.push(
    ...GUARD_HELPERS,
    ...emitInfoGuards(docGroups, guarded),
    ...emitRowGuard("DocumentRow", docGroups),
    ...emitInfoGuards(companyGroups, guarded),
    ...emitRowGuard("CompanyRow", companyGroups),
    ...SEARCH_RESULT_GUARD,
  );

  return lines.join("\n");
}

const GUARD_HELPERS = [
  "function isString(value: unknown): value is string {",
  '  return typeof value === "string";',
  "}",
  "",
  "function isInteger(value: unknown): value is number {",
  "  return Number.isInteger(value);",
  "}",
  "",
  "function isStringArray(value: unknown): value is string[] {",
  "  return Array.isArray(value) && value.every(isString);",
  "}",
  "",
  "function isArrayOf(value: unknown, guard: (item: unknown) => boolean): boolean {",
  "  return Array.isArray(value) && value.every(guard);",
  "}",
  "",
  "function isNullable(",
  "  value: unknown,",
  "  guard: (value: unknown) => boolean,",
  "): boolean {",
  "  return value === null || guard(value);",
  "}",
  "",
];

const SEARCH_RESULT_GUARD = [
  "export function isSearchResult(value: unknown): value is SearchResult {",
  "  if (!isPlainRecord(value)) {",
  "    return false;",
  "  }",
  '  if (value.kind === "document") {',
  "    return isDocumentRow(value);",
  "  }",
  '  if (value.kind === "company") {',
  "    return isCompanyRow(value);",
  "  }",
  "  return false;",
  "}",
  "",
];

function emitInfoGuards(groups: ObjectGroup[], guarded: Set<string>): string[] {
  const lines: string[] = [];
  for (const { objectName, fields } of groups) {
    const typeName = infoTypeName(objectName);
    if (guarded.has(typeName)) continue;
    guarded.add(typeName);
    lines.push(
      `function is${typeName}(value: unknown): value is ${typeName} {`,
      "  return (",
      "    isPlainRecord(value) &&",
      ...joinConditions(fields.map(fieldCheck)),
      "  );",
      "}",
      "",
    );
  }
  return lines;
}

function emitRowGuard(name: string, groups: ObjectGroup[]): string[] {
  const checks = groups.map(({ objectName }) => {
    const guard = `is${infoTypeName(objectName)}`;
    if (ARRAY_OBJECTS.has(objectName)) {
      return `isArrayOf(value.${objectName}, ${guard})`;
    }
    return NULLABLE_OBJECTS.has(objectName)
      ? `isNullable(value.${objectName}, ${guard})`
      : `${guard}(value.${objectName})`;
  });
  return [
    `function is${name}(value: unknown): value is ${name} {`,
    "  return (",
    "    isPlainRecord(value) &&",
    ...joinConditions(checks),
    "  );",
    "}",
    "",
  ];
}

function joinConditions(conditions: string[]): string[] {
  return conditions.map(
    (condition, i) =>
      `    ${condition}${i < conditions.length - 1 ? " &&" : ""}`,
  );
}

function fieldCheck(field: ProjectionField): string {
  const access = `value.${fieldProp(field)}`;
  const guard = tsGuardName(field);
  return field.nullable
    ? `isNullable(${access}, ${guard})`
    : `${guard}(${access})`;
}

function tsGuardName(field: ProjectionField): string {
  if (field.value_type === "string_array") return "isStringArray";
  if (field.value_type === "integer") return "isInteger";
  return "isString";
}

function emitInfoInterfaces(
  groups: ObjectGroup[],
  defined: Set<string>,
): string[] {
  const lines: string[] = [];
  for (const { objectName, fields } of groups) {
    const typeName = infoTypeName(objectName);
    if (defined.has(typeName)) continue;
    defined.add(typeName);
    lines.push(`export interface ${typeName} {`);
    for (const field of fields) {
      lines.push(`  ${fieldProp(field)}: ${tsFieldType(field)};`);
    }
    lines.push("}", "");
  }
  return lines;
}

function emitRow(name: string, groups: ObjectGroup[]): string[] {
  const lines = [`export interface ${name} {`];
  for (const { objectName } of groups) {
    const container = infoTypeName(objectName);
    lines.push(`  ${objectName}: ${tsContainerType(objectName, container)};`);
  }
  lines.push("}", "");
  return lines;
}

function tsContainerType(objectName: string, container: string): string {
  if (ARRAY_OBJECTS.has(objectName)) return `${container}[]`;
  if (NULLABLE_OBJECTS.has(objectName)) return `${container} | null`;
  return container;
}

function tsFieldType(field: ProjectionField): string {
  if (field.value_type === "string_array") {
    return field.nullable ? "string[] | null" : "string[]";
  }
  if (field.value_type === "integer") {
    return field.nullable ? "number | null" : "number";
  }
  return field.nullable ? "string | null" : "string";
}
