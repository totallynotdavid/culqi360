use leads::contracts::{RecordImportRequest, RecordImportRow};
use leads::service::ImportService;
use shared::error::ApiError;

#[test]
fn import_reports_a_storage_failure_as_a_service_error() {
    let pool = r2d2::Pool::new(r2d2_sqlite::SqliteConnectionManager::memory()).expect("pool");
    let service = ImportService::new(pool);
    let req = RecordImportRequest {
        rows: vec![RecordImportRow {
            ruc: "20100000001".into(),
            organization_name: "Org".into(),
            dni: "12345678".into(),
            person_name: "Alice".into(),
            phone_primary: "999111222".into(),
            quality_tier: Some(1),
            product_tag: None,
            branch_tag: None,
        }],
        source: "test".into(),
    };

    let err = service
        .import_leads(&req)
        .expect_err("a database without the leads table cannot accept rows");
    match err {
        ApiError::Service(message) => assert!(message.contains("insert failed")),
        other => panic!("unexpected error type: {other}"),
    }
}
