use std::path::Path;
use std::process::Command;

#[test]
fn verify_manifest_prints_the_source_report_once() {
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");

    let output = Command::new(env!("CARGO_BIN_EXE_pipeline"))
        .current_dir(repo_root)
        .args([
            "verify-manifest",
            "--raw-dir",
            "crates/pipeline/data/fixture/raw",
        ])
        .output()
        .expect("run pipeline binary");

    assert!(
        output.status.success(),
        "stderr: {}",
        String::from_utf8_lossy(&output.stderr)
    );

    let stdout = String::from_utf8(output.stdout).expect("utf-8 stdout");
    let lines: Vec<&str> = stdout.lines().collect();
    assert_eq!(lines.len(), 1, "stdout: {stdout}");

    let report: Vec<serde_json::Value> = serde_json::from_str(lines[0]).expect("JSON report");
    let enabled_without_raw: Vec<&serde_json::Value> = report
        .iter()
        .filter(|source| source["enabled"] == true && source["raw_exists"] == false)
        .collect();
    assert!(
        enabled_without_raw.is_empty(),
        "the fixture must hold every enabled source: {enabled_without_raw:?}"
    );
}
