use crate::PipelineError;
use crate::cli::Command;
use crate::config::manifest::{ManifestInputPolicy, ManifestLocation, check_manifest};
use crate::config::paths::default_raw_dir;
use crate::config::runtime::{PipelineRuntimeConfig, ProfileMode};
use crate::contract_guard::{
    validate_contracts, validate_contracts_for_checkout, validate_contracts_with_policy,
};
use crate::gate;
use crate::promote;
use crate::report;
use crate::run;
use crate::storage::db::open_rw;
use rusqlite::params;
use std::path::Path;
use std::time::SystemTime;

pub fn run(command: Command) -> Result<(), PipelineError> {
    match command {
        Command::VerifyManifest {
            manifest,
            raw_dir,
            allow_missing_optional,
        } => {
            let raw_dir =
                raw_dir.unwrap_or_else(|| default_raw_dir().to_string_lossy().to_string());
            let location = ManifestLocation {
                path: &manifest,
                raw_dir: &raw_dir,
            };
            let input_policy = if allow_missing_optional {
                ManifestInputPolicy::AllowMissingOptionalRawInputs
            } else {
                ManifestInputPolicy::RequireRawInputs
            };
            let report = check_manifest(location, input_policy)?;
            println!("{}", serde_json::to_string(&report.checks)?);
            validate_contracts_with_policy(location, input_policy)
        }
        Command::Validate {
            config,
            raw_dir,
            profile,
            allow_missing_optional,
        } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, raw_dir)?;
            let manifest = runtime.paths.manifest_location();
            if allow_missing_optional {
                validate_contracts_for_checkout(manifest)?;
            } else {
                validate_contracts(manifest)?;
            }
            let resolved = runtime.resolve_profile(&profile)?;
            if allow_missing_optional {
                report::normalize_matrix_for_checkout(
                    manifest,
                    resolved.row_cap,
                    &runtime.paths.normalized_dir,
                )
            } else {
                report::normalize_matrix(manifest, resolved.row_cap, &runtime.paths.normalized_dir)
            }
        }
        Command::Bench {
            config,
            raw_dir,
            profile,
        } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, raw_dir)?;
            validate_contracts(runtime.paths.manifest_location())?;
            let resolved = runtime.resolve_profile(&profile)?;
            let bench_db =
                Path::new(&runtime.paths.bench_dir).join(format!("bench-{}.sqlite", profile));
            let bench_build_dir =
                Path::new(&runtime.paths.bench_dir).join(format!("bench-{}", profile));

            run::matrix::run(run::matrix::Config {
                db_path: &bench_db.to_string_lossy(),
                build_dir: &bench_build_dir.to_string_lossy(),
                manifest: runtime.paths.manifest_location(),
                workers: resolved.workers,
                row_cap: resolved.row_cap,
                run_osiptel_sample: resolved.include_osiptel,
                batch_size: resolved.batch_size,
                source_row_caps: &resolved.source_row_caps,
            })
        }
        Command::BenchMap {
            config,
            raw_dir,
            profile,
        } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, raw_dir)?;
            validate_contracts(runtime.paths.manifest_location())?;
            let resolved = runtime.resolve_profile(&profile)?;
            let bench_build_dir =
                Path::new(&runtime.paths.bench_dir).join(format!("bench-map-{}", profile));

            run::matrix::map_only(
                &bench_build_dir.to_string_lossy(),
                runtime.paths.manifest_location(),
                resolved.row_cap,
                resolved.include_osiptel,
                &resolved.source_row_caps,
            )
        }
        Command::Build {
            config,
            raw_dir,
            profile,
        } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, raw_dir)?;
            validate_contracts(runtime.paths.manifest_location())?;
            let resolved = runtime.resolve_profile(&profile)?;

            if resolved.mode != ProfileMode::Full {
                return Err(PipelineError::Args(format!(
                    "build requires a full-mode profile, got '{profile}'"
                )));
            }

            run::full::run(
                &runtime.paths.staged_db,
                runtime.paths.manifest_location(),
                resolved.workers,
                resolved.include_osiptel,
                resolved.batch_size,
            )
        }
        Command::Promote { config, from, to } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, None)?;
            let from = from.unwrap_or(runtime.paths.staged_db);
            let to = to.unwrap_or(runtime.paths.engine_db);
            publish_with_gate_and_metadata(&from, &to)
        }
        Command::Refresh {
            config,
            raw_dir,
            slice,
            to,
        } => {
            let runtime = PipelineRuntimeConfig::from_path(&config, raw_dir)?;
            validate_contracts(runtime.paths.manifest_location())?;
            let profile = profile_for_slice(&slice)?;
            let resolved = runtime.resolve_profile(profile)?;

            if resolved.mode != ProfileMode::Sample {
                return Err(PipelineError::Args(format!(
                    "refresh requires a sample-mode profile, got '{profile}'"
                )));
            }

            let refresh_db =
                Path::new(&runtime.paths.bench_dir).join(format!("refresh-{}.sqlite", profile));
            let refresh_build_dir =
                Path::new(&runtime.paths.bench_dir).join(format!("refresh-{}", profile));

            run::matrix::run(run::matrix::Config {
                db_path: &refresh_db.to_string_lossy(),
                build_dir: &refresh_build_dir.to_string_lossy(),
                manifest: runtime.paths.manifest_location(),
                workers: resolved.workers,
                row_cap: resolved.row_cap,
                run_osiptel_sample: resolved.include_osiptel,
                batch_size: resolved.batch_size,
                source_row_caps: &resolved.source_row_caps,
            })?;

            let to = to.unwrap_or(runtime.paths.engine_db);
            publish_with_gate_and_metadata(&refresh_db.to_string_lossy(), &to)
        }
    }
}

