use crate::PipelineError;
use crate::config::mapping::SourceMapping;
use serde::Serialize;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SourceManifest {
    pub version: u32,
    pub sources: Vec<SourceManifestEntry>,
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct SourceManifestEntry {
    pub source_key: String,
    pub snapshot_label: String,
    pub snapshot_date: String,
    pub raw_path: String,
    pub mapping_path: String,
    pub enabled: bool,
    #[serde(default)]
    pub raw_optional: bool,
}

impl SourceManifestEntry {
    pub fn has_raw_input(&self) -> bool {
        !self.raw_optional || Path::new(&self.raw_path).exists()
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ManifestInputPolicy {
    RequireRawInputs,
    AllowMissingOptionalRawInputs,
}

#[derive(Debug, Serialize)]
struct ManifestCheckResult {
    source_key: String,
    enabled: bool,
    raw_optional: bool,
    reliability_rank: Option<i64>,
    raw_exists: bool,
    mapping_exists: bool,
}

pub fn load_manifest(path: &str) -> Result<SourceManifest, PipelineError> {
    let raw = fs::read_to_string(path)?;
    let manifest = serde_json::from_str(&raw)?;

    Ok(manifest)
}

pub fn verify_manifest(manifest_path: &str) -> Result<SourceManifest, PipelineError> {
    verify_manifest_with_policy(manifest_path, ManifestInputPolicy::RequireRawInputs)
}

pub fn verify_manifest_for_checkout(manifest_path: &str) -> Result<SourceManifest, PipelineError> {
    verify_manifest_with_policy(
        manifest_path,
        ManifestInputPolicy::AllowMissingOptionalRawInputs,
    )
}

pub fn verify_manifest_with_policy(
    manifest_path: &str,
    input_policy: ManifestInputPolicy,
) -> Result<SourceManifest, PipelineError> {
    let manifest = load_manifest(manifest_path)?;

    if manifest.version != 1 {
        return Err(PipelineError::Args(format!(
            "unsupported manifest version: {}",
            manifest.version
        )));
    }

    let mut checks = Vec::with_capacity(manifest.sources.len());

    for source in &manifest.sources {
        let raw_exists = Path::new(&source.raw_path).exists();
        let mapping_exists = Path::new(&source.mapping_path).exists();

        let raw_missing = !raw_exists
            && (!source.raw_optional || input_policy == ManifestInputPolicy::RequireRawInputs);
        if source.enabled && (raw_missing || !mapping_exists) {
            return Err(PipelineError::Args(format!(
                "manifest validation failed for {}: raw_exists={}, mapping_exists={}",
                source.source_key, raw_exists, mapping_exists
            )));
        }

        let reliability_rank = if mapping_exists {
            let mapping = SourceMapping::from_path(&source.mapping_path)?;

            if mapping.source_key != source.source_key {
                return Err(PipelineError::Args(format!(
                    "source_key mismatch: manifest={} mapping={}",
                    source.source_key, mapping.source_key
                )));
            }

            Some(mapping.reliability_rank)
        } else {
            None
        };

        checks.push(ManifestCheckResult {
            source_key: source.source_key.clone(),
            enabled: source.enabled,
            raw_optional: source.raw_optional,
            reliability_rank,
            raw_exists,
            mapping_exists,
        });
    }

    println!("{}", serde_json::to_string(&checks)?);

    Ok(manifest)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    fn write_manifest(
        directory: &Path,
        source_key: &str,
        raw_optional: bool,
    ) -> std::path::PathBuf {
        let mapping_path = directory.join("mapping.json");
        fs::write(
            &mapping_path,
            serde_json::to_vec(&json!({
                "source_key": source_key,
                "source_name": source_key,
                "reliability_rank": 1,
                "delimiter": ","
            }))
            .expect("mapping JSON"),
        )
        .expect("mapping file");

        let manifest_path = directory.join("manifest.json");
        fs::write(
            &manifest_path,
            serde_json::to_vec(&json!({
                "version": 1,
                "sources": [{
                    "source_key": source_key,
                    "snapshot_label": "test",
                    "snapshot_date": "2026-01-01",
                    "raw_path": directory.join("missing.csv"),
                    "mapping_path": mapping_path,
                    "enabled": true,
                    "raw_optional": raw_optional
                }]
            }))
            .expect("manifest JSON"),
        )
        .expect("manifest file");

        manifest_path
    }

    #[test]
    fn checkout_policy_allows_an_absent_raw_file_for_an_optional_source() {
        let directory = tempdir().expect("temporary directory");
        let manifest_path = write_manifest(directory.path(), "optional", true);

        let manifest = verify_manifest_for_checkout(manifest_path.to_str().expect("manifest path"))
            .expect("optional raw input should not block verification");

        assert!(!manifest.sources[0].has_raw_input());
    }

    #[test]
    fn production_policy_rejects_an_absent_raw_file_for_an_optional_source() {
        let directory = tempdir().expect("temporary directory");
        let manifest_path = write_manifest(directory.path(), "optional", true);

        let error = verify_manifest(manifest_path.to_str().expect("manifest path"))
            .expect_err("production raw input should block verification");

        assert!(error.to_string().contains("raw_exists=false"));
    }

    #[test]
    fn rejects_an_absent_raw_file_for_a_required_source_in_checkout_policy() {
        let directory = tempdir().expect("temporary directory");
        let manifest_path = write_manifest(directory.path(), "required", false);

        let error = verify_manifest_for_checkout(manifest_path.to_str().expect("manifest path"))
            .expect_err("required raw input should block verification");

        assert!(error.to_string().contains("raw_exists=false"));
    }
}
