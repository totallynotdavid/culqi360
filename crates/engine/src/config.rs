use shared::error::StartupError;
use std::collections::HashMap;
use std::env;
use std::net::IpAddr;

const DEFAULT_ENGINE_HOST: &str = "127.0.0.1";
const DEFAULT_ENGINE_PORT: u16 = 3001;
const DEFAULT_CONTACTS_DB_PATH: &str = "crates/engine/data/contacts.sqlite";
const DEFAULT_LEADS_DB_PATH: &str = "crates/engine/data/leads.sqlite";
const DEFAULT_HMAC_MAX_SKEW_SECS: i64 = 60;
const DEFAULT_RATE_LIMIT_PER_KEY: u32 = 600;
const DEFAULT_MAX_LIMIT: usize = 100;

const DEFAULT_INGEST_JOB_DB_PATH: &str = "crates/engine/data/ingest.sqlite";

// Leave CPU headroom for search while ingest runs.
const DEFAULT_INGEST_WORKERS: usize = 4;

const DEFAULT_INGEST_BATCH_SIZE: usize = 5_000;

// Headroom over the largest expected source file.
const DEFAULT_INGEST_MAX_UPLOAD_BYTES: u64 = 2 * 1024 * 1024 * 1024;

// Guards against pathological CSVs independently of file size.
const DEFAULT_INGEST_MAX_ROWS: i64 = 10_000_000;

// Bounds simultaneous scratch-disk usage from queued and active uploads.
const DEFAULT_INGEST_MAX_QUEUED_UPLOADS: usize = 8;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectMode {
    Local,
    Internal,
    Remote,
}

#[derive(Debug, Clone)]
pub struct EngineConfig {
    pub connect_mode: ConnectMode,
    pub host: String,
    pub port: u16,
    pub contacts_db_path: String,
    pub leads_db_path: String,
    pub hmac_keys: HashMap<String, String>,
    pub hmac_max_skew_secs: i64,
    pub rate_limit_per_key: u32,
    pub max_limit: usize,

    /// `None` disables ingest. Enable it with `ENGINE_INGEST_ENABLED`.
    pub ingest: Option<IngestConfig>,
}

#[derive(Debug, Clone)]
pub struct IngestConfig {
    pub job_db_path: String,
    pub workers: usize,
    pub batch_size: usize,
    pub max_upload_bytes: u64,
    pub max_rows: i64,
    pub max_queued_uploads: usize,
}

impl EngineConfig {
    pub fn load() -> Result<Self, StartupError> {
        let env = Env;
        let connect_mode = parse_connect_mode(&env.string("ENGINE_CONNECT_MODE", "local"))?;
        let hmac_keys = parse_hmac_keys(&env.require("ENGINE_HMAC_KEYS_JSON")?)?;

        let contacts_db_path = env.string("ENGINE_CONTACTS_DB_PATH", DEFAULT_CONTACTS_DB_PATH);
        let leads_db_path = env.string("ENGINE_LEADS_DB_PATH", DEFAULT_LEADS_DB_PATH);
        let host = env.string("ENGINE_HOST", DEFAULT_ENGINE_HOST);

        if connect_mode == ConnectMode::Local && !is_loopback(&host) {
            return Err(StartupError::Config(
                "ENGINE_HOST must bind to loopback in local mode".into(),
            ));
        }

        Ok(Self {
            connect_mode,
            host,
            port: env.int("ENGINE_PORT", DEFAULT_ENGINE_PORT)?,
            contacts_db_path,
            leads_db_path,
            hmac_keys,
            hmac_max_skew_secs: env.int("ENGINE_HMAC_MAX_SKEW_SECS", DEFAULT_HMAC_MAX_SKEW_SECS)?,
            rate_limit_per_key: env.int("ENGINE_RATE_LIMIT_PER_KEY", DEFAULT_RATE_LIMIT_PER_KEY)?,
            max_limit: env.int("ENGINE_MAX_LIMIT", DEFAULT_MAX_LIMIT)?,
            ingest: load_ingest(&env)?,
        })
    }
}

