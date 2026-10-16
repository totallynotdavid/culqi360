use crate::contracts::{
    RecordCandidateRequest, RecordCandidatesResponse, RecordImportRequest, RecordImportResponse,
    RecordImportRow,
};
use crate::domain;
use crate::repo;
use shared::error::ApiError;
use shared::sqlite::SqlitePool;

#[derive(Clone)]
pub struct CandidateService {
    pool: SqlitePool,
    max_limit: usize,
}

impl CandidateService {
    pub fn new(pool: SqlitePool, max_limit: usize) -> Self {
        Self { pool, max_limit }
    }

    #[tracing::instrument(skip(self, req), fields(branch_id = req.branch_id, user_id = req.user_id, amount = req.amount))]
    pub fn candidates(
        &self,
        req: &RecordCandidateRequest,
    ) -> Result<RecordCandidatesResponse, ApiError> {
        validate_candidate_request(req)?;

        let limit = req.amount.min(self.max_limit).max(1);
        let conn = self
            .pool
            .get()
            .map_err(|e| ApiError::Service(format!("pool get failed: {e}")))?;

        let raw = repo::list_candidates(&conn, limit, req.branch_id, req.user_id, req.strategy)?;
        let ranked = domain::rank_candidates(raw, req.strategy);
        let deduped = domain::dedupe_candidates(ranked);
        let count = deduped.len();

        Ok(RecordCandidatesResponse {
            candidates: deduped,
            count,
        })
    }
}

#[derive(Clone)]
pub struct ImportService {
    pool: SqlitePool,
}

impl ImportService {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    #[tracing::instrument(skip(self, req), fields(rows = req.rows.len(), source = %req.source))]
    pub fn import_leads(
        &self,
        req: &RecordImportRequest,
    ) -> Result<RecordImportResponse, ApiError> {
        let total = req.rows.len();
        let valid: Vec<&RecordImportRow> = req.rows.iter().filter(|r| is_valid_row(r)).collect();
        let skipped = total - valid.len();

        let mut conn = self
            .pool
            .get()
            .map_err(|e| ApiError::Service(format!("pool get failed: {e}")))?;

        let now = current_unix_secs()?;
        let owned: Vec<RecordImportRow> = valid.into_iter().cloned().collect();
        let (inserted, updated) = repo::upsert_batch(&mut conn, &owned, &req.source, now)?;

        Ok(RecordImportResponse {
            inserted,
            updated,
            skipped,
            total,
        })
    }
}

fn validate_candidate_request(req: &RecordCandidateRequest) -> Result<(), ApiError> {
    if req.branch_id <= 0 {
        return Err(ApiError::Validation("branch_id must be positive".into()));
    }
    if req.user_id <= 0 {
        return Err(ApiError::Validation("user_id must be positive".into()));
    }
    if req.team_id.is_some_and(|id| id <= 0) {
        return Err(ApiError::Validation("team_id must be positive".into()));
    }
    if req.product_id.is_some_and(|id| id <= 0) {
        return Err(ApiError::Validation("product_id must be positive".into()));
    }
    Ok(())
}

fn is_valid_row(row: &RecordImportRow) -> bool {
    let ruc_ok = row.ruc.len() == 11 && row.ruc.chars().all(|c| c.is_ascii_digit());
    let dni_ok = (8..=12).contains(&row.dni.len()) && row.dni.chars().all(|c| c.is_ascii_digit());
    let phone_ok = !row.phone_primary.trim().is_empty();
    let name_ok = !row.person_name.trim().is_empty();
    ruc_ok && dni_ok && phone_ok && name_ok
}

fn current_unix_secs() -> Result<i64, ApiError> {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .map_err(|_| ApiError::Internal)
}
