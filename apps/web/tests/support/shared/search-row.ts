import type {
  PersonInfo,
  SearchResult,
} from "~/contracts/search/engine-results.generated";

export function makeDocumentResult(partial: {
  doc_type?: string;
  doc_number?: string;
  name?: string;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  org_ruc?: string | null;
  org_name?: string | null;
  sibling_phones?: string[] | null;
  email?: string | null;
}): SearchResult {
  const {
    doc_type = "DNI",
    doc_number = "12345678",
    name = "RICARDO GARCIA PINCHI",
    phone_primary = null,
    phone_secondary = null,
    org_ruc = null,
    org_name = null,
    sibling_phones = null,
    email = null,
  } = partial;

  return {
    kind: "document",
    doc: {
      doc_type,
      doc_number,
      name,
      ruc: null,
      birth_date: null,
      birth_place: null,
      sex: null,
      marital_status: null,
      location_text: null,
      ubigeo_code: null,
      mother_name: null,
      father_name: null,
      email,
    },
    org:
      org_ruc != null
        ? {
            ruc: org_ruc,
            name: org_name,
            trade_name: null,
            company_type: null,
            status: null,
            condition: null,
            fiscal_address: null,
            registration_date: null,
            activity_start_date: null,
            line_of_business: null,
            economic_activity: null,
            ubigeo_code: null,
            department: null,
            province: null,
            district: null,
          }
        : null,
    role: null,
    phones: {
      primary: phone_primary,
      secondary: phone_secondary,
      siblings: sibling_phones,
    },
  };
}

export function makeCompanyResult(partial: {
  id?: number;
  ruc?: string;
  legal_name?: string | null;
  phone_primary?: string | null;
  phone_secondary?: string | null;
  sibling_phones?: string[] | null;
  people?: PersonInfo[];
}): SearchResult {
  const {
    id,
    ruc = "20100000001",
    legal_name = "ACME SAC",
    phone_primary = null,
    phone_secondary = null,
    sibling_phones = null,
    people = [],
  } = partial;
  const stableId = id ?? Number(ruc);

  return {
    kind: "company",
    company: {
      id: stableId,
      ruc,
      legal_name,
      trade_name: null,
      company_type: null,
      status: null,
      condition: null,
      fiscal_address: null,
      registration_date: null,
      activity_start_date: null,
      line_of_business: null,
      economic_activity: null,
      ubigeo_code: null,
      department: null,
      province: null,
      district: null,
    },
    people,
    phones: {
      primary: phone_primary,
      secondary: phone_secondary,
      siblings: sibling_phones,
    },
  };
}
