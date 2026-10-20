import type { HtmlChunk, TextChunk } from "./parse-chunks";

function escLiteral(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$\{/g, "\\${");
}

export function genHtmlExpr(
  chunks: HtmlChunk[],
  multiline: Set<string>,
  guarded = false,
): string {
  if (chunks.length === 0) return '""';
  return chunks
    .map((c) => {
      if (c.type === "literal") return "`" + escLiteral(c.value) + "`";
      if (c.type === "param") {
        const ref = guarded ? `p.${c.name}!` : `p.${c.name}`;
        const base = `esc(${ref})`;
        return multiline.has(c.name)
          ? `${base}.replace(/\\n/g, "<br/>")`
          : base;
      }
      const inner = genHtmlExpr(c.inner, multiline, true);
      return `(p.${c.param}?.trim() ? ${inner} : "")`;
    })
    .join(" +\n    ");
}

export function genTextExpr(chunks: TextChunk[], guarded = false): string {
  if (chunks.length === 0) return '""';
  return chunks
    .map((c) => {
      if (c.type === "literal") return JSON.stringify(c.value);
      if (c.type === "param") {
        return guarded ? `p.${c.name}!` : `p.${c.name}`;
      }
      const inner = genTextExpr(c.inner, true);
      return `(p.${c.param}?.trim() ? ${inner} : "")`;
    })
    .join(" +\n    ");
}

function pascal(s: string): string {
  return s
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join("");
}

export function genInterface(
  ifaceName: string,
  params: string[],
  optional: Set<string>,
): string {
  const fields = params
    .map((name) => `  ${name}${optional.has(name) ? "?" : ""}: string;`)
    .join("\n");
  return `export interface ${ifaceName} {\n${fields}\n}`;
}

export function genModule(
  name: string,
  file: string,
  htmlExpr: string,
  textExpr: string,
  allParams: string[],
  optional: Set<string>,
): string {
  const funcName = `render${pascal(name)}Email`;
  const ifaceName = `${pascal(name)}EmailParams`;

  return [
    `// SOURCE: src/templates/${file} + ${name}.txt`,
    `// Regenerate: bun scripts/build-emails.ts (from packages/email-composer)`,
    ``,
    `import { esc } from "../../utils.js";`,
    ``,
    genInterface(ifaceName, allParams, optional),
    ``,
    `export function ${funcName}(p: ${ifaceName}): { html: string; text: string } {`,
    `  return {`,
    `    html:`,
    `      ${htmlExpr},`,
    `    text:`,
    `      ${textExpr},`,
    `  };`,
    `}`,
    ``,
  ].join("\n");
}
