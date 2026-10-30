// GENERATED FILE. DO NOT EDIT.
// Source: contracts/engine/company-projection.json
// Generator: tools/codegen/bin/generate.ts

pub struct ProjectionStorageMapping {
    pub path: &'static str,
    pub table: &'static str,
    pub column: &'static str,
}

pub const COMPANY_PROJECTION_NAME: &str = "company_projection";

pub const COMPANY_PROJECTION_PATHS: &[&str] = &[
    "company.id",
    "company.ruc",
    "company.legal_name",
    "company.trade_name",
    "company.company_type",
    "company.status",
    "company.condition",
    "company.fiscal_address",
    "company.registration_date",
    "company.activity_start_date",
    "company.line_of_business",
    "company.economic_activity",
    "company.ubigeo_code",
    "company.department",
    "company.province",
    "company.district",
    "people.doc_type",
    "people.doc_number",
    "people.name",
    "people.role_name",
    "people.role_start_date",
    "phones.primary",
    "phones.secondary",
    "phones.siblings",
];

pub const COMPANY_PROJECTION_NULLABLE_PATHS: &[&str] = &[
    "company.legal_name",
    "company.trade_name",
    "company.company_type",
    "company.status",
    "company.condition",
    "company.fiscal_address",
    "company.registration_date",
    "company.activity_start_date",
    "company.line_of_business",
    "company.economic_activity",
    "company.ubigeo_code",
    "company.department",
    "company.province",
    "company.district",
    "people.doc_type",
    "people.doc_number",
    "people.name",
    "people.role_name",
    "people.role_start_date",
    "phones.primary",
    "phones.secondary",
    "phones.siblings",
];

pub const COMPANY_PROJECTION_STORAGE_MAPPINGS: &[ProjectionStorageMapping] = &[
    ProjectionStorageMapping {
        path: "company.id",
        table: "company_projection",
        column: "company_id",
    },
    ProjectionStorageMapping {
        path: "company.ruc",
        table: "company_projection",
        column: "ruc",
    },
    ProjectionStorageMapping {
        path: "company.legal_name",
        table: "company_projection",
        column: "legal_name",
    },
    ProjectionStorageMapping {
        path: "company.trade_name",
        table: "company_projection",
        column: "trade_name",
    },
    ProjectionStorageMapping {
        path: "company.company_type",
        table: "company_projection",
        column: "company_type",
    },
    ProjectionStorageMapping {
        path: "company.status",
        table: "company_projection",
        column: "org_status",
    },
    ProjectionStorageMapping {
        path: "company.condition",
        table: "company_projection",
        column: "org_condition",
    },
    ProjectionStorageMapping {
        path: "company.fiscal_address",
        table: "company_projection",
        column: "fiscal_address",
    },
    ProjectionStorageMapping {
        path: "company.registration_date",
        table: "company_projection",
        column: "registration_date",
    },
    ProjectionStorageMapping {
        path: "company.activity_start_date",
        table: "company_projection",
        column: "activity_start_date",
    },
    ProjectionStorageMapping {
        path: "company.line_of_business",
        table: "company_projection",
        column: "line_of_business",
    },
    ProjectionStorageMapping {
        path: "company.economic_activity",
        table: "company_projection",
        column: "economic_activity",
    },
    ProjectionStorageMapping {
        path: "company.ubigeo_code",
        table: "company_projection",
        column: "org_ubigeo_code",
    },
    ProjectionStorageMapping {
        path: "company.department",
        table: "company_projection",
        column: "org_department",
    },
    ProjectionStorageMapping {
        path: "company.province",
        table: "company_projection",
        column: "org_province",
    },
    ProjectionStorageMapping {
        path: "company.district",
        table: "company_projection",
        column: "org_district",
    },
    ProjectionStorageMapping {
        path: "people.doc_type",
        table: "company_people_projection",
        column: "doc_type",
    },
    ProjectionStorageMapping {
        path: "people.doc_number",
        table: "company_people_projection",
        column: "doc_number",
    },
    ProjectionStorageMapping {
        path: "people.name",
        table: "company_people_projection",
        column: "name",
    },
    ProjectionStorageMapping {
        path: "people.role_name",
        table: "company_people_projection",
        column: "role_name",
    },
    ProjectionStorageMapping {
        path: "people.role_start_date",
        table: "company_people_projection",
        column: "role_start_date",
    },
    ProjectionStorageMapping {
        path: "phones.primary",
        table: "company_projection",
        column: "phone_primary",
    },
    ProjectionStorageMapping {
        path: "phones.secondary",
        table: "company_projection",
        column: "phone_secondary",
    },
    ProjectionStorageMapping {
        path: "phones.siblings",
        table: "ruc_phone_agg",
        column: "phones",
    },
];
