use dashmap::DashMap;
use std::time::Instant;

#[derive(Debug)]
struct Bucket {
    tokens: f64,
    last_refill_at: Instant,
}

/// Token-bucket rate limiter keyed by arbitrary string (e.g. `"search:web"`).
/// Thread-safe via `DashMap`; suitable for use behind an `Arc`.
#[derive(Debug)]
pub struct RateLimiter {
    tokens_per_minute: u32,
    capacity: f64,
    buckets: DashMap<String, Bucket>,
}

impl RateLimiter {
    pub fn new(tokens_per_minute: u32) -> Self {
        Self {
            tokens_per_minute,
            capacity: tokens_per_minute as f64,
            buckets: DashMap::new(),
        }
    }

    /// Returns `true` and deducts `cost` tokens if the bucket has capacity.
    /// Cost 0 always succeeds without touching the bucket.
    pub fn allow(&self, key: &str, cost: u32) -> bool {
        if cost == 0 {
            return true;
        }

        let now = Instant::now();
        let cost = cost as f64;
        let refill_rate = self.tokens_per_minute as f64 / 60.0;

        let mut bucket = self.buckets.entry(key.to_string()).or_insert(Bucket {
            tokens: self.capacity,
            last_refill_at: now,
        });
        let elapsed = now.duration_since(bucket.last_refill_at).as_secs_f64();
        let refilled = (bucket.tokens + elapsed * refill_rate).min(self.capacity);
        bucket.tokens = refilled;
        bucket.last_refill_at = now;

        if bucket.tokens < cost {
            return false;
        }

        bucket.tokens -= cost;
        true
    }
}

#[cfg(test)]
mod tests {
    use super::RateLimiter;

    #[test]
    fn first_request_consumes_the_bucket_capacity() {
        let limiter = RateLimiter::new(1);

        assert!(limiter.allow("test", 1));
        assert!(!limiter.allow("test", 1));
    }
}
