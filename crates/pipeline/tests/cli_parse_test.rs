use pipeline::cli::{Command, parse_args};

#[test]
fn parses_bench_with_default_profile() {
    let args = vec!["bench".to_owned()];
    let command = parse_args(&args).expect("parse should succeed");
    match command {
        Command::Bench {
            config,
            raw_dir,
            profile,
        } => {
            assert!(config.ends_with("pipeline.toml"));
            assert!(raw_dir.is_none());
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
        Command::Refresh {
            config,
            raw_dir,
            slice,
            to,
        } => {
            assert!(config.ends_with("pipeline.toml"));
            assert!(raw_dir.is_none());
            assert_eq!(slice, "100k");
            assert!(to.is_none());
        }
        _ => panic!("expected refresh command"),
    }
}

#[test]
fn parses_the_raw_directory_override() {
    let args = vec![
        "refresh".to_owned(),
        "--raw-dir".to_owned(),
        "/srv/crm/raw".to_owned(),
    ];
    let command = parse_args(&args).expect("parse should succeed");

    match command {
        Command::Refresh { raw_dir, .. } => assert_eq!(raw_dir.as_deref(), Some("/srv/crm/raw")),
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
