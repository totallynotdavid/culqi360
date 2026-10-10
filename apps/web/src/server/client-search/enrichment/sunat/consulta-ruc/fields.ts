import { decodeHtmlEntities, normalizeWhitespace } from "../text";

function readTexts(row: string, pattern: RegExp): string[] {
  return [...row.matchAll(pattern)].map((match) =>
    normalizeWhitespace(
      decodeHtmlEntities((match[1] ?? "").replace(/<[^>]+>/g, "")),
    ),
  );
}

export function readFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const rows = html.match(/<div class="row">[\s\S]*?<\/div>\s*<\/div>/gi) ?? [];

  for (const row of rows) {
    const headings = readTexts(
      row,
      /<h4 class="list-group-item-heading">([\s\S]*?)<\/h4>/gi,
    );
    const texts = readTexts(
      row,
      /<p class="list-group-item-text">([\s\S]*?)<\/p>/gi,
    );
    const tableCells = readTexts(
      row,
      /<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi,
    );

    const [label, secondHeading] = headings;
    if (label === undefined) {
      continue;
    }

    if (headings.length === 2 && texts.length === 0) {
      if (
        label &&
        secondHeading &&
        !label.includes("-") &&
        label.length < 100
      ) {
        fields[label] = secondHeading;
      }
      continue;
    }

    const [text] = texts;
    if (headings.length === 1 && texts.length === 1 && text !== undefined) {
      fields[label] = text;
      continue;
    }

    if (headings.length === 1 && tableCells.length > 0) {
      fields[label] = tableCells.join("\n");
    }
  }

  return fields;
}