fn load_ingest(env: &Env) -> Result<Option<IngestConfig>, StartupError> {
    if !env.bool("ENGINE_INGEST_ENABLED", false)? {
        return Ok(None);
    }

    let workers: usize = env.int("ENGINE_INGEST_WORKERS", DEFAULT_INGEST_WORKERS)?;

    if workers == 0 {
        return Err(StartupError::Config(
            "ENGINE_INGEST_WORKERS must be at least 1".into(),
        ));
    }

    let batch_size: usize = env.int("ENGINE_INGEST_BATCH_SIZE", DEFAULT_INGEST_BATCH_SIZE)?;

    if batch_size == 0 {
        return Err(StartupError::Config(
            "ENGINE_INGEST_BATCH_SIZE must be at least 1".into(),
        ));
    }

    let max_upload_bytes: u64 = env.int(
        "ENGINE_INGEST_MAX_UPLOAD_BYTES",
        DEFAULT_INGEST_MAX_UPLOAD_BYTES,
    )?;

    if max_upload_bytes == 0 {
        return Err(StartupError::Config(
            "ENGINE_INGEST_MAX_UPLOAD_BYTES must be at least 1".into(),
        ));
    }

    let max_rows: i64 = env.int("ENGINE_INGEST_MAX_ROWS", DEFAULT_INGEST_MAX_ROWS)?;

    if max_rows <= 0 {
        return Err(StartupError::Config(
            "ENGINE_INGEST_MAX_ROWS must be at least 1".into(),
        ));
    }

    let max_queued_uploads: usize = env.int(
        "ENGINE_INGEST_MAX_QUEUED_UPLOADS",
        DEFAULT_INGEST_MAX_QUEUED_UPLOADS,
    )?;

    if max_queued_uploads == 0 {
        return Err(StartupError::Config(
            "ENGINE_INGEST_MAX_QUEUED_UPLOADS must be at least 1".into(),
        ));
    }

    Ok(Some(IngestConfig {
        job_db_path: env.string("ENGINE_INGEST_JOB_DB_PATH", DEFAULT_INGEST_JOB_DB_PATH),
        workers,
        batch_size,
        max_upload_bytes,
        max_rows,
        max_queued_uploads,
    }))
}

#[derive(Debug, Default, Clone, Copy)]
struct Env;

impl Env {
    fn require(&self, name: &str) -> Result<String, StartupError> {
        env::var(name).map_err(|_| StartupError::Config(format!("{name} is required")))
    }

    fn string(&self, name: &str, default: &str) -> String {
        env::var(name).unwrap_or_else(|_| default.into())
    }

    fn int<T>(&self, name: &str, default: T) -> Result<T, StartupError>
    where
        T: std::str::FromStr + ToString,
    {
        match env::var(name) {
            Err(_) => Ok(default),
            Ok(value) => value.parse().map_err(|_| {
                StartupError::Config(format!("{name} must be a valid number, got: {value}"))
            }),
        }
    }

    fn bool(&self, name: &str, default: bool) -> Result<bool, StartupError> {
        match env::var(name) {
            Err(_) => Ok(default),
            Ok(value) => match value.as_str() {
                "true" | "1" => Ok(true),
                "false" | "0" => Ok(false),
                _ => Err(StartupError::Config(format!(
                    "{name} must be true/false or 1/0, got: {value}"
                ))),
            },
        }
    }
}

fn parse_connect_mode(raw: &str) -> Result<ConnectMode, StartupError> {
    match raw {
        "local" => Ok(ConnectMode::Local),
        "internal" => Ok(ConnectMode::Internal),
        "remote" => Ok(ConnectMode::Remote),
        _ => Err(StartupError::Config(
            "ENGINE_CONNECT_MODE must be one of: local, internal, remote".into(),
        )),
    }
}

fn parse_hmac_keys(raw: &str) -> Result<HashMap<String, String>, StartupError> {
    let keys: HashMap<String, String> = serde_json::from_str(raw).map_err(|_| {
        StartupError::Config(
            r#"ENGINE_HMAC_KEYS_JSON must be a JSON object: {"key_id":"secret"}"#.into(),
        )
    })?;

    if keys.is_empty() {
        return Err(StartupError::Config(
            "ENGINE_HMAC_KEYS_JSON must include at least one key".into(),
        ));
    }

    if keys
        .iter()
        .any(|(key, secret)| key.trim().is_empty() || secret.trim().is_empty())
    {
        return Err(StartupError::Config(
            "ENGINE_HMAC_KEYS_JSON keys and secrets must be non-empty".into(),
        ));
    }

    Ok(keys)
}

fn is_loopback(host: &str) -> bool {
    if host == "localhost" {
        return true;
    }

    host.parse::<IpAddr>().is_ok_and(|addr| addr.is_loopback())
}

#[cfg(test)]
mod tests {
    use super::{ConnectMode, EngineConfig};
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();

