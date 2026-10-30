use axum::Router;
use axum::routing::get;
use axum_test::TestServer;
use engine::health;
use leads::api::{RecordState, router as record_router};
use leads::service::{CandidateService, ImportService};
use rusqlite::Connection;
use search::api::{SearchState, router as search_router};
use search::service::SearchService;
use shared::hmac::HmacVerifier;
use shared::rate_limit::RateLimiter;
use shared::sqlite::make_readonly_pool;
use std::collections::HashMap;
use std::sync::Arc;

pub fn create_test_db() -> tempfile::NamedTempFile {
    let file = tempfile::NamedTempFile::new().expect("temp file");
    let conn = Connection::open(file.path()).expect("open");
    conn.execute_batch(
        "
        CREATE TABLE doc_projection (
            doc_id              INTEGER PRIMARY KEY,
            doc_type            TEXT NOT NULL,
            doc_number          TEXT NOT NULL,
            name                TEXT,
            birth_date          TEXT,
            birth_place         TEXT,
            sex                 TEXT,
            marital_status      TEXT,
            location_text       TEXT,
            ubigeo_code         TEXT,
            mother_name         TEXT,
            father_name         TEXT,
            email               TEXT,
            person_ruc          TEXT,
            org_ruc             TEXT,
            org_name            TEXT,
            trade_name          TEXT,
            company_type        TEXT,
            org_status          TEXT,
            org_condition       TEXT,
            fiscal_address      TEXT,
            registration_date   TEXT,
            activity_start_date TEXT,
            line_of_business    TEXT,
            economic_activity   TEXT,
            org_ubigeo_code     TEXT,
            org_department      TEXT,
            org_province        TEXT,
            org_district        TEXT,
            role_name           TEXT,
            role_start_date     TEXT,
            rep_doc_type        TEXT,
            rep_doc_number      TEXT,
            rep_name            TEXT,
            phone_primary       TEXT,
            phone_secondary     TEXT
        );
        CREATE TABLE company_projection (
            company_id          INTEGER PRIMARY KEY,
            ruc                 TEXT NOT NULL,
            legal_name          TEXT,
            trade_name          TEXT,
            company_type        TEXT,
            org_status          TEXT,
            org_condition       TEXT,
            fiscal_address      TEXT,
            registration_date   TEXT,
            activity_start_date TEXT,
            line_of_business    TEXT,
            economic_activity   TEXT,
            org_ubigeo_code     TEXT,
            org_department      TEXT,
            org_province        TEXT,
            org_district        TEXT,
            phone_primary       TEXT,
            phone_secondary     TEXT
        );
        CREATE TABLE company_people_projection (
            company_id          INTEGER NOT NULL,
            position            INTEGER NOT NULL,
            doc_type            TEXT,
            doc_number          TEXT,
            name                TEXT,
            role_name           TEXT,
            role_start_date     TEXT,
            PRIMARY KEY(company_id, position)
        );
        CREATE TABLE doc_projection_phone_index (
            phone   TEXT    NOT NULL,
            doc_id  INTEGER NOT NULL,
            UNIQUE(phone, doc_id)
        );
        CREATE TABLE company_projection_phone_index (
            phone       TEXT    NOT NULL,
            company_id  INTEGER NOT NULL,
            UNIQUE(phone, company_id)
        );
        CREATE VIRTUAL TABLE doc_projection_fts USING fts5(
            doc_name,
            tokenize='unicode61 remove_diacritics 1'
        );
        CREATE VIRTUAL TABLE company_projection_fts USING fts5(
            company_name,
            tokenize='unicode61 remove_diacritics 1'
        );
        CREATE TABLE ruc_phone_agg (org_ruc TEXT PRIMARY KEY, phones TEXT NOT NULL);
        CREATE TABLE doc_phone_agg  (doc_id  INTEGER PRIMARY KEY, phones TEXT NOT NULL);
        ",
    )
    .expect("seed schema");
    file
}

pub fn make_test_server() -> (TestServer, tempfile::NamedTempFile) {
    let db = create_test_db();
    let pool = make_readonly_pool(db.path().to_str().expect("path")).expect("pool");

    let conn = pool.get().expect("conn");
    search::validate_schema(&conn).expect("schema");
    drop(conn);

    let hmac = Arc::new(HmacVerifier::new(
        HashMap::from([("web".to_string(), "test-secret".to_string())]),
        60,
    ));
    let limiter = Arc::new(RateLimiter::new(600));

    let search_state = Arc::new(SearchState {
        service: Arc::new(SearchService::new(pool.clone(), 100)),
        hmac: hmac.clone(),
        limiter: limiter.clone(),
    });
    let record_state = Arc::new(RecordState {
        service: Arc::new(CandidateService::new(pool.clone(), 100)),
        import_service: Arc::new(ImportService::new(pool.clone())),
        hmac: hmac.clone(),
        limiter: limiter.clone(),
    });

    let health_pool = pool.clone();
    let app = Router::new()
        .route("/health", get(move || health::handler(health_pool.clone())))
        .merge(search_router(search_state))
        .merge(record_router(record_state));

    let server = TestServer::new(app);
    (server, db)
}