fn profile_for_slice(slice: &str) -> Result<&'static str, PipelineError> {
    match slice {
        "10k" => Ok("quick"),
        "100k" => Ok("standard"),
        "100k-osiptel" => Ok("heavy"),
        _ => Err(PipelineError::Args(format!(
            "unsupported slice '{slice}' (supported: 10k, 100k, 100k-osiptel)"
        ))),
    }
}

fn publish_with_gate_and_metadata(from: &str, to: &str) -> Result<(), PipelineError> {
    if !Path::new(from).exists() {
        return Err(PipelineError::Args(format!(
            "source db does not exist: {from}"
        )));
    }

    let gate_result = gate::run_gate(from)?;
    let gate_passed = gate_result.passed;
    println!(
        "[pipeline] gate passed={} checks={}",
        gate_passed,
        gate_result.checks.len()
    );
    for check in &gate_result.checks {
        if !check.passed {
            eprintln!(
                "[pipeline] gate FAIL check={} actual={:.4} threshold={:.4} {}",
                check.name, check.actual, check.threshold, check.message
            );
        }
    }
    {
        let conn = open_rw(from)?;
        let now_duration = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(|error| {
                PipelineError::Args(format!("system time error during promote: {error}"))
            })?;
        let now_millis = now_duration.as_millis() as i64;
        let now_nanos = now_duration.as_nanos();
        let build_id = format!("build-{now_nanos}");
        let rows: i64 = conn.query_row("SELECT COUNT(*) FROM doc_projection", params![], |r| {
            r.get(0)
        })?;
        println!(
            "[pipeline] build metadata: build_id={} gate_passed={} built_at={} rows={}",
            build_id, gate_passed, now_millis, rows
        );

        if !gate_passed {
            return Err(PipelineError::Args(format!(
                "quality gate failed for build_id={build_id} — inspect gate failures above"
            )));
        }

        conn.execute(
            "INSERT OR REPLACE INTO _pipeline_build(key, value) VALUES (?1, ?2)",
            params!["build_id", build_id],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO _pipeline_build(key, value) VALUES (?1, ?2)",
            params!["built_at", now_millis.to_string()],
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO _pipeline_build(key, value) VALUES (?1, ?2)",
            params!["rows", rows.to_string()],
        )?;
    }

    promote::promote_db(from, to)
}
