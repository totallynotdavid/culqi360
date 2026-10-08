use crate::PipelineError;
use crate::config::manifest::ManifestLocation;
use crate::ingest::map_snapshot_only;
use crate::sample::sample_with_header;
use crate::storage::schema::init_schema;
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::Instant;

use super::context::{PhaseTiming, RunContext, SourceCheckpoint};
use super::phase::{
    IngestPhaseConfig, mark_snapshots_materialized, materialize_and_quick_check,
    push_ingest_timings, run_ingest_phase,
};
use super::sources::load_enabled_sources;

pub struct Config<'a> {
    pub db_path: &'a str,
    pub build_dir: &'a str,
    pub manifest: ManifestLocation<'a>,
    pub workers: usize,
    pub row_cap: usize,
    pub run_osiptel_sample: bool,
    pub batch_size: usize,
    pub source_row_caps: &'a HashMap<String, usize>,
}

pub fn run(config: Config<'_>) -> Result<(), PipelineError> {
    let Config {
        db_path,
        build_dir,
        manifest,
        workers,
        row_cap,
        run_osiptel_sample,
        batch_size,
        source_row_caps,
    } = config;

    let run_started_at = Instant::now();
    let mut timings = Vec::new();
    let mut checkpoints = Vec::new();

    let run_ctx = RunContext::new(db_path)?;
    run_ctx.write_metadata(db_path, manifest.path, "sample", workers, batch_size)?;

    let build_dir_path = Path::new(build_dir);
    fs::create_dir_all(build_dir_path)?;
    if Path::new(db_path).exists() {
        fs::remove_file(db_path)?;
    }

    println!("[pipeline] init schema");
    init_schema(db_path)?;

    let mut sources = Vec::new();
    for source in load_enabled_sources(manifest)? {
        if source.source_key == "osiptel" && !run_osiptel_sample {
            continue;
        }
        let sample_cap = source_row_caps
            .get(&source.source_key)
            .copied()
            .unwrap_or(row_cap);
        let sample_file = build_dir_path.join(format!("{}.sample.csv", source.source_key));
        sources.push((source, sample_cap, sample_file));
    }

    let extract_durations = sample_sources(&sources)?;

    for (source, _sample_cap, sample_file) in sources {
        timings.push(PhaseTiming {
            phase: "extract".to_owned(),
            key: source.source_key.clone(),
            seconds: extract_durations
                .get(&source.source_key)
                .copied()
                .unwrap_or(0.0),
        });

        let snapshot_label = format!("{}-sample", source.source_key);
        let ingest_stats = run_ingest_phase(&IngestPhaseConfig {
            db_path,
            run_id: &run_ctx.run_id,
            mapping_path: Path::new(&source.mapping_path),
            input_path: &sample_file,
            snapshot_label: &snapshot_label,
            snapshot_date: &source.snapshot_date,
            batch_size,
            workers,
            source_key: Some(&source.source_key),
        })?;
        push_ingest_timings(&mut timings, &source.source_key, &ingest_stats);
        checkpoints.push(SourceCheckpoint {
            source_key: source.source_key.clone(),
            snapshot_label,
            status: "completed".to_owned(),
        });
        run_ctx.write_checkpoints(&checkpoints)?;
    }

    finish_sample_run(db_path, &run_ctx, &mut timings, run_started_at)
}

pub fn map_only(
    build_dir: &str,
    manifest: ManifestLocation<'_>,
    row_cap: usize,
    run_osiptel_sample: bool,
    source_row_caps: &HashMap<String, usize>,
) -> Result<(), PipelineError> {
    let run_started_at = Instant::now();
    let mut map_total_secs = 0.0f64;
    let mut mapped_rows_total = 0usize;
    let build_dir_path = Path::new(build_dir);
    fs::create_dir_all(build_dir_path)?;

    for source in load_enabled_sources(manifest)? {
        if source.source_key == "osiptel" && !run_osiptel_sample {
            continue;
        }

        let sample_cap = source_row_caps
            .get(&source.source_key)
            .copied()
            .unwrap_or(row_cap);
        let sample_file = build_dir_path.join(format!("{}.sample.csv", source.source_key));

        println!(
            "[pipeline] prepare sample for {} from {}",
            source.source_key, source.raw_path
        );
        sample_with_header(source.raw_path.into(), sample_file.clone(), sample_cap)?;

        let map_started_at = Instant::now();
        let mapped_rows = map_snapshot_only(&source.mapping_path, &sample_file.to_string_lossy())?;
        let map_secs = map_started_at.elapsed().as_secs_f64();
        map_total_secs += map_secs;
        mapped_rows_total += mapped_rows;

        println!(
            "[pipeline] map_only_timing source_key={} rows={} seconds={map_secs:.3}",
            source.source_key, mapped_rows
        );
    }

    let total_secs = run_started_at.elapsed().as_secs_f64();
    let rows_per_sec = if map_total_secs > 0.0 {
        mapped_rows_total as f64 / map_total_secs
    } else {
        0.0
    };
    println!(
        "[pipeline] run_timing mode=map-only map_secs={map_total_secs:.3} total_secs={total_secs:.3} rows={} rows_per_sec={rows_per_sec:.0}",
        mapped_rows_total
    );
    Ok(())
}

fn sample_sources(
    sources: &[(crate::config::manifest::SourceManifestEntry, usize, PathBuf)],
) -> Result<HashMap<String, f64>, PipelineError> {
    let mut extract_durations = HashMap::new();
    thread::scope(|scope| -> Result<(), PipelineError> {
        let mut handles = Vec::with_capacity(sources.len());
        for (source, sample_cap, sample_file) in sources {
            println!(
                "[pipeline] prepare sample for {} from {}",
                source.source_key, source.raw_path
            );
            let source_key = source.source_key.clone();
            let src = PathBuf::from(&source.raw_path);
            let out = sample_file.clone();
            let cap = *sample_cap;
            handles.push(scope.spawn(move || -> Result<(String, f64), String> {
                let extract_started = Instant::now();
                sample_with_header(src, out, cap).map_err(|err| err.to_string())?;
                Ok((source_key, extract_started.elapsed().as_secs_f64()))
            }));
        }

        for handle in handles {
            let outcome = handle
                .join()
                .map_err(|_| PipelineError::Args("extract worker panicked".to_owned()))?;
            let (source_key, seconds) = outcome.map_err(PipelineError::Args)?;
            extract_durations.insert(source_key, seconds);
        }
        Ok(())
    })?;
    Ok(extract_durations)
}

fn finish_sample_run(
    db_path: &str,
    run_ctx: &RunContext,
    timings: &mut Vec<PhaseTiming>,
    run_started_at: Instant,
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
        "[pipeline] run_timing mode=sample materialize_secs={materialize_secs:.3} total_secs={total_secs:.3}",
    );
    Ok(())
}
