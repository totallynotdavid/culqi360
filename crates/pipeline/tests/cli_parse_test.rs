use pipeline::cli::{Command, parse_args};

#[test]
fn parses_bench_with_default_profile() {
    let args = vec!["bench".to_owned()];
    let command = parse_args(&args).expect("parse should succeed");
    match command {
        Command::Bench { config, profile } => {
            assert!(config.ends_with("pipeline.toml"));
            assert_eq!(profile, "standard");
        }
        _ => panic!("expected bench command"),
    }
}

#[test]
fn parses_refresh_with_default_slice() {
    let args = vec!["refresh".to_owned()];
    let command = parse_args(&args).expect("parse should succeed");
    match command {
        Command::Refresh { config, slice, to } => {
            assert!(config.ends_with("pipeline.toml"));
            assert_eq!(slice, "100k");
            assert!(to.is_none());
        }
        _ => panic!("expected refresh command"),
    }
}

#[test]
fn parses_checkout_manifest_policy_flag() {
    let args = vec![
        "verify-manifest".to_owned(),
        "--allow-missing-optional".to_owned(),
    ];
    let command = parse_args(&args).expect("parse should succeed");

    match command {
        Command::VerifyManifest {
            allow_missing_optional,
            ..
        } => assert!(allow_missing_optional),
        _ => panic!("expected verify-manifest command"),
    }
}
