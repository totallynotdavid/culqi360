use crate::contracts::{CandidateStrategy, RecordCandidate, RecordImportRow};
use rusqlite::{Connection, Row, params};
use shared::error::ApiError;
use std::sync::LazyLock;

const SELECT_ACTIVE: &str = "
    SELECT
        ruc,
        COALESCE(NULLIF(organization_name, ''), ruc) AS organization_name,
        dni,
        COALESCE(NULLIF(person_name, ''), dni)       AS person_name,
        phone_primary
    FROM leads
    WHERE active = 1";

static SQL_BALANCED: LazyLock<String> = LazyLock::new(|| {
    format!(
        "{SELECT_ACTIVE}\nORDER BY ((id * 1315423911 + ?2 * 97 + ?3 * 193) & 2147483647)\nLIMIT ?1"
    )
});

static SQL_FRESHNESS: LazyLock<String> =
    LazyLock::new(|| format!("{SELECT_ACTIVE}\nORDER BY id DESC\nLIMIT ?1"));

static SQL_CONVERSION: LazyLock<String> =
    LazyLock::new(|| format!("{SELECT_ACTIVE}\nORDER BY quality_tier DESC, id\nLIMIT ?1"));

pub fn list_candidates(
    conn: &Connection,
    limit: usize,
    branch_id: i64,
    user_id: i64,
    strategy: CandidateStrategy,
) -> Result<Vec<RecordCandidate>, ApiError> {
    match strategy {
        CandidateStrategy::Balanced => {
            let mut stmt = conn.prepare_cached(&SQL_BALANCED).map_err(db_err)?;
            stmt.query_map(params![limit as i64, branch_id, user_id], map_candidate_row)
                .map_err(db_err)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(db_err)
        }
        CandidateStrategy::Freshness => {
            let mut stmt = conn.prepare_cached(&SQL_FRESHNESS).map_err(db_err)?;
            stmt.query_map(params![limit as i64], map_candidate_row)
                .map_err(db_err)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(db_err)
        }
        CandidateStrategy::Conversion => {
            let mut stmt = conn.prepare_cached(&SQL_CONVERSION).map_err(db_err)?;
            stmt.query_map(params![limit as i64], map_candidate_row)
                .map_err(db_err)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(db_err)
        }
    }
}

/// Upserts a batch of validated rows. Returns `(inserted, updated)`.
/// Validation is the caller's responsibility.
pub fn upsert_batch(
    conn: &mut Connection,
    rows: &[RecordImportRow],
    source: &str,
    now: i64,
) -> Result<(usize, usize), ApiError> {
    let tx = conn
        .transaction()
        .map_err(|e| ApiError::Service(format!("transaction begin failed: {e}")))?;

    let mut inserted = 0usize;
    let mut updated = 0usize;

    for row in rows {
        let quality_tier = row.quality_tier.unwrap_or(1);

        let n = tx
            .execute(
                "INSERT OR IGNORE INTO leads
                    (ruc, dni, organization_name, person_name, phone_primary,
                     quality_tier, product_tag, branch_tag, source, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
                params![
                    row.ruc,
                    row.dni,
                    row.organization_name,
                    row.person_name,
                    row.phone_primary,
                    quality_tier,
                    row.product_tag,
                    row.branch_tag,
                    source,
                    now,
                ],
            )
            .map_err(|e| ApiError::Service(format!("insert failed: {e}")))?;

        if n == 1 {
            inserted += 1;
        } else {
            tx.execute(
                "UPDATE leads SET
                    organization_name = ?3,
                    person_name       = ?4,
                    phone_primary     = ?5,
                    quality_tier      = ?6,
                    source            = ?7,
                    updated_at        = ?8
                 WHERE ruc = ?1 AND dni = ?2",
                params![
                    row.ruc,
                    row.dni,
                    row.organization_name,
                    row.person_name,
                    row.phone_primary,
                    quality_tier,
                    source,
                    now,
                ],
            )
            .map_err(|e| ApiError::Service(format!("update failed: {e}")))?;
            updated += 1;
        }
    }

    tx.commit()
        .map_err(|e| ApiError::Service(format!("transaction commit failed: {e}")))?;

    Ok((inserted, updated))
}

fn map_candidate_row(row: &Row<'_>) -> rusqlite::Result<RecordCandidate> {
    Ok(RecordCandidate {
        ruc: row.get("ruc")?,
        organization_name: row.get("organization_name")?,
        dni: row.get("dni")?,
        person_name: row.get("person_name")?,
        phone_primary: row.get("phone_primary")?,
    })
}

fn db_err(e: rusqlite::Error) -> ApiError {
    ApiError::Service(format!("database query failed: {e}"))
}
