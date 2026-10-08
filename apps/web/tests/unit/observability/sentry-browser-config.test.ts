import { describe, expect, it } from "vitest";

import { loadServerEnv } from "~/server/platform/config/env";
import {
  parseSentryBrowserConfig,
  type SentryBrowserConfig,
} from "~/shared/observability/sentry-browser-config";

const requiredEnv = {
  SESSION_SECRET: "temp_secret_for_initial_import_32_chars_long",
  TOTP_ENCRYPTION_KEY: "temp_secret_for_initial_import_32_chars_long",
  RECOVERY_CODE_PEPPER: "temp_recovery_pepper_for_tests_32_chars_long",
  ENGINE_HMAC_KEY_ID: "web",
  ENGINE_HMAC_SECRET: "temp_secret_for_initial_import_32_chars_long",
  GOOGLE_CLIENT_ID: "google-client-id",
  GOOGLE_CLIENT_SECRET: "google-client-secret",
  GOOGLE_REDIRECT_URI: "http://localhost:3000/api/auth/google/callback",
  NOTIFICATION_ROUTES: "email:resend,whatsapp:kapso",
  RESEND_API_KEY: "re_test_key",
  EMAIL_FROM: "support@example.com",
  KAPSO_API_KEY: "test-kapso-api-key",
  KAPSO_WHATSAPP_PHONE_NUMBER_ID: "test-whatsapp-phone-number-id",
  WHATSAPP_WEBHOOK_VERIFY_TOKEN:
    "stable-test-whatsapp-verify-token-satisfies-entropy-checks-12345",
  KAPSO_WEBHOOK_SECRET: "test-kapso-webhook-secret",
} satisfies Record<string, string>;

function sentryFrom(extra: Record<string, string>) {
  return loadServerEnv({ ...requiredEnv, ...extra }).sentry;
}

describe("server sentry configuration", () => {
  it("serves no browser configuration without a DSN", () => {
    expect(sentryFrom({}).browser).toBeNull();
  });

  it("reads the DSN from the runtime environment with default sample rates", () => {
    const sentry = sentryFrom({
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
    });

    expect(sentry.sentryIngestHost).toBe("o1.ingest.sentry.io");
    expect(sentry.browser).toEqual({
      dsn: "https://key@o1.ingest.sentry.io/2",
      tracesSampleRate: 0.1,
      replaysSessionSampleRate: 0.05,
      replaysOnErrorSampleRate: 1,
    } satisfies SentryBrowserConfig);
  });

  it("rejects a sample rate outside 0 to 1", () => {
    expect(() =>
      sentryFrom({
        SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
        SENTRY_BROWSER_TRACES_SAMPLE_RATE: "10",
      }),
    ).toThrow(
      "SENTRY_BROWSER_TRACES_SAMPLE_RATE must be a number between 0 and 1",
    );
  });
});

describe("browser sentry configuration", () => {
  it("round-trips what the server renders into the document head", () => {
    const browser = sentryFrom({
      SENTRY_DSN: "https://key@o1.ingest.sentry.io/2",
    }).browser;

    expect(parseSentryBrowserConfig(JSON.stringify(browser))).toEqual(browser);
  });

  it.each([
    ["a missing tag", null],
    ["an empty tag", ""],
    ["text that is not JSON", "not json"],
    ["JSON that is not an object", "42"],
    [
      "an empty DSN",
      JSON.stringify({
        dsn: "",
        tracesSampleRate: 0.1,
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1,
      }),
    ],
    [
      "a sample rate that is not a number",
      JSON.stringify({
        dsn: "https://key@o1.ingest.sentry.io/2",
        tracesSampleRate: "0.1",
        replaysSessionSampleRate: 0.05,
        replaysOnErrorSampleRate: 1,
      }),
    ],
  ])("starts no Sentry for %s", (_label, content) => {
    expect(parseSentryBrowserConfig(content)).toBeNull();
  });
});
