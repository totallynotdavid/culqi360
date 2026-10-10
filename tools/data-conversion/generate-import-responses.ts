#!/usr/bin/env bun
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";

type ExportRow = { ruc: string };

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (ch === "," && !inQuotes) {
      values.push(current);
      current = "";
      continue;
    }

    current += ch;
  }

  values.push(current);
  return values;
}

function toDdMmYyyy(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = String(date.getFullYear());
  return `${dd}/${mm}/${yyyy}`;
}

function pick<T>(list: readonly T[]): T {
  const item = list[Math.floor(Math.random() * list.length)];
  if (item === undefined) throw new Error("Cannot pick from an empty list");
  return item;
}

function loadExportRows(inputPath: string): ExportRow[] {
  const raw = readFileSync(inputPath, "utf8");
  const lines = raw.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length < 2) {
    throw new Error("Export CSV must have header + at least 1 row");
  }

  const [headerLine = "", ...dataLines] = lines;
  const headers = parseCsvLine(headerLine).map((h) => h.trim().toLowerCase());
  const rucIndex = headers.indexOf("ruc");

  if (rucIndex === -1) {
    throw new Error("Export CSV is missing the ruc column");
  }

  const seen = new Set<string>();
  const rows: ExportRow[] = [];

  for (const line of dataLines) {
    const cols = parseCsvLine(line);
    const ruc = (cols[rucIndex] ?? "").trim();
    if (!/^\d{11}$/.test(ruc)) continue;
    if (seen.has(ruc)) continue;
    seen.add(ruc);
    rows.push({ ruc });
  }

  if (rows.length === 0) {
    throw new Error("No valid 11-digit RUC values were found");
  }

  return rows;
}

function buildStatusCsv(
  rows: ExportRow[],
  requestId: string,
  dateText: string,
): string {
  const statusValues = [
    "DISPONIBLE",
    "SIN RESULTADO",
    "CARTERIZADO",
    "STOCK",
  ] as const;

  const header =
    "Nro de solicitud;Fecha de solicitud;Canal;Nombre de Agencia Dealer;Documento;Resultado";
  const data = rows.map((row) => {
    const status = pick(statusValues);
    return `${requestId};${dateText};Dealers;ONE CHANNEL DEV;${row.ruc};${status}`;
  });

  return [header, ...data, ""].join("\n");
}

function buildPrioridadCsv(
  rows: ExportRow[],
  requestId: string,
  dateText: string,
): string {
  const segmentoValues = ["PYME", "EMPRESA", "SIN RESULTADO"] as const;
  const prioridadValues = ["P1", "P2", "SIN RESULTADO"] as const;
  const categoriaValues = [
    "High Value",
    "Medium Value",
    "Key Account",
    "Sin Resultado",
  ] as const;

  const header =
    "Nro de solicitud;Fecha;Usuario;Dealer;Documento;Segmento;Prioridad;Categoría";
  const data = rows.map((row) => {
    const prioridad = pick(prioridadValues);
    const segmento =
      prioridad === "SIN RESULTADO" ? "SIN RESULTADO" : pick(segmentoValues);
    const categoria =
      prioridad === "SIN RESULTADO" ? "Sin Resultado" : pick(categoriaValues);
    return `${requestId};${dateText};CAMILA ROJAS;ONE CHANNEL DEV;${row.ruc};${segmento};${prioridad};${categoria}`;
  });

  return [header, ...data, ""].join("\n");
}

function main() {
  const inputArg = process.argv[2];
  const outDirArg = process.argv[3] ?? ".";

  if (!inputArg) {
    console.error(
      "Usage: bun tools/data-conversion/generate-import-responses.ts <export.csv> [out-dir]",
    );
    process.exit(1);
  }

  const inputPath = resolve(inputArg);
  const outDir = resolve(outDirArg);
  mkdirSync(outDir, { recursive: true });

  const rows = loadExportRows(inputPath);
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const dateText = toDdMmYyyy(now);
  const requestId = `DEV_${ymd}_${String(Math.floor(Math.random() * 9000) + 1000)}`;

  const inputBase = basename(inputPath, ".csv");
  const statusPath = join(outDir, `${inputBase}-import-status.csv`);
  const prioridadPath = join(outDir, `${inputBase}-import-prioridad.csv`);

  writeFileSync(statusPath, buildStatusCsv(rows, requestId, dateText), "utf8");
  writeFileSync(
    prioridadPath,
    buildPrioridadCsv(rows, requestId, dateText),
    "utf8",
  );

  console.log(`Generated ${rows.length} rows`);
  console.log(`- ${statusPath}`);
  console.log(`- ${prioridadPath}`);
}

main();
