import Building2 from "~/components/icons/building-2";
import Info from "~/components/icons/info";
import Phone from "~/components/icons/phone";
import User from "~/components/icons/user";
import Users from "~/components/icons/users";
import type { AvatarType } from "~/components/ui/display/avatar";

import type { CompanyGroup, PersonGroup, PersonRef } from "./grouping";
import type { SearchViewModel } from "./search-view-model";

type FieldIcon = typeof Info;

export type SearchResultFieldKind = "text" | "chips" | "phones";

export interface SearchResultField {
  label: string;
  icon: FieldIcon;
  kind: SearchResultFieldKind;
  values: string[];
}

export type SearchResultSource =
  | { kind: "person"; person: PersonGroup }
  | { kind: "company"; company: CompanyGroup };

export interface SearchResultItem {
  id: string;
  label: string;
  objectLabel: string;
  avatarType: AvatarType;
  fields: SearchResultField[];
  source: SearchResultSource;
}

function personItem(person: PersonGroup): SearchResultItem {
  return {
    id: person.key,
    label: person.displayName,
    objectLabel: "Persona",
    avatarType: "rounded",
    fields: [
      {
        label: "Documento",
        icon: Info,
        kind: "text",
        values: [`${person.doc_type} ${person.doc_number}`],
      },
      {
        label: "Teléfonos",
        icon: Phone,
        kind: "phones",
        values: person.phones,
      },
      {
        label: "Empresas",
        icon: Building2,
        kind: "chips",
        values: person.companies
          .map((company) => company.name ?? company.ruc ?? "")
          .filter((name) => name.length > 0),
      },
      {
        label: "Alias",
        icon: Users,
        kind: "chips",
        // The display name is already shown as the card label.
        values: person.aliases.filter((alias) => alias !== person.displayName),
      },
    ],
    source: { kind: "person", person },
  };
}

function companyItem(company: CompanyGroup): SearchResultItem {
  return {
    id: company.key,
    label: company.name ?? company.ruc ?? "Empresa sin nombre",
    objectLabel: "Empresa",
    avatarType: "squared",
    fields: [
      {
        label: "RUC",
        icon: Info,
        kind: "text",
        values: company.ruc ? [company.ruc] : [],
      },
      {
        label: "Teléfonos",
        icon: Phone,
        kind: "phones",
        values: company.phones,
      },
      {
        label: "Razón social",
        icon: User,
        kind: "text",
        values: company.name ? [company.name] : [],
      },
      {
        label: "Personas",
        icon: Users,
        kind: "chips",
        values: company.people.map(personChip).filter(isNonEmpty),
      },
    ],
    source: { kind: "company", company },
  };
}

function personChip(person: PersonRef): string {
  const document = [person.doc_type, person.doc_number]
    .filter((part) => part !== null)
    .join(" ");

  if (!person.name) {
    return document;
  }

  return document ? `${person.name} (${document})` : person.name;
}

function isNonEmpty(value: string): boolean {
  return value.length > 0;
}

export function toSearchResultItems(
  model: SearchViewModel,
): SearchResultItem[] {
  return [...model.people.map(personItem), ...model.companies.map(companyItem)];
}
