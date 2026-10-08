use crate::PipelineError;
use crate::config::mapping::SourceMapping;
use serde::Serialize;
use std::fs;
use std::path::Path;

/// Where a manifest file lives and the directory its raw files are read from.
/// The manifest names raw files only, so the same manifest serves a checkout,
/// the synthetic fixture and a host that keeps its snapshots elsewhere.
#[derive(Debug, Clone, Copy)]
pub struct ManifestLocation<'a> {
    pub path: &'a str,
    pub raw_dir: &'a str,
}

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
    /// The manifest holds a file name. `load_manifest` replaces it with the
    /// path inside the raw directory.
    #[serde(rename = "raw_file")]
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
pub struct ManifestCheckResult {
    source_key: String,
    enabled: bool,
    raw_optional: bool,
    reliability_rank: Option<i64>,
    raw_exists: bool,
    mapping_exists: bool,
}

pub struct ManifestReport {
    pub manifest: SourceManifest,
    pub checks: Vec<ManifestCheckResult>,
}

pub fn load_manifest(location: ManifestLocation<'_>) -> Result<SourceManifest, PipelineError> {
    let raw = fs::read_to_string(location.path)?;
    let mut manifest: SourceManifest = serde_json::from_str(&raw)?;

    for source in &mut manifest.sources {
        source.raw_path = Path::new(location.raw_dir)
            .join(&source.raw_path)
            .to_string_lossy()
            .into_owned();
    }

    Ok(manifest)
}

pub fn verify_manifest(location: ManifestLocation<'_>) -> Result<SourceManifest, PipelineError> {
    verify_manifest_with_policy(location, ManifestInputPolicy::RequireRawInputs)
}

pub fn verify_manifest_with_policy(
    location: ManifestLocation<'_>,
    input_policy: ManifestInputPolicy,
) -> Result<SourceManifest, PipelineError> {
    Ok(check_manifest(location, input_policy)?.manifest)
}

/// Verifies the manifest and returns the per-source results without printing
/// them. Printing belongs to the `verify-manifest` command alone, because the
/// run and validation commands verify the manifest as a step.
pub fn check_manifest(
    location: ManifestLocation<'_>,
    input_policy: ManifestInputPolicy,
) -> Result<ManifestReport, PipelineError> {
    let manifest = load_manifest(location)?;

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

    Ok(ManifestReport { manifest, checks })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use tempfile::tempdir;

    struct TestManifest {
        manifest_path: String,
        raw_dir: String,
    }

    impl TestManifest {
        fn location(&self) -> ManifestLocation<'_> {
            ManifestLocation {
                path: &self.manifest_path,
                raw_dir: &self.raw_dir,
            }
        }
    }

    fn write_manifest(directory: &Path, source_key: &str, raw_optional: bool) -> TestManifest {
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
                    "raw_file": "missing.csv",
                    "mapping_path": mapping_path,
                    "enabled": true,
                    "raw_optional": raw_optional
                }]
            }))
            .expect("manifest JSON"),
        )
        .expect("manifest file");

        TestManifest {
            manifest_path: manifest_path.to_string_lossy().into_owned(),
            raw_dir: directory.to_string_lossy().into_owned(),
        }
    }

    #[test]
    fn checkout_policy_allows_an_absent_raw_file_for_an_optional_source() {
        let directory = tempdir().expect("temporary directory");
        let manifest = write_manifest(directory.path(), "optional", true);

        let manifest = verify_manifest_with_policy(
            manifest.location(),
            ManifestInputPolicy::AllowMissingOptionalRawInputs,
        )
        .expect("optional raw input should not block verification");

        assert!(!manifest.sources[0].has_raw_input());
    }

    #[test]
    fn production_policy_rejects_an_absent_raw_file_for_an_optional_source() {
        let directory = tempdir().expect("temporary directory");
        let manifest = write_manifest(directory.path(), "optional", true);

        let error = verify_manifest(manifest.location())
            .expect_err("production raw input should block verification");

        assert!(error.to_string().contains("raw_exists=false"));
    }

    #[test]
    fn rejects_an_absent_raw_file_for_a_required_source_in_checkout_policy() {
        let directory = tempdir().expect("temporary directory");
        let manifest = write_manifest(directory.path(), "required", false);

        let error = verify_manifest_with_policy(
            manifest.location(),
            ManifestInputPolicy::AllowMissingOptionalRawInputs,
        )
        .expect_err("required raw input should block verification");

        assert!(error.to_string().contains("raw_exists=false"));
    }

    #[test]
    fn resolves_raw_files_against_the_raw_directory() {
        let directory = tempdir().expect("temporary directory");
        let manifest = write_manifest(directory.path(), "optional", true);
        let other_raw_dir = directory.path().join("elsewhere");
        let other_raw_dir = other_raw_dir.to_string_lossy().into_owned();

        let loaded = load_manifest(ManifestLocation {
            path: &manifest.manifest_path,
            raw_dir: &other_raw_dir,
        })
        .expect("load manifest");

        assert_eq!(
            Path::new(&loaded.sources[0].raw_path),
            Path::new(&other_raw_dir).join("missing.csv")
        );
    }
}
