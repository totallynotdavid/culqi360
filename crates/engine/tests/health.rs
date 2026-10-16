mod common;

#[tokio::test]
async fn health_returns_ok_with_minimal_schema() {
    let (server, _db) = common::make_test_server();
    let response = server.get("/health").await;
    response.assert_status_ok();
    let payload = response.json::<serde_json::Value>();
    assert_eq!(payload["status"], "ok");
}

#[tokio::test]
async fn unauthorized_errors_include_request_id_header_and_body() {
    let (server, _db) = common::make_test_server();
    let response = server
        .post("/search")
        .json(&serde_json::json!({"type":"dni","value":"12345678"}))
        .await;

    response.assert_status_unauthorized();
    assert!(response.contains_header("x-request-id"));

    let header_value = response
        .header("x-request-id")
        .to_str()
        .expect("x-request-id must be valid header string")
        .to_string();

    let payload = response.json::<serde_json::Value>();
    assert_eq!(payload["request_id"], header_value);
}

#[tokio::test]
async fn record_endpoints_reject_unsigned_requests() {
    let (server, _db) = common::make_test_server();
    let cases = [
        (
            "/records/candidates",
            serde_json::json!({"branch_id":1,"user_id":1}),
        ),
        (
            "/records/imports",
            serde_json::json!({"rows":[],"source":"test"}),
        ),
    ];

    for (path, body) in cases {
        server
            .post(path)
            .json(&body)
            .await
            .assert_status_unauthorized();
    }
}
