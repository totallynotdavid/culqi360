import { MAX_RECORD_IMPORT_ROWS, type ParsedFile } from "./contracts";
import { fromCsv } from "./csv";
import { mapRecordImportRow } from "./row-mapper";
import { fromXlsx } from "./xlsx";

export function parseImportFile(
  buffer: ArrayBuffer,
  extension: "csv" | "xlsx",
): ParsedFile {
  const { importType, headers, rows } =
    extension === "xlsx" ? fromXlsx(buffer) : fromCsv(buffer);

  if (rows.length > MAX_RECORD_IMPORT_ROWS) {
    throw new Error(
      `Import exceeds maximum supported rows (${MAX_RECORD_IMPORT_ROWS})`,
    );
  }

  const validRows = [];
  const invalidRows = [];

  for (const [i, cells] of rows.entries()) {
    const rowNumber = i + 1;
    const result = mapRecordImportRow({
      rowNumber,
      importType,
      headers,
      cells,
    });

    if (result.ok) {
      validRows.push(result.row);
    } else {
      invalidRows.push(result.row);
    }
  }

  return { importType, validRows, invalidRows };
}
