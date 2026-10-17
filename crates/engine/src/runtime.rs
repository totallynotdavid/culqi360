use axum::Router;
use axum::routing::get;
use leads::api::{RecordState, router as record_router};
use leads::service::{CandidateService, ImportService};
use search::api::{SearchState, router as search_router};
use search::service::SearchService;
use shared::error::StartupError;
use shared::hmac::HmacVerifier;
use shared::rate_limit::RateLimiter;
use shared::sqlite::{make_pool, make_readonly_pool};
use std::net::SocketAddr;
use std::path::Path;
use std::sync::Arc;

use crate::config::{EngineConfig, IngestConfig};
use crate::health;
use crate::ingest;
use crate::ingest::queue::IngestQueue;
use crate::ingest::runner::RunSettings;
use crate::ingest::upload::UploadRegistry;
use crate::observability;

pub async fn run() -> Result<(), StartupError> {
    observability::init_tracing();
    load_root_env();

    let cfg = EngineConfig::load()?;

    if !Path::new(&cfg.contacts_db_path).exists() {
        return Err(StartupError::Database(format!(
            "contacts database not found at {}\n  \
            Build the synthetic fixture with: mise run pipeline:fixture\n  \
            Build from raw snapshots with: mise run pipeline:refresh",
            cfg.contacts_db_path
        )));
    }

    // WAL must be enabled before the read-only pool opens any connections.
    if cfg.ingest.is_some() {
        ingest::wal::ensure_enabled(&cfg.contacts_db_path)?;
    }

    let contacts_pool = make_readonly_pool(&cfg.contacts_db_path)?;
    let leads_pool = make_pool(&cfg.leads_db_path)?;

    {
        let conn = contacts_pool
            .get()
            .map_err(|e| StartupError::Database(format!("pool get failed: {e}")))?;

        search::validate_schema(&conn)?;
    }

    {
        let conn = leads_pool
            .get()
            .map_err(|e| StartupError::Database(format!("pool get failed: {e}")))?;

        leads::validate_schema(&conn)?;
    }

    let hmac = Arc::new(HmacVerifier::new(
        cfg.hmac_keys.clone(),
        cfg.hmac_max_skew_secs,
    ));
    let limiter = Arc::new(RateLimiter::new(cfg.rate_limit_per_key));

    let search_state = Arc::new(SearchState {
        service: Arc::new(SearchService::new(contacts_pool.clone(), cfg.max_limit)),
        hmac: hmac.clone(),
        limiter: limiter.clone(),
    });

    let record_state = Arc::new(RecordState {
        service: Arc::new(CandidateService::new(leads_pool.clone(), cfg.max_limit)),
        import_service: Arc::new(ImportService::new(leads_pool.clone())),
        hmac: hmac.clone(),
        limiter: limiter.clone(),
    });

    let health_pool = contacts_pool.clone();

    let mut app = Router::new()
        .route("/health", get(move || health::handler(health_pool.clone())))
        .merge(search_router(search_state))
        .merge(record_router(record_state));

    if let Some(ingest_cfg) = &cfg.ingest {
        app = app.merge(build_ingest_router(&cfg, ingest_cfg, hmac, limiter)?);
    }

    let bind = format!("{}:{}", cfg.host, cfg.port);
    let listener = tokio::net::TcpListener::bind(&bind)
        .await
        .map_err(|e| StartupError::Config(format!("bind failed: {e}")))?;

    tracing::info!("engine listening on {bind}");

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await
    .map_err(|e| StartupError::Config(format!("server error: {e}")))
}

fn build_ingest_router(
    cfg: &EngineConfig,
    ingest_cfg: &IngestConfig,
    hmac: Arc<HmacVerifier>,
    limiter: Arc<RateLimiter>,
) -> Result<Router, StartupError> {
    let upload_dir = Path::new(&cfg.contacts_db_path)
        .parent()
        .unwrap_or_else(|| Path::new("."))
        .join("uploads");

    std::fs::create_dir_all(&upload_dir).map_err(|e| {
        StartupError::Config(format!(
            "could not create upload directory {}: {e}",
            upload_dir.display()
        ))
    })?;

    ingest::upload::clear_upload_dir(&upload_dir);

    let store = ingest::JobStore::new(make_pool(&ingest_cfg.job_db_path)?)?;

    match store.fail_orphaned_jobs() {
        Ok(0) => {}
        Ok(count) => tracing::warn!(count, "failed ingest jobs orphaned by a restart"),
        Err(err) => tracing::warn!(%err, "could not close orphaned ingest jobs"),
    }

    let registry = UploadRegistry::new(ingest_cfg.max_queued_uploads);
    let (queue, receiver) = IngestQueue::new();

    // Runs until the process exits.
    tokio::spawn(ingest::queue::run_consumer_loop(receiver, store.clone()));

    tracing::info!(
        upload_dir = %upload_dir.display(),
        workers = ingest_cfg.workers,
        max_upload_bytes = ingest_cfg.max_upload_bytes,
        max_rows = ingest_cfg.max_rows,
        max_queued_uploads = ingest_cfg.max_queued_uploads,
        "ingest enabled"
    );

    Ok(ingest::router(Arc::new(ingest::IngestState::new(
        store,
        cfg.contacts_db_path.clone(),
        upload_dir,
        registry,
        queue,
        ingest_cfg.max_upload_bytes,
        RunSettings {
            workers: ingest_cfg.workers,
            batch_size: ingest_cfg.batch_size,
            max_rows: ingest_cfg.max_rows,
        },
        hmac,
        limiter,
    ))))
}

fn load_root_env() {
    let env_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.env");
    let _ = dotenvy::from_path(env_path);
}
