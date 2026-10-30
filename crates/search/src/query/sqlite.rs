use crate::domain::QueryStrategy;
use crate::result_contract_generated::{
    CompanyInfo, CompanyRow, DocInfo, DocumentRow, OrgInfo, PersonInfo, PhoneInfo, RoleInfo,
    SearchResult,
};
use rusqlite::{Connection, Row, params};
use shared::error::ApiError;
use std::sync::LazyLock;

const DOC_SELECT_COLUMNS: &str = "
  c.doc_type,
  c.doc_number,
  NULLIF(c.name, '')                AS name,
  NULLIF(c.person_ruc, '')          AS ruc,
  NULLIF(c.birth_date, '')          AS birth_date,
  NULLIF(c.birth_place, '')         AS birth_place,
  NULLIF(c.sex, '')                 AS sex,
  NULLIF(c.marital_status, '')      AS marital_status,
  NULLIF(c.location_text, '')       AS location_text,
  NULLIF(c.ubigeo_code, '')         AS ubigeo_code,
  NULLIF(c.mother_name, '')         AS mother_name,
  NULLIF(c.father_name, '')         AS father_name,
  NULLIF(c.email, '')               AS email,
  NULLIF(c.org_ruc, '')             AS org_ruc,
  NULLIF(c.org_name, '')            AS org_name,
  NULLIF(c.trade_name, '')          AS trade_name,
  NULLIF(c.company_type, '')        AS company_type,
  NULLIF(c.org_status, '')          AS org_status,
  NULLIF(c.org_condition, '')       AS org_condition,
  NULLIF(c.fiscal_address, '')      AS fiscal_address,
  NULLIF(c.registration_date, '')   AS registration_date,
  NULLIF(c.activity_start_date, '') AS activity_start_date,
  NULLIF(c.line_of_business, '')    AS line_of_business,
  NULLIF(c.economic_activity, '')   AS economic_activity,
  NULLIF(c.org_ubigeo_code, '')     AS org_ubigeo_code,
  NULLIF(c.org_department, '')      AS org_department,
  NULLIF(c.org_province, '')        AS org_province,
  NULLIF(c.org_district, '')        AS org_district,
  NULLIF(c.role_name, '')           AS role_name,
  NULLIF(c.role_start_date, '')     AS role_start_date,
  NULLIF(c.rep_doc_type, '')        AS rep_doc_type,
  NULLIF(c.rep_doc_number, '')      AS rep_doc_number,
  NULLIF(c.rep_name, '')            AS rep_name,
  NULLIF(c.phone_primary, '')       AS phone_primary,
  NULLIF(c.phone_secondary, '')     AS phone_secondary";

const COMPANY_SELECT_COLUMNS: &str = "
  c.company_id                      AS company_id,
  c.ruc,
  NULLIF(c.legal_name, '')          AS legal_name,
  NULLIF(c.trade_name, '')          AS trade_name,
  NULLIF(c.company_type, '')        AS company_type,
  NULLIF(c.org_status, '')          AS org_status,
  NULLIF(c.org_condition, '')       AS org_condition,
  NULLIF(c.fiscal_address, '')      AS fiscal_address,
  NULLIF(c.registration_date, '')   AS registration_date,
  NULLIF(c.activity_start_date, '') AS activity_start_date,
  NULLIF(c.line_of_business, '')    AS line_of_business,
  NULLIF(c.economic_activity, '')   AS economic_activity,
  NULLIF(c.org_ubigeo_code, '')     AS org_ubigeo_code,
  NULLIF(c.org_department, '')      AS org_department,
  NULLIF(c.org_province, '')        AS org_province,
  NULLIF(c.org_district, '')        AS org_district,
  NULLIF(c.phone_primary, '')       AS phone_primary,
  NULLIF(c.phone_secondary, '')     AS phone_secondary";

const SQL_COMPANY_PEOPLE: &str = "SELECT doc_type, doc_number, name, role_name, role_start_date\n\
     FROM company_people_projection\n\
     WHERE company_id = ?1\n\
     ORDER BY position";

static SQL_DOCUMENT: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{DOC_SELECT_COLUMNS}\n\
         FROM doc_projection c\n\
         WHERE c.doc_type = ?1 AND c.doc_number = ?2\n\
         LIMIT ?3"
    )
});

