use crate::PipelineError;
use crate::config::manifest::ManifestLocation;
use crate::storage::schema::init_schema;
use std::fs;
use std::path::Path;
use std::time::Instant;

use super::context::{PhaseTiming, RunContext, SourceCheckpoint};
use super::phase::{
    IngestPhaseConfig, mark_snapshots_materialized, materialize_and_quick_check,
    push_ingest_timings, run_ingest_phase,
};
use super::sources::load_enabled_sources;

pub fn run(
    db_path: &str,
    manifest: ManifestLocation<'_>,
    workers: usize,
    include_osiptel: bool,
    batch_size: usize,
) -> Result<(), PipelineError> {
    let run_started_at = Instant::now();
    let mut timings = Vec::new();
    let mut checkpoints = Vec::new();

    let run_ctx = RunContext::new(db_path)?;
    run_ctx.write_metadata(db_path, manifest.path, "full", workers, batch_size)?;

    if Path::new(db_path).exists() {
        fs::remove_file(db_path)?;
    }

    println!("[pipeline] init schema");
    init_schema(db_path)?;

    for source in load_enabled_sources(manifest)? {
        if source.source_key == "osiptel" && !include_osiptel {
            continue;
        }

        let ingest_stats = run_ingest_phase(&IngestPhaseConfig {
            db_path,
            run_id: &run_ctx.run_id,
            mapping_path: Path::new(&source.mapping_path),
            input_path: Path::new(&source.raw_path),
            snapshot_label: &source.snapshot_label,
            snapshot_date: &source.snapshot_date,
            batch_size,
            workers,
            source_key: Some(&source.source_key),
        })?;
        push_ingest_timings(&mut timings, &source.source_key, &ingest_stats);
        checkpoints.push(SourceCheckpoint {
            source_key: source.source_key,
            snapshot_label: source.snapshot_label,
            status: "completed".to_owned(),
        });
        run_ctx.write_checkpoints(&checkpoints)?;
    }

    finish_run(db_path, &run_ctx, &mut timings, run_started_at, "full")
}

fn finish_run(
    db_path: &str,
    run_ctx: &RunContext,
    timings: &mut Vec<PhaseTiming>,
    run_started_at: Instant,
    mode: &str,
) -> Result<(), PipelineError> {
    let materialize_started_at = Instant::now();
    materialize_and_quick_check(db_path)?;
    mark_snapshots_materialized(db_path)?;
    let materialize_secs = materialize_started_at.elapsed().as_secs_f64();
    timings.push(PhaseTiming {
        phase: "materialize".to_owned(),
        key: "serving".to_owned(),
        seconds: materialize_secs,
    });

    let total_secs = run_started_at.elapsed().as_secs_f64();
    timings.push(PhaseTiming {
        phase: "total".to_owned(),
        key: "pipeline".to_owned(),
        seconds: total_secs,
    });
    run_ctx.write_timings(timings)?;

    println!(
        "[pipeline] run_timing mode={mode} materialize_secs={materialize_secs:.3} total_secs={total_secs:.3}",
    );
    Ok(())
}
