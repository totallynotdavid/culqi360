use crate::PipelineError;
use crate::config::paths::{default_pipeline_config, default_source_manifest};
use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Command {
    VerifyManifest {
        manifest: String,
        allow_missing_optional: bool,
    },
    Validate {
        config: String,
        profile: String,
        allow_missing_optional: bool,
    },
    Bench {
        config: String,
        profile: String,
    },
    BenchMap {
        config: String,
        profile: String,
    },
    Build {
        config: String,
        profile: String,
    },
    Promote {
        config: String,
        from: Option<String>,
        to: Option<String>,
    },
    Refresh {
        config: String,
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

    match cmd {
        "verify-manifest" => Ok(Command::VerifyManifest {
            manifest: flags
                .get("--manifest")
                .cloned()
                .unwrap_or_else(|| default_source_manifest().to_string_lossy().to_string()),
            allow_missing_optional: flags.contains_key("--allow-missing-optional"),
        }),
        "validate" => Ok(Command::Validate {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
            profile: flags
                .get("--profile")
                .cloned()
                .unwrap_or_else(|| "quick".to_owned()),
            allow_missing_optional: flags.contains_key("--allow-missing-optional"),
        }),
        "bench" => Ok(Command::Bench {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
            profile: flags
                .get("--profile")
                .cloned()
                .unwrap_or_else(|| "standard".to_owned()),
        }),
        "bench-map" => Ok(Command::BenchMap {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
            profile: flags
                .get("--profile")
                .cloned()
                .unwrap_or_else(|| "standard".to_owned()),
        }),
        "build" => Ok(Command::Build {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
            profile: flags
                .get("--profile")
                .cloned()
                .unwrap_or_else(|| "full".to_owned()),
        }),
        "promote" => Ok(Command::Promote {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
            from: flags.get("--from").cloned(),
            to: flags.get("--to").cloned(),
        }),
        "refresh" => Ok(Command::Refresh {
            config: flags
                .get("--config")
                .cloned()
                .unwrap_or_else(|| default_pipeline_config().to_string_lossy().to_string()),
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
