use axum::http::HeaderMap;
use shared::auth::verify_signed_request;
use shared::error::ApiError;
use shared::hmac::{HmacVerifier, sign};
use shared::rate_limit::RateLimiter;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn make_hmac(key_id: &str, secret: &str) -> HmacVerifier {
    HmacVerifier::new(
        HashMap::from([(key_id.to_string(), secret.to_string())]),
        300,
    )
}

fn signed_headers(key_id: &str, secret: &str, body: &[u8]) -> HeaderMap {
    let ts = now_secs();
    let sig = sign(secret, ts, body).expect("hmac sign");
    let mut h = HeaderMap::new();
    h.insert("x-key-id", key_id.parse().unwrap());
    h.insert("x-timestamp", ts.to_string().parse().unwrap());
    h.insert("x-signature", sig.parse().unwrap());
    h
}

#[test]
fn valid_request_returns_key_id() {
    let body = b"payload";
    let headers = signed_headers("web", "secret", body);
    let hmac = make_hmac("web", "secret");
    let limiter = RateLimiter::new(100);

    let result = verify_signed_request(&headers, body, &hmac, &limiter);
    assert_eq!(result.unwrap(), "web");
}

#[test]
fn invalid_credentials_return_unauthorized() {
    let body = b"payload";
    type Tamper = fn(&mut HeaderMap);
    let cases: [(&str, Tamper); 5] = [
        ("missing key id", |h| {
            h.remove("x-key-id");
        }),
        ("missing timestamp", |h| {
            h.remove("x-timestamp");
        }),
        ("missing signature", |h| {
            h.remove("x-signature");
        }),
        ("wrong signature", |h| {
            h.insert("x-signature", "deadbeef".parse().unwrap());
        }),
        ("unknown key id", |h| {
            h.insert("x-key-id", "unknown".parse().unwrap());
        }),
    ];

    for (name, tamper) in cases {
        let mut headers = signed_headers("web", "secret", body);
        tamper(&mut headers);
        let hmac = make_hmac("web", "secret");
        let limiter = RateLimiter::new(100);

        assert!(
            matches!(
                verify_signed_request(&headers, body, &hmac, &limiter),
                Err(ApiError::Unauthorized(_))
            ),
            "{name} must be unauthorized"
        );
    }
}

#[test]
fn repeated_auth_failures_trigger_rate_limit() {
    let body = b"payload";
    let hmac = make_hmac("web", "secret");
    let limiter = RateLimiter::new(1); // 1 token total

    // First attempt: consumes the 1 token, returns Unauthorized.
    let h1 = signed_headers("unknown", "secret", body);
    assert!(matches!(
        verify_signed_request(&h1, body, &hmac, &limiter),
        Err(ApiError::Unauthorized(_))
    ));

    // Second attempt: bucket exhausted, returns RateLimit.
    let h2 = signed_headers("unknown", "secret", body);
    assert!(matches!(
        verify_signed_request(&h2, body, &hmac, &limiter),
        Err(ApiError::RateLimit)
    ));
}
