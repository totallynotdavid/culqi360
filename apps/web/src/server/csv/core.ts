export type CsvDelimiter = "," | ";";

export interface CsvRow {
  rowNumber: number;
  cells: string[];
}

export function normalizeCsvHeader(header: string): string {
  return header
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_");
}

function flushField(cells: string[], fieldBuffer: string[]): void {
  cells.push(fieldBuffer.join(""));
  fieldBuffer.length = 0;
}

function isRowEmpty(cells: readonly string[]): boolean {
  return cells.every((cell) => cell.trim().length === 0);
}

function scanCsvRows(
  content: string,
  delimiter: CsvDelimiter,
  onRow: (row: CsvRow) => boolean | void,
): void {
  let inQuotes = false;
  const fieldBuffer: string[] = [];
  let currentLine = 1;
  let rowStartLine = 1;
  let cells: string[] = [];

  const emitRow = (): boolean => {
    const row: CsvRow = { rowNumber: rowStartLine, cells: [...cells] };
    const shouldContinue = onRow(row);
    cells = [];
    return shouldContinue !== false;
  };

  for (let i = 0; i < content.length; i++) {
    const ch = content.charAt(i);

    if (ch === '"') {
      if (inQuotes && content[i + 1] === '"') {
        fieldBuffer.push('"');
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      flushField(cells, fieldBuffer);
      continue;
    }

    if (ch === "\r" || ch === "\n") {
      const isCrlf = ch === "\r" && content[i + 1] === "\n";
      if (inQuotes) {
        fieldBuffer.push("\n");
        if (isCrlf) {
          i++;
        }
        currentLine++;
        continue;
      }

      flushField(cells, fieldBuffer);
      if (!emitRow()) {
        return;
      }

      if (isCrlf) {
        i++;
      }
      currentLine++;
      rowStartLine = currentLine;
      continue;
    }

    fieldBuffer.push(ch);
  }

  if (fieldBuffer.length > 0 || cells.length > 0) {
    flushField(cells, fieldBuffer);
    emitRow();
  }
}

export function readFirstNonEmptyCsvRow(
  content: string,
  delimiter: CsvDelimiter,
): CsvRow | null {
  let firstRow: CsvRow | null = null;

  scanCsvRows(content, delimiter, (row) => {
    if (isRowEmpty(row.cells)) {
      return true;
    }

    firstRow = row;
    return false;
  });

  return firstRow;
}

export function parseCsvRows(
  content: string,
  delimiter: CsvDelimiter,
): CsvRow[] {
  const rows: CsvRow[] = [];
  scanCsvRows(content, delimiter, (row) => {
    rows.push(row);
  });
  return rows;
}
