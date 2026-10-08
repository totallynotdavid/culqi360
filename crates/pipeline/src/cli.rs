use crate::PipelineError;
use crate::config::paths::{default_pipeline_config, default_source_manifest};
use std::collections::HashMap;

/// Every command that reads raw files accepts `--raw-dir`, which replaces the
/// raw directory the config or the default names.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Command {
    VerifyManifest {
        manifest: String,
        raw_dir: Option<String>,
        allow_missing_optional: bool,
    },
    Validate {
        config: String,
        raw_dir: Option<String>,
        profile: String,
        allow_missing_optional: bool,
    },
    Bench {
        config: String,
        raw_dir: Option<String>,
        profile: String,
    },
    BenchMap {
        config: String,
        raw_dir: Option<String>,
        profile: String,
    },
    Build {
        config: String,
        raw_dir: Option<String>,
        profile: String,
    },
    Promote {
        config: String,
        from: Option<String>,
        to: Option<String>,
    },
    Refresh {
        config: String,
        raw_dir: Option<String>,
        slice: String,
        to: Option<String>,
    },
}

pub fn parse_args(args: &[String]) -> Result<Command, PipelineError> {
    if args.is_empty() {
        return Err(PipelineError::Args("missing command".to_owned()));
    }

    let cmd = args[0].as_str();
    let flags = parse_flags(&args[1..])?;
    let config = || {
        flags
            .get("--config")
            .cloned()
            .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string())
    };
    let profile = |default: &str| {
        flags
            .get("--profile")
            .cloned()
            .unwrap_or_else(|| default.to_owned())
    };
    let raw_dir = flags.get("--raw-dir").cloned();

    match cmd {
        "verify-manifest" => Ok(Command::VerifyManifest {
            manifest: flags
                .get("--manifest")
                .cloned()
                .unwrap_or_else(|| default_source_manifest().to_string_lossy().to_string()),
            raw_dir,
            allow_missing_optional: flags.contains_key("--allow-missing-optional"),
        }),
        "validate" => Ok(Command::Validate {
            config: config(),
            raw_dir,
            profile: profile("quick"),
            allow_missing_optional: flags.contains_key("--allow-missing-optional"),
        }),
        "bench" => Ok(Command::Bench {
            config: config(),
            raw_dir,
            profile: profile("standard"),
        }),
        "bench-map" => Ok(Command::BenchMap {
            config: config(),
            raw_dir,
            profile: profile("standard"),
        }),
        "build" => Ok(Command::Build {
            config: config(),
            raw_dir,
            profile: profile("full"),
        }),
        "promote" => Ok(Command::Promote {
            config: config(),
            from: flags.get("--from").cloned(),
            to: flags.get("--to").cloned(),
        }),
        "refresh" => Ok(Command::Refresh {
            config: config(),
            raw_dir,
            slice: flags
                .get("--slice")
                .cloned()
                .unwrap_or_else(|| "100k".to_owned()),
            to: flags.get("--to").cloned(),
        }),
        _ => Err(PipelineError::Args(format!("unknown command: {cmd}"))),
    }
}

fn parse_flags(args: &[String]) -> Result<HashMap<String, String>, PipelineError> {
    let mut out = HashMap::new();
    let mut i = 0usize;
    while i < args.len() {
        let key = args[i].clone();
        if !key.starts_with("--") {
            return Err(PipelineError::Args(format!(
                "expected flag starting with --, got: {key}"
            )));
        }
        if key == "--allow-missing-optional" {
            out.insert(key, String::new());
            i += 1;
            continue;
        }
        let Some(value) = args.get(i + 1) else {
            return Err(PipelineError::Args(format!(
                "missing value for flag: {key}"
            )));
        };
        out.insert(key, value.clone());
        i += 2;
    }
    Ok(out)
}
