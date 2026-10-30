import type { SearchResult } from "~/contracts/search/engine-results.generated";

export interface CompanyRef {
  ruc: string | null;
  name: string | null;
}

export interface PersonRef {
  doc_type: string | null;
  doc_number: string | null;
  name: string | null;
}

export interface PersonGroup {
  key: string;
  doc_type: string;
  doc_number: string;
  displayName: string;
  aliases: string[];
  companies: CompanyRef[];
  phones: string[];
}

export interface CompanyGroup {
  id: number;
  key: string;
  ruc: string | null;
  name: string | null;
  phones: string[];
  people: PersonRef[];
}

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function pushUnique(
  values: string[],
  seen: Set<string>,
  value: string | null | undefined,
): void {
  const safe = normalized(value);

  if (!safe || seen.has(safe)) {
    return;
  }

  seen.add(safe);
  values.push(safe);
}

function companyKey(ruc: string | null, name: string | null): string {
  return `${normalized(ruc)}|${normalized(name)}`;
}

export function groupByDocument(
  results: readonly SearchResult[],
): PersonGroup[] {
  const groups = new Map<
    string,
    Extract<SearchResult, { kind: "document" }>[]
  >();

  for (const row of results) {
    if (row.kind !== "document") {
      continue;
    }

    const key = `${row.doc.doc_type}:${row.doc.doc_number}`;
    const existing = groups.get(key);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const out: PersonGroup[] = [];

  for (const [key, rows] of groups) {
    const first = rows[0];

    if (!first) {
      continue;
    }

    const aliases: string[] = [];
    const aliasSet = new Set<string>();
    const phones: string[] = [];
    const phoneSet = new Set<string>();
    const companies: CompanyRef[] = [];
    const companyKeys = new Set<string>();

    for (const row of rows) {
      pushUnique(aliases, aliasSet, row.doc.name);

      pushUnique(phones, phoneSet, row.phones.primary);
      pushUnique(phones, phoneSet, row.phones.secondary);

      for (const siblingPhone of row.phones.siblings ?? []) {
        pushUnique(phones, phoneSet, siblingPhone);
      }

      const orgKey = companyKey(row.org?.ruc ?? null, row.org?.name ?? null);

      if (orgKey !== "|" && !companyKeys.has(orgKey)) {
        companyKeys.add(orgKey);

        companies.push({
          ruc: normalized(row.org?.ruc) || null,
          name: normalized(row.org?.name) || null,
        });
      }
    }

    out.push({
      key,
      doc_type: first.doc.doc_type,
      doc_number: first.doc.doc_number,
      displayName: aliases[0] ?? first.doc.doc_number,
      aliases,
      companies,
      phones,
    });
  }

  return out;
}

export function groupByCompany(
  results: readonly SearchResult[],
): CompanyGroup[] {
  const groups = new Map<string, CompanyGroup>();

  for (const row of results) {
    if (row.kind !== "company") {
      continue;
    }

    const key = `company:${row.company.id}`;
    const group = groups.get(key) ?? {
      id: row.company.id,
      key,
      ruc: normalized(row.company.ruc) || null,
      name: null,
      phones: [],
      people: [],
    };

    groups.set(key, group);
    mergeCompanyRow(group, row);
  }

  return [...groups.values()];
}

function mergeCompanyRow(
  group: CompanyGroup,
  row: Extract<SearchResult, { kind: "company" }>,
): void {
  group.name ??= normalized(row.company.legal_name) || null;

  const phoneSet = new Set(group.phones);

  pushUnique(group.phones, phoneSet, row.phones.primary);
  pushUnique(group.phones, phoneSet, row.phones.secondary);

  for (const siblingPhone of row.phones.siblings ?? []) {
    pushUnique(group.phones, phoneSet, siblingPhone);
  }

  const personKeys = new Set(group.people.map(personRefKey));

  for (const person of row.people) {
    const ref: PersonRef = {
      doc_type: normalized(person.doc_type) || null,
      doc_number: normalized(person.doc_number) || null,
      name: normalized(person.name) || null,
    };
    const refKey = personRefKey(ref);

    if (refKey === "||" || personKeys.has(refKey)) {
      continue;
    }

    personKeys.add(refKey);
    group.people.push(ref);
  }
}

function personRefKey(person: PersonRef): string {
  return `${person.doc_type ?? ""}|${person.doc_number ?? ""}|${person.name ?? ""}`;
}
