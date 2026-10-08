//! The checked-in synthetic fixture must build a contacts database the engine
//! accepts, so the engine runs on a checkout that has no raw snapshots.

use pipeline::cli::Command;
use search::contracts::SearchRequest;
use search::service::SearchService;
use serde_json::json;
use shared::sqlite::make_readonly_pool;
use std::path::Path;

#[test]
fn fixture_refresh_builds_a_database_the_engine_can_search() {
    // The fixture config holds repository-relative paths. This binary has a
    // single test, so changing the working directory affects nothing else.
    let repo_root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    std::env::set_current_dir(&repo_root).expect("enter repository root");

    let out_dir = tempfile::tempdir().expect("temp dir");
    let contacts_db = out_dir.path().join("contacts.sqlite");
    let contacts_db_path = contacts_db.to_string_lossy().to_string();

    pipeline::pipeline::run(Command::Refresh {
        config: "crates/pipeline/data/fixture/pipeline.toml".to_owned(),
        raw_dir: None,
        slice: "10k".to_owned(),
        to: Some(contacts_db_path.clone()),
    })
    .expect("fixture refresh");

    let pool = make_readonly_pool(&contacts_db_path).expect("readonly pool");
    let conn = pool.get().expect("connection");
    search::validate_schema(&conn).expect("engine schema accepts the fixture");

    let service = SearchService::new(pool.clone(), 100);
    let request: SearchRequest = serde_json::from_value(json!({
        "intent": "people",
        "query": "900000001",
    }))
    .expect("search request");
    let response = service.search(&request).expect("search by phone");

    assert!(response.count >= 1, "the fixture holds this phone number");
    let hit = serde_json::to_string(&response.results).expect("serialize results");
    assert!(hit.contains("RAMOS QUISPE, LUCIA"), "unexpected hit: {hit}");
}
