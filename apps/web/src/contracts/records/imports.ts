export type RecordImportType = "import_status" | "import_prioridad";

/** What the import is applying, which decides the wording of its progress. */
export interface RecordImportDetail {
  importType: RecordImportType;
}

export function parseRecordImportDetail(
  value: unknown,
): RecordImportDetail | null {
  if (typeof value !== "object" || value === null || !("importType" in value)) {
    return null;
  }

  const { importType } = value;

  return importType === "import_status" || importType === "import_prioridad"
    ? { importType }
    : null;
}
