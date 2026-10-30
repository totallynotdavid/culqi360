// GENERATED FILE. DO NOT EDIT.
// Source: contracts/engine/doc-projection.json + contracts/engine/company-projection.json
// Generator: tools/codegen/bin/generate.ts

import { isPlainRecord } from "~/shared/type-guards";

export interface DocInfo {
  doc_type: string;
  doc_number: string;
  name: string | null;
  ruc: string | null;
  birth_date: string | null;
  birth_place: string | null;
  sex: string | null;
  marital_status: string | null;
  location_text: string | null;
  ubigeo_code: string | null;
  mother_name: string | null;
  father_name: string | null;
  email: string | null;
}

export interface OrgInfo {
  ruc: string | null;
  name: string | null;
  trade_name: string | null;
  company_type: string | null;
  status: string | null;
  condition: string | null;
  fiscal_address: string | null;
  registration_date: string | null;
  activity_start_date: string | null;
  line_of_business: string | null;
  economic_activity: string | null;
  ubigeo_code: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
}

export interface RoleInfo {
  name: string | null;
  start_date: string | null;
  rep_doc_type: string | null;
  rep_doc_number: string | null;
  rep_name: string | null;
}

export interface PhoneInfo {
  primary: string | null;
  secondary: string | null;
  siblings: string[] | null;
}

export interface DocumentRow {
  doc: DocInfo;
  org: OrgInfo | null;
  role: RoleInfo | null;
  phones: PhoneInfo;
}

export interface CompanyInfo {
  id: number;
  ruc: string;
  legal_name: string | null;
  trade_name: string | null;
  company_type: string | null;
  status: string | null;
  condition: string | null;
  fiscal_address: string | null;
  registration_date: string | null;
  activity_start_date: string | null;
  line_of_business: string | null;
  economic_activity: string | null;
  ubigeo_code: string | null;
  department: string | null;
  province: string | null;
  district: string | null;
}

export interface PersonInfo {
  doc_type: string | null;
  doc_number: string | null;
  name: string | null;
  role_name: string | null;
  role_start_date: string | null;
}

export interface CompanyRow {
  company: CompanyInfo;
  people: PersonInfo[];
  phones: PhoneInfo;
}

export type SearchResult =
  | ({ kind: "document" } & DocumentRow)
  | ({ kind: "company" } & CompanyRow);

export interface SearchResponse {
  results: SearchResult[];
  count: number;
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isInteger(value: unknown): value is number {
  return Number.isInteger(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isString);
}

function isArrayOf(value: unknown, guard: (item: unknown) => boolean): boolean {
  return Array.isArray(value) && value.every(guard);
}

function isNullable(
  value: unknown,
  guard: (value: unknown) => boolean,
): boolean {
  return value === null || guard(value);
}

function isDocInfo(value: unknown): value is DocInfo {
  return (
    isPlainRecord(value) &&
    isString(value.doc_type) &&
    isString(value.doc_number) &&
    isNullable(value.name, isString) &&
    isNullable(value.ruc, isString) &&
    isNullable(value.birth_date, isString) &&
    isNullable(value.birth_place, isString) &&
    isNullable(value.sex, isString) &&
    isNullable(value.marital_status, isString) &&
    isNullable(value.location_text, isString) &&
    isNullable(value.ubigeo_code, isString) &&
    isNullable(value.mother_name, isString) &&
    isNullable(value.father_name, isString) &&
    isNullable(value.email, isString)
  );
}

function isOrgInfo(value: unknown): value is OrgInfo {
  return (
    isPlainRecord(value) &&
    isNullable(value.ruc, isString) &&
    isNullable(value.name, isString) &&
    isNullable(value.trade_name, isString) &&
    isNullable(value.company_type, isString) &&
    isNullable(value.status, isString) &&
    isNullable(value.condition, isString) &&
    isNullable(value.fiscal_address, isString) &&
    isNullable(value.registration_date, isString) &&
    isNullable(value.activity_start_date, isString) &&
    isNullable(value.line_of_business, isString) &&
    isNullable(value.economic_activity, isString) &&
    isNullable(value.ubigeo_code, isString) &&
    isNullable(value.department, isString) &&
    isNullable(value.province, isString) &&
    isNullable(value.district, isString)
  );
}

function isRoleInfo(value: unknown): value is RoleInfo {
  return (
    isPlainRecord(value) &&
    isNullable(value.name, isString) &&
    isNullable(value.start_date, isString) &&
    isNullable(value.rep_doc_type, isString) &&
    isNullable(value.rep_doc_number, isString) &&
    isNullable(value.rep_name, isString)
  );
}

function isPhoneInfo(value: unknown): value is PhoneInfo {
  return (
    isPlainRecord(value) &&
    isNullable(value.primary, isString) &&
    isNullable(value.secondary, isString) &&
    isNullable(value.siblings, isStringArray)
  );
}

function isDocumentRow(value: unknown): value is DocumentRow {
  return (
    isPlainRecord(value) &&
    isDocInfo(value.doc) &&
    isNullable(value.org, isOrgInfo) &&
    isNullable(value.role, isRoleInfo) &&
    isPhoneInfo(value.phones)
  );
}

function isCompanyInfo(value: unknown): value is CompanyInfo {
  return (
    isPlainRecord(value) &&
    isInteger(value.id) &&
    isString(value.ruc) &&
    isNullable(value.legal_name, isString) &&
    isNullable(value.trade_name, isString) &&
    isNullable(value.company_type, isString) &&
    isNullable(value.status, isString) &&
    isNullable(value.condition, isString) &&
    isNullable(value.fiscal_address, isString) &&
    isNullable(value.registration_date, isString) &&
    isNullable(value.activity_start_date, isString) &&
    isNullable(value.line_of_business, isString) &&
    isNullable(value.economic_activity, isString) &&
    isNullable(value.ubigeo_code, isString) &&
    isNullable(value.department, isString) &&
    isNullable(value.province, isString) &&
    isNullable(value.district, isString)
  );
}

function isPersonInfo(value: unknown): value is PersonInfo {
  return (
    isPlainRecord(value) &&
    isNullable(value.doc_type, isString) &&
    isNullable(value.doc_number, isString) &&
    isNullable(value.name, isString) &&
    isNullable(value.role_name, isString) &&
    isNullable(value.role_start_date, isString)
  );
}

function isCompanyRow(value: unknown): value is CompanyRow {
  return (
    isPlainRecord(value) &&
    isCompanyInfo(value.company) &&
    isArrayOf(value.people, isPersonInfo) &&
    isPhoneInfo(value.phones)
  );
}

export function isSearchResult(value: unknown): value is SearchResult {
  if (!isPlainRecord(value)) {
    return false;
  }
  if (value.kind === "document") {
    return isDocumentRow(value);
  }
  if (value.kind === "company") {
    return isCompanyRow(value);
  }
  return false;
}
