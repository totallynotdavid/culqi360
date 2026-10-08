use crate::PipelineError;
use crate::config::manifest::ManifestLocation;
use serde::Deserialize;
use std::collections::HashMap;
use std::fs;

#[derive(Debug, Deserialize)]
pub struct PipelineRuntimeConfig {
    pub paths: RuntimePaths,
    pub profiles: HashMap<String, RuntimeProfile>,
}

#[derive(Debug, Deserialize)]
pub struct RuntimePaths {
    pub manifest: String,
    pub raw_dir: String,
    pub normalized_dir: String,
    pub staged_db: String,
    pub bench_dir: String,
    pub engine_db: String,
}

impl RuntimePaths {
    pub fn manifest_location(&self) -> ManifestLocation<'_> {
        ManifestLocation {
            path: &self.manifest,
            raw_dir: &self.raw_dir,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct RuntimeProfile {
    pub mode: String,
    #[serde(default)]
    pub workers: Option<usize>,
    #[serde(default)]
    pub row_cap: Option<usize>,
    #[serde(default)]
    pub batch_size: Option<usize>,
    #[serde(default)]
    pub include_osiptel: bool,
    #[serde(default)]
    pub source_row_caps: HashMap<String, usize>,
}

#[derive(Debug)]
pub struct ResolvedProfile {
    pub mode: ProfileMode,
    pub workers: usize,
    pub row_cap: usize,
    pub batch_size: usize,
    pub include_osiptel: bool,
    pub source_row_caps: HashMap<String, usize>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProfileMode {
    Sample,
    Full,
}

impl PipelineRuntimeConfig {
    /// Reads the config. A `raw_dir` argument replaces `paths.raw_dir`, for a
    /// host that keeps its raw snapshots outside the checkout.
    pub fn from_path(path: &str, raw_dir: Option<String>) -> Result<Self, PipelineError> {
        let raw = fs::read_to_string(path)?;
        let mut config = toml::from_str::<Self>(&raw)
            .map_err(|err| PipelineError::Args(format!("invalid pipeline config: {err}")))?;
        if let Some(raw_dir) = raw_dir {
            config.paths.raw_dir = raw_dir;
        }
        Ok(config)
    }

    pub fn resolve_profile(&self, profile_name: &str) -> Result<ResolvedProfile, PipelineError> {
        let Some(profile) = self.profiles.get(profile_name) else {
            return Err(PipelineError::Args(format!(
                "profile not found in pipeline config: {profile_name}"
            )));
        };

        let mode = match profile.mode.as_str() {
            "sample" => ProfileMode::Sample,
            "full" => ProfileMode::Full,
            other => {
                return Err(PipelineError::Args(format!(
                    "unsupported profile mode '{other}' for profile '{profile_name}'"
                )));
            }
        };

        Ok(ResolvedProfile {
            mode,
            workers: profile.workers.unwrap_or(4).clamp(1, 64),
            row_cap: profile.row_cap.unwrap_or(10_000),
            batch_size: profile.batch_size.unwrap_or(50_000),
            include_osiptel: profile.include_osiptel,
            source_row_caps: profile.source_row_caps.clone(),
        })
    }
}