        LOCK.get_or_init(|| Mutex::new(()))
    }

    fn set_env(name: &str, value: &str) {
        unsafe {
            std::env::set_var(name, value);
        }
    }

    fn remove_env(name: &str) {
        unsafe {
            std::env::remove_var(name);
        }
    }

    fn set_base_env() {
        set_env("ENGINE_HMAC_KEYS_JSON", r#"{"web":"secret"}"#);

        for name in [
            "ENGINE_CONTACTS_DB_PATH",
            "ENGINE_LEADS_DB_PATH",
            "ENGINE_CONNECT_MODE",
            "ENGINE_HOST",
            "ENGINE_PORT",
            "ENGINE_HMAC_MAX_SKEW_SECS",
            "ENGINE_RATE_LIMIT_PER_KEY",
            "ENGINE_MAX_LIMIT",
            "ENGINE_INGEST_ENABLED",
            "ENGINE_INGEST_JOB_DB_PATH",
            "ENGINE_INGEST_WORKERS",
            "ENGINE_INGEST_BATCH_SIZE",
            "ENGINE_INGEST_MAX_UPLOAD_BYTES",
            "ENGINE_INGEST_MAX_ROWS",
            "ENGINE_INGEST_MAX_QUEUED_UPLOADS",
        ] {
            remove_env(name);
        }
    }

    #[test]
    fn explicit_db_paths_override_defaults() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_CONTACTS_DB_PATH", "/tmp/override-contacts.sqlite");
        set_env("ENGINE_LEADS_DB_PATH", "/tmp/override-leads.sqlite");

        let cfg = EngineConfig::load().expect("config");

        assert_eq!(cfg.contacts_db_path, "/tmp/override-contacts.sqlite");
        assert_eq!(cfg.leads_db_path, "/tmp/override-leads.sqlite");
    }

    #[test]
    fn local_mode_is_the_default_and_binds_loopback_port_3001() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();

        let cfg = EngineConfig::load().expect("config");

        assert_eq!(cfg.connect_mode, ConnectMode::Local);
        assert_eq!(cfg.host, "127.0.0.1");
        assert_eq!(cfg.port, 3001);
    }

    #[test]
    fn local_mode_rejects_public_bind_host() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_HOST", "0.0.0.0");

        let err = EngineConfig::load().expect_err("should fail");

        assert_eq!(
            err.to_string(),
            "configuration error: ENGINE_HOST must bind to loopback in local mode"
        );
    }

    #[test]
    fn remote_mode_allows_non_loopback_host() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_CONNECT_MODE", "remote");
        set_env("ENGINE_HOST", "0.0.0.0");

        let cfg = EngineConfig::load().expect("config");

        assert_eq!(cfg.connect_mode, ConnectMode::Remote);
        assert_eq!(cfg.host, "0.0.0.0");
    }

    #[test]
    fn internal_mode_allows_non_loopback_host() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_CONNECT_MODE", "internal");
        set_env("ENGINE_HOST", "0.0.0.0");

        let cfg = EngineConfig::load().expect("config");

        assert_eq!(cfg.connect_mode, ConnectMode::Internal);
        assert_eq!(cfg.host, "0.0.0.0");
    }

    #[test]
    fn invalid_connect_mode_is_rejected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_CONNECT_MODE", "invalid");

        let err = EngineConfig::load().expect_err("should fail");

        assert_eq!(
            err.to_string(),
            "configuration error: ENGINE_CONNECT_MODE must be one of: local, internal, remote"
        );
    }

    #[test]
    fn empty_hmac_keys_object_is_rejected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_HMAC_KEYS_JSON", "{}");

        let err = EngineConfig::load().expect_err("should fail");

        assert!(err.to_string().contains("at least one key"));
    }

    #[test]
    fn malformed_hmac_keys_json_is_rejected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_HMAC_KEYS_JSON", "not-json");

        let err = EngineConfig::load().expect_err("should fail");

        assert!(err.to_string().contains("JSON object"));
    }

    #[test]
    fn hmac_key_with_empty_secret_is_rejected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_HMAC_KEYS_JSON", r#"{"web":""}"#);

        let err = EngineConfig::load().expect_err("should fail");

        assert!(err.to_string().contains("non-empty"));
    }

    #[test]
    fn non_numeric_port_is_rejected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_PORT", "abc");

        let err = EngineConfig::load().expect_err("should fail");

        assert!(err.to_string().contains("ENGINE_PORT"));
    }

    #[test]
    fn custom_port_is_respected() {
        let _guard = env_lock().lock().unwrap();
        set_base_env();
        set_env("ENGINE_PORT", "8080");

        let cfg = EngineConfig::load().expect("config");

        assert_eq!(cfg.port, 8080);
    }
}