static SQL_RUC: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{COMPANY_SELECT_COLUMNS},\n  rpa.phones AS sibling_phones\n\
         FROM company_projection c\n\
         LEFT JOIN ruc_phone_agg rpa ON rpa.org_ruc = c.ruc\n\
         WHERE c.ruc = ?1\n\
         LIMIT ?2"
    )
});

static SQL_PHONE_ENRICHED_DOC: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{DOC_SELECT_COLUMNS},\n  dpa.phones AS sibling_phones\n\
         FROM doc_projection_phone_index pi\n\
         JOIN doc_projection c ON c.doc_id = pi.doc_id\n\
         LEFT JOIN doc_phone_agg dpa ON dpa.doc_id = c.doc_id\n\
         WHERE pi.phone = ?1\n\
         LIMIT ?2"
    )
});

static SQL_PHONE_ENRICHED_COMPANY: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{COMPANY_SELECT_COLUMNS},\n  rpa.phones AS sibling_phones\n\
         FROM company_projection_phone_index pi\n\
         JOIN company_projection c ON c.company_id = pi.company_id\n\
         LEFT JOIN ruc_phone_agg rpa ON rpa.org_ruc = c.ruc\n\
         WHERE pi.phone = ?1\n\
         LIMIT ?2"
    )
});

static SQL_FTS_DOC: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{DOC_SELECT_COLUMNS}\n\
         FROM doc_projection c\n\
         JOIN doc_projection_fts f ON f.rowid = c.doc_id\n\
         WHERE doc_projection_fts MATCH ?1\n\
         ORDER BY rank\n\
         LIMIT ?2"
    )
});

static SQL_FTS_COMPANY: LazyLock<String> = LazyLock::new(|| {
    format!(
        "SELECT{COMPANY_SELECT_COLUMNS}\n\
         FROM company_projection c\n\
         JOIN company_projection_fts f ON f.rowid = c.company_id\n\
         WHERE company_projection_fts MATCH ?1\n\
         ORDER BY rank\n\
         LIMIT ?2"
    )
});

pub fn search(
    conn: &Connection,
    strategy: QueryStrategy,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    let mut results = run_strategy(conn, strategy, limit)?;
    attach_company_people(conn, &mut results)?;
    Ok(results)
}

fn run_strategy(
    conn: &Connection,
    strategy: QueryStrategy,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    match strategy {
        QueryStrategy::Document {
            doc_type,
            doc_number,
        } => search_by_document(conn, &doc_type, &doc_number, limit),
        QueryStrategy::Ruc(value) => search_by_ruc(conn, &value, limit),
        QueryStrategy::Phone(value) => search_by_phone(conn, &value, limit),
        QueryStrategy::PersonName(value) => search_by_person_name(conn, &value, limit),
        QueryStrategy::CompanyName(value) => search_by_company_name(conn, &value, limit),
        QueryStrategy::MixedName(value) => search_by_name(conn, &value, limit),
    }
}

/// Fills `people` on every company row. Each lookup is a primary-key range
/// scan, so the cost is bounded by the result limit.
fn attach_company_people(conn: &Connection, results: &mut [SearchResult]) -> Result<(), ApiError> {
    let mut stmt = conn.prepare_cached(SQL_COMPANY_PEOPLE).map_err(db_err)?;
    for result in results {
        let SearchResult::Company(company_row) = result else {
            continue;
        };
        company_row.people = stmt
            .query_map(params![company_row.company.id], |row| {
                Ok(PersonInfo {
                    doc_type: row.get("doc_type")?,
                    doc_number: row.get("doc_number")?,
                    name: row.get("name")?,
                    role_name: row.get("role_name")?,
                    role_start_date: row.get("role_start_date")?,
                })
            })
            .map_err(db_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_err)?;
    }
    Ok(())
}

fn search_by_document(
    conn: &Connection,
    doc_type: &str,
    doc_number: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    query_doc_rows(
        conn,
        &SQL_DOCUMENT,
        params![doc_type, doc_number, limit as i64],
    )
}

fn search_by_ruc(
    conn: &Connection,
    value: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    let mut stmt = conn.prepare_cached(&SQL_RUC).map_err(db_err)?;
    stmt.query_map(params![value, limit as i64], map_company_row_with_siblings)
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)
}

