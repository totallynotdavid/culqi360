import {
  ARRAY_OBJECTS,
  fieldProp,
  groupByObject,
  infoTypeName,
  NULLABLE_OBJECTS,
  type ObjectGroup,
} from "./group.ts";
import type { ProjectionField, ProjectionSpec } from "./parse.ts";

export function renderProjectionContractRust(
  spec: ProjectionSpec,
  prefix: string,
  sourceFile: string,
): string {
  const allPaths = spec.fields.map((f) => f.path);
  const nullablePaths = spec.fields
    .filter((f) => f.nullable)
    .map((f) => f.path);
  const mappings = spec.fields.flatMap((f) =>
    f.storage.map((s) => ({ path: f.path, table: s.table, column: s.column })),
  );

  return [
    "// GENERATED FILE. DO NOT EDIT.",
    `// Source: ${sourceFile}`,
    "// Generator: tools/codegen/bin/generate.ts",
    "",
    "pub struct ProjectionStorageMapping {",
    "    pub path: &'static str,",
    "    pub table: &'static str,",
    "    pub column: &'static str,",
    "}",
    "",
    `pub const ${prefix}_NAME: &str = ${JSON.stringify(spec.projection)};`,
    "",
    `pub const ${prefix}_PATHS: &[&str] = &[`,
    ...allPaths.map((p) => `    ${JSON.stringify(p)},`),
    "];",
    "",
    `pub const ${prefix}_NULLABLE_PATHS: &[&str] = &[`,
    ...nullablePaths.map((p) => `    ${JSON.stringify(p)},`),
    "];",
    "",
    `pub const ${prefix}_STORAGE_MAPPINGS: &[ProjectionStorageMapping] = &[`,
    ...mappings.map((m) =>
      [
        "    ProjectionStorageMapping {",
        `        path: ${JSON.stringify(m.path)},`,
        `        table: ${JSON.stringify(m.table)},`,
        `        column: ${JSON.stringify(m.column)},`,
        "    },",
      ].join("\n"),
    ),
    "];",
    "",
  ].join("\n");
}

export function renderResultContractRust(
  docSpec: ProjectionSpec,
  companySpec: ProjectionSpec,
): string {
  const docGroups = groupByObject(docSpec.fields);
  const companyGroups = groupByObject(companySpec.fields);
  // doc and company projections share object types. Track what we have emitted
  // so the second projection does not redefine them.
  const defined = new Set<string>();

  const lines = [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Source: contracts/engine/doc-projection.json + contracts/engine/company-projection.json",
    "// Generator: tools/codegen/bin/generate.ts",
    "use serde::Serialize;",
    "",
    ...emitInfoStructs(docGroups, defined),
    ...emitRow("DocumentRow", docGroups),
    ...emitInfoStructs(companyGroups, defined),
    ...emitRow("CompanyRow", companyGroups),
  ];

  lines.push("#[derive(Debug, Serialize)]");
  lines.push('#[serde(tag = "kind", rename_all = "snake_case")]');
  lines.push("pub enum SearchResult {");
  lines.push("    Document(Box<DocumentRow>),");
  lines.push("    Company(Box<CompanyRow>),");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

function emitInfoStructs(
  groups: ObjectGroup[],
  defined: Set<string>,
): string[] {
  const lines: string[] = [];
  for (const { objectName, fields } of groups) {
    const typeName = infoTypeName(objectName);
    if (defined.has(typeName)) continue;
    defined.add(typeName);
    lines.push("#[derive(Debug, Serialize)]");
    lines.push(`pub struct ${typeName} {`);
    for (const field of fields) {
      lines.push(`    pub ${fieldProp(field)}: ${rustFieldType(field)},`);
    }
    lines.push("}", "");
  }
  return lines;
}

function emitRow(name: string, groups: ObjectGroup[]): string[] {
  const lines = ["#[derive(Debug, Serialize)]", `pub struct ${name} {`];
  for (const { objectName } of groups) {
    const container = infoTypeName(objectName);
    lines.push(
      `    pub ${objectName}: ${rustContainerType(objectName, container)},`,
    );
  }
  lines.push("}", "");
  return lines;
}

function rustContainerType(objectName: string, container: string): string {
  if (ARRAY_OBJECTS.has(objectName)) return `Vec<${container}>`;
  if (NULLABLE_OBJECTS.has(objectName)) return `Option<${container}>`;
  return container;
}

function rustFieldType(field: ProjectionField): string {
  if (field.value_type === "string_array") {
    return field.nullable ? "Option<Vec<String>>" : "Vec<String>";
  }
  if (field.value_type === "integer") {
    return field.nullable ? "Option<i64>" : "i64";
  }
  return field.nullable ? "Option<String>" : "String";
}
