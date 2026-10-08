use crate::PipelineError;
use crate::config::manifest::{
    ManifestLocation, SourceManifest, SourceManifestEntry, verify_manifest,
};

pub(super) fn load_enabled_sources(
    manifest: ManifestLocation<'_>,
) -> Result<Vec<SourceManifestEntry>, PipelineError> {
    let SourceManifest { mut sources, .. } = verify_manifest(manifest)?;

    sources.retain(|source| source.enabled);

    // Process oldest snapshots first so last-write-wins fields favor newer data.
    sources.sort_by(|a, b| {
        a.snapshot_date
            .cmp(&b.snapshot_date)
            .then_with(|| a.source_key.cmp(&b.source_key))
    });

    Ok(sources)
}