fn search_by_phone(
    conn: &Connection,
    value: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    let mut doc_stmt = conn
        .prepare_cached(&SQL_PHONE_ENRICHED_DOC)
        .map_err(db_err)?;
    let docs = doc_stmt
        .query_map(params![value, limit as i64], map_doc_row_with_siblings)
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)?;

    let remaining = limit.saturating_sub(docs.len());
    let companies = if remaining > 0 {
        let mut company_stmt = conn
            .prepare_cached(&SQL_PHONE_ENRICHED_COMPANY)
            .map_err(db_err)?;
        company_stmt
            .query_map(
                params![value, remaining as i64],
                map_company_row_with_siblings,
            )
            .map_err(db_err)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(db_err)?
    } else {
        vec![]
    };

    let mut results = docs;
    results.extend(companies);
    Ok(results)
}

fn search_by_person_name(
    conn: &Connection,
    text: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    query_doc_rows(
        conn,
        &SQL_FTS_DOC,
        params![fts_query("doc_name", text), limit as i64],
    )
}

fn search_by_company_name(
    conn: &Connection,
    text: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    query_company_rows(
        conn,
        &SQL_FTS_COMPANY,
        params![fts_query("company_name", text), limit as i64],
    )
}

fn search_by_name(
    conn: &Connection,
    text: &str,
    limit: usize,
) -> Result<Vec<SearchResult>, ApiError> {
    let people = search_by_person_name(conn, text, limit)?;
    let remaining = limit.saturating_sub(people.len());
    let companies = if remaining > 0 {
        search_by_company_name(conn, text, remaining)?
    } else {
        vec![]
    };
    let mut results = people;
    results.extend(companies);
    Ok(results)
}

fn query_doc_rows<P>(conn: &Connection, sql: &str, params: P) -> Result<Vec<SearchResult>, ApiError>
where
    P: rusqlite::Params,
{
    let mut stmt = conn.prepare_cached(sql).map_err(db_err)?;
    stmt.query_map(params, map_doc_row)
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)
}

fn query_company_rows<P>(
    conn: &Connection,
    sql: &str,
    params: P,
) -> Result<Vec<SearchResult>, ApiError>
where
    P: rusqlite::Params,
{
    let mut stmt = conn.prepare_cached(sql).map_err(db_err)?;
    stmt.query_map(params, map_company_row)
        .map_err(db_err)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(db_err)
}

fn map_doc_row(row: &Row<'_>) -> rusqlite::Result<SearchResult> {
    let org_ruc: Option<String> = row.get("org_ruc")?;
    let org_name: Option<String> = row.get("org_name")?;
    let trade_name: Option<String> = row.get("trade_name")?;
    let company_type: Option<String> = row.get("company_type")?;
    let org_status: Option<String> = row.get("org_status")?;
    let org_condition: Option<String> = row.get("org_condition")?;
    let fiscal_address: Option<String> = row.get("fiscal_address")?;
    let registration_date: Option<String> = row.get("registration_date")?;
    let activity_start_date: Option<String> = row.get("activity_start_date")?;
    let line_of_business: Option<String> = row.get("line_of_business")?;
    let economic_activity: Option<String> = row.get("economic_activity")?;
    let org_ubigeo_code: Option<String> = row.get("org_ubigeo_code")?;
    let org_department: Option<String> = row.get("org_department")?;
    let org_province: Option<String> = row.get("org_province")?;
    let org_district: Option<String> = row.get("org_district")?;

    let org = if org_ruc.is_none()
        && org_name.is_none()
        && trade_name.is_none()
        && company_type.is_none()
        && org_status.is_none()
        && org_condition.is_none()
        && fiscal_address.is_none()
        && registration_date.is_none()
        && activity_start_date.is_none()
        && line_of_business.is_none()
        && economic_activity.is_none()
        && org_ubigeo_code.is_none()
        && org_department.is_none()
        && org_province.is_none()
        && org_district.is_none()
    {
        None
    } else {
        Some(OrgInfo {
            ruc: org_ruc,
            name: org_name,
            trade_name,
            company_type,
            status: org_status,
            condition: org_condition,
            fiscal_address,
            registration_date,
            activity_start_date,
            line_of_business,
            economic_activity,
            ubigeo_code: org_ubigeo_code,
            department: org_department,
            province: org_province,
            district: org_district,
        })
    };

    let role_name: Option<String> = row.get("role_name")?;
    let role_start_date: Option<String> = row.get("role_start_date")?;
    let rep_doc_type: Option<String> = row.get("rep_doc_type")?;
    let rep_doc_number: Option<String> = row.get("rep_doc_number")?;
    let rep_name: Option<String> = row.get("rep_name")?;

    let role = if role_name.is_none()
        && role_start_date.is_none()
        && rep_doc_type.is_none()
        && rep_doc_number.is_none()
        && rep_name.is_none()
    {
        None
    } else {
        Some(RoleInfo {
            name: role_name,
            start_date: role_start_date,
            rep_doc_type,
            rep_doc_number,
            rep_name,
        })
    };

    Ok(SearchResult::Document(Box::new(DocumentRow {
        doc: DocInfo {
            doc_type: row.get("doc_type")?,
            doc_number: row.get("doc_number")?,
            name: row.get("name")?,
            ruc: row.get("ruc")?,
            birth_date: row.get("birth_date")?,
            birth_place: row.get("birth_place")?,
            sex: row.get("sex")?,
            marital_status: row.get("marital_status")?,
            location_text: row.get("location_text")?,
            ubigeo_code: row.get("ubigeo_code")?,
            mother_name: row.get("mother_name")?,
            father_name: row.get("father_name")?,
            email: row.get("email")?,
        },
        org,
        role,
        phones: PhoneInfo {
            primary: row.get("phone_primary")?,
            secondary: row.get("phone_secondary")?,
            siblings: None,
        },
    })))
}

