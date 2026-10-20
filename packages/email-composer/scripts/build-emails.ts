/**
 * Build-time script: compiles .mjml templates → TypeScript modules exporting
 * typed render functions. No runtime MJML dependency needed in production.
 *
 * Run via:  bun scripts/build-emails.ts
 *
 * Conventions in .mjml source:
 *   {{param}}                    required string parameter
 *   <!-- crm:if:param --> ... <!-- crm:endif -->
 *                                optional HTML block (typed as param?: string)
 *   <!-- crm:multiline:param --> marks param for \n → <br/> conversion in HTML
 *
 * Each .mjml must have a companion .txt file for the plain-text fallback.
 */

import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import mjml2html from "mjml";

import { genHtmlExpr, genModule, genTextExpr } from "../src/build/codegen";
import {
  collectParams,
  parseHtmlChunks,
  parseTextChunks,
} from "../src/build/parse-chunks";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const templatesDir = join(scriptDir, "../src/templates");
const outDir = join(templatesDir, "compiled");

mkdirSync(outDir, { recursive: true });

function extractMultilineParams(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(
    /<!--\s*crm:multiline:([a-zA-Z][a-zA-Z0-9_]*)\s*-->/g,
  )) {
    out.add(m[1]!);
  }
  return out;
}

function prepareMjml(source: string): string {
  return source
    .replace(
      /<!--\s*crm:if:([a-zA-Z][a-zA-Z0-9_]*)\s*-->/g,
      "<!-- __CRM_IF_$1__ -->",
    )
    .replace(/<!--\s*crm:endif\s*-->/g, "<!-- __CRM_ENDIF__ -->")
    .replace(/<!--\s*crm:multiline:[a-zA-Z][a-zA-Z0-9_]*\s*-->/g, "");
}

const mjmlFiles = readdirSync(templatesDir).filter((f: string) =>
  f.endsWith(".mjml"),
);

if (mjmlFiles.length === 0) {
  console.error("No .mjml files found in", templatesDir);
  process.exit(1);
}

async function compileTemplate(file: string) {
  const name = basename(file, ".mjml");
  const mjmlSource = readFileSync(join(templatesDir, file), "utf-8");
  const txtSource = readFileSync(join(templatesDir, `${name}.txt`), "utf-8");

  const multilineParams = extractMultilineParams(mjmlSource);
  let html: string;
  try {
    const result = await mjml2html(prepareMjml(mjmlSource), {
      validationLevel: "strict",
    });
    html = result.html;
  } catch (err: any) {
    console.error(`[${file}]`, err.message || err);
    process.exit(1);
  }

  const htmlChunks = parseHtmlChunks(html);
  const textChunks = parseTextChunks(txtSource);
  const { all: allParams, optional } = collectParams(htmlChunks);

  const htmlExpr = genHtmlExpr(htmlChunks, multilineParams);
  const textExpr = genTextExpr(textChunks);
  const output = genModule(name, file, htmlExpr, textExpr, allParams, optional);

  writeFileSync(join(outDir, `${name}.ts`), output, "utf-8");
}

await Promise.all(mjmlFiles.map(compileTemplate));

console.log(`email templates OK: ${mjmlFiles.length} compiled`);
