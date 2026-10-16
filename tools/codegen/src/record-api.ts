import { asObject, asString } from "./shared.ts";

export type FieldType = "string" | "i32" | "i64";

export type FieldSpec = {
  name: string;
  type: FieldType;
  optional: boolean;
};

export type StructSpec = {
  fields: FieldSpec[];
};

export type RecordApiSpec = {
  response: { candidate: StructSpec };
  request: { import_row: StructSpec };
};

const VALID_FIELD_TYPES = new Set(["string", "i32", "i64"]);

export function parseRecordApiSpec(raw: unknown): RecordApiSpec {
  const root = asObject(raw, "record-api spec");

  return {
    response: {
      candidate: parseStruct(
        asObject(
          asObject(root["response"], "response")["candidate"],
          "response.candidate",
        ),
      ),
    },
    request: {
      import_row: parseStruct(
        asObject(
          asObject(root["request"], "request")["import_row"],
          "request.import_row",
        ),
      ),
    },
  };
}

function parseStruct(raw: Record<string, unknown>): StructSpec {
  const fieldsRaw = raw["fields"];
  if (!Array.isArray(fieldsRaw)) {
    throw new Error("struct.fields must be an array");
  }

  const fields: FieldSpec[] = fieldsRaw.map((item, i) => {
    const field = asObject(item, `fields[${i}]`);
    const name = asString(field["name"], `fields[${i}].name`);
    const type = asString(field["type"], `fields[${i}].type`);

    if (!VALID_FIELD_TYPES.has(type)) {
      throw new Error(
        `fields[${i}].type must be "string" | "i32" | "i64", got: ${type}`,
      );
    }

    const optional = field["optional"];
    if (optional !== undefined && typeof optional !== "boolean") {
      throw new Error(`fields[${i}].optional must be boolean when present`);
    }

    return { name, type: type as FieldType, optional: optional === true };
  });

  return { fields };
}

// Rust rendering

export function renderRecordContractRust(spec: RecordApiSpec): string {
  const candidateFields = spec.response.candidate.fields;
  const importRowFields = spec.request.import_row.fields;

  return [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Source: contracts/engine/record-api.json",
    "// Generator: tools/codegen/bin/generate.ts",
    "use serde::{Deserialize, Serialize};",
    "",
    "#[derive(Debug, Serialize, Clone)]",
    "pub struct RecordCandidate {",
    ...candidateFields.map((f) => `    pub ${f.name}: ${rustType(f)},`),
    "}",
    "",
    "#[derive(Debug, Serialize)]",
    "pub struct RecordCandidatesResponse {",
    "    pub candidates: Vec<RecordCandidate>,",
    "    pub count: usize,",
    "}",
    "",
    "#[derive(Debug, Deserialize, Clone)]",
    "pub struct RecordImportRow {",
    ...importRowFields.map((f) => `    pub ${f.name}: ${rustType(f)},`),
    "}",
    "",
    "#[derive(Debug, Deserialize)]",
    "pub struct RecordImportRequest {",
    "    pub rows: Vec<RecordImportRow>,",
    "    pub source: String,",
    "}",
    "",
    "#[derive(Debug, Serialize)]",
    "pub struct RecordImportResponse {",
    "    pub inserted: usize,",
    "    pub updated: usize,",
    "    pub skipped: usize,",
    "    pub total: usize,",
    "}",
    "",
  ].join("\n");
}

function rustType(field: FieldSpec): string {
  const base =
    field.type === "string" ? "String" : field.type === "i32" ? "i32" : "i64";
  return field.optional ? `Option<${base}>` : base;
}

// TypeScript rendering

export function renderRecordContractTs(spec: RecordApiSpec): string {
  const candidateFields = spec.response.candidate.fields;
  const importRowFields = spec.request.import_row.fields;

  return [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Source: contracts/engine/record-api.json",
    "// Generator: tools/codegen/bin/generate.ts",
    "",
    renderInterface(
      "RecordCandidate",
      candidateFields.map((f) => `  ${f.name}: ${tsType(f)};`),
    ),
    "",
    renderInterface("RecordCandidatesResponse", [
      "  candidates: RecordCandidate[];",
      "  count: number;",
    ]),
    "",
    renderInterface(
      "RecordImportRow",
      importRowFields.map(
        (f) => `  ${f.optional ? `${f.name}?` : f.name}: ${tsBaseType(f)};`,
      ),
    ),
    "",
    renderInterface("RecordImportRequest", [
      "  rows: RecordImportRow[];",
      "  source: string;",
    ]),
    "",
    renderInterface("RecordImportResponse", [
      "  inserted: number;",
      "  updated: number;",
      "  skipped: number;",
      "  total: number;",
    ]),
    "",
  ].join("\n");
}

function renderInterface(name: string, lines: string[]): string {
  return [`export interface ${name} {`, ...lines, "}"].join("\n");
}

function tsType(field: FieldSpec): string {
  const base = tsBaseType(field);
  return field.optional ? `${base} | undefined` : base;
}

function tsBaseType(field: FieldSpec): string {
  return field.type === "string" ? "string" : "number";
}