fn map_doc_row_with_siblings(row: &Row<'_>) -> rusqlite::Result<SearchResult> {
    let mut result = map_doc_row(row)?;
    let raw: Option<String> = row.get("sibling_phones")?;
    if let SearchResult::Document(ref mut doc_row) = result {
        doc_row.phones.siblings = raw
            .as_deref()
            .map(|s| s.split(';').map(str::to_owned).collect());
    }
    Ok(result)
}

fn map_company_row(row: &Row<'_>) -> rusqlite::Result<SearchResult> {
    Ok(SearchResult::Company(Box::new(CompanyRow {
        company: CompanyInfo {
            id: row.get("company_id")?,
            ruc: row.get("ruc")?,
            legal_name: row.get("legal_name")?,
            trade_name: row.get("trade_name")?,
            company_type: row.get("company_type")?,
            status: row.get("org_status")?,
            condition: row.get("org_condition")?,
            fiscal_address: row.get("fiscal_address")?,
            registration_date: row.get("registration_date")?,
            activity_start_date: row.get("activity_start_date")?,
            line_of_business: row.get("line_of_business")?,
            economic_activity: row.get("economic_activity")?,
            ubigeo_code: row.get("org_ubigeo_code")?,
            department: row.get("org_department")?,
            province: row.get("org_province")?,
            district: row.get("org_district")?,
        },
        people: Vec::new(),
        phones: PhoneInfo {
            primary: row.get("phone_primary")?,
            secondary: row.get("phone_secondary")?,
            siblings: None,
        },
    })))
}

fn map_company_row_with_siblings(row: &Row<'_>) -> rusqlite::Result<SearchResult> {
    let mut result = map_company_row(row)?;
    let raw: Option<String> = row.get("sibling_phones")?;
    if let SearchResult::Company(ref mut company_row) = result {
        company_row.phones.siblings = raw
            .as_deref()
            .map(|s| s.split(';').map(str::to_owned).collect());
    }
    Ok(result)
}

fn fts_query(field: &str, text: &str) -> String {
    let tokens: Vec<String> = text
        .split_whitespace()
        .map(|t| {
            t.chars()
                .filter(|c| c.is_alphanumeric())
                .flat_map(|c| c.to_lowercase())
                .collect()
        })
        .filter(|t: &String| t.len() >= 2)
        .collect();

    let mut out = String::new();
    for token in &tokens {
        if !out.is_empty() {
            out.push_str(" AND ");
        }
        out.push_str(field);
        out.push(':');
        out.push_str(token);
        out.push('*');
    }
    out
}

fn db_err(e: rusqlite::Error) -> ApiError {
    ApiError::Service(format!("database query failed: {e}"))
}
