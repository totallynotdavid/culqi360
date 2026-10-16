mod common;

use axum::http::{HeaderName, HeaderValue};
use axum_test::TestServer;
use search::api::{SearchState, router};
use search::service::SearchService;
use serde_json::json;
use shared::hmac::{HmacVerifier, sign};
use shared::rate_limit::RateLimiter;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{SystemTime, UNIX_EPOCH};

const KEY_ID: &str = "web";
const SECRET: &str = "test-secret";

fn sign_body(secret: &str, body: &[u8]) -> (String, String) {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .expect("time")
        .as_secs();
    let sig = sign(secret, ts, body).expect("hmac sign");
    (ts.to_string(), sig)
}

fn make_server(tokens_per_minute: u32) -> TestServer {
    let db = common::create_test_db();
    let pool = common::test_pool(&db);
    let conn = pool.get().expect("conn");
    search::validate_schema(&conn).expect("schema");

    let state = Arc::new(SearchState {
        service: Arc::new(SearchService::new(pool, 100)),
        hmac: Arc::new(HmacVerifier::new(
            HashMap::from([(KEY_ID.to_string(), SECRET.to_string())]),
            60,
        )),
        limiter: Arc::new(RateLimiter::new(tokens_per_minute)),
    });

    std::mem::forget(db);
    TestServer::new(router(state))
}

/// Signs `body`, sends POST /search, and returns the response.
async fn signed_request(body: &serde_json::Value, server: &TestServer) -> axum_test::TestResponse {
    let bytes = serde_json::to_vec(body).expect("json");
    let (ts, sig) = sign_body(SECRET, &bytes);

    server
        .post("/search")
        .add_header(
            HeaderName::from_static("x-key-id"),
            HeaderValue::from_static(KEY_ID),
        )
        .add_header(
            HeaderName::from_static("x-timestamp"),
            HeaderValue::from_str(&ts).expect("ts header"),
        )
        .add_header(
            HeaderName::from_static("x-signature"),
            HeaderValue::from_str(&sig).expect("sig header"),
        )
        .json(body)
        .await
}

#[tokio::test]
async fn search_by_dni_returns_matching_row() {
    let server = make_server(100);
    let response = signed_request(
        &json!({"intent":"people","query":"12345678","limit":5}),
        &server,
    )
    .await;

    response.assert_status_ok();
    let payload = response.json::<serde_json::Value>();
    assert_eq!(payload["count"], 1);
    assert_eq!(payload["results"][0]["kind"], "document");
    assert_eq!(payload["results"][0]["doc"]["doc_number"], "12345678");
}

#[tokio::test]
async fn search_by_document_returns_matching_row() {
    let server = make_server(100);
    let response = signed_request(
        &json!({"intent":"people","query":"DNI:12345678","limit":5}),
        &server,
    )
    .await;

    response.assert_status_ok();
    let payload = response.json::<serde_json::Value>();
    assert_eq!(payload["count"], 1);
    assert_eq!(payload["results"][0]["kind"], "document");
    assert_eq!(payload["results"][0]["doc"]["doc_type"], "DNI");
    assert_eq!(payload["results"][0]["doc"]["doc_number"], "12345678");
}

#[tokio::test]
async fn search_by_phone_returns_siblings() {
    let server = make_server(100);
    let response = signed_request(
        &json!({"intent":"people","query":"999111222","limit":20}),
        &server,
    )
    .await;

    response.assert_status_ok();
    let payload = response.json::<serde_json::Value>();
    // doc_id=1 and company_id=1 both have phone 999111222 indexed
    assert_eq!(payload["count"], 2);
    // docs come first in the concatenation
    assert_eq!(payload["results"][0]["kind"], "document");
    assert_eq!(payload["results"][0]["doc"]["doc_number"], "12345678");
    assert_eq!(payload["results"][0]["org"]["name"], "ACME SAC");
    assert_eq!(payload["results"][0]["role"]["name"], "GERENTE GENERAL");
    assert!(
        payload["results"][0]["phones"]["siblings"]
            .as_array()
            .is_some()
    );
}

// auth / validation

#[tokio::test]
async fn missing_signature_headers_returns_401() {
    let server = make_server(100);
    let response = server
        .post("/search")
        .json(&json!({"intent":"people","query":"12345678"}))
        .await;
    response.assert_status_unauthorized();
}

#[tokio::test]
async fn unknown_key_id_returns_401() {
    let server = make_server(100);
    let body = json!({"intent":"people","query":"12345678","limit":5});
    let bytes = serde_json::to_vec(&body).expect("json");
    let (ts, sig) = sign_body(SECRET, &bytes);

    server
        .post("/search")
        .add_header(
            HeaderName::from_static("x-key-id"),
            HeaderValue::from_static("unknown"),
        )
        .add_header(
            HeaderName::from_static("x-timestamp"),
            HeaderValue::from_str(&ts).expect("ts header"),
        )
        .add_header(
            HeaderName::from_static("x-signature"),
            HeaderValue::from_str(&sig).expect("sig header"),
        )
        .json(&body)
        .await
        .assert_status_unauthorized();
}

#[tokio::test]
async fn short_text_query_returns_400() {
    let server = make_server(100);
    let response =
        signed_request(&json!({"intent":"people","query":"ro","limit":20}), &server).await;
    response.assert_status_bad_request();
}

#[tokio::test]
async fn rate_limit_is_enforced_after_capacity_exhausted() {
    // 1 token available, DNI costs 1, second call is rejected.
    let server = make_server(1);
    let body = json!({"intent":"people","query":"12345678","limit":5});

    signed_request(&body, &server).await.assert_status_ok();
    signed_request(&body, &server)
        .await
        .assert_status_too_many_requests();
}

#[tokio::test]
async fn name_search_costs_more_tokens_than_dni() {
    // 3 tokens available, person_name costs 3, second call is rejected.
    let server = make_server(3);
    let body = json!({"intent":"people","query":"juan","limit":20});

    signed_request(&body, &server).await.assert_status_ok();
    signed_request(&body, &server)
        .await
        .assert_status_too_many_requests();
}
