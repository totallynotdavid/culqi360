import {
  deliveryProviderChannel,
  isDeliveryProviderId,
  isNotificationChannel,
  type DeliveryProviderId,
  type NotificationChannel,
  type NotificationRoutes,
} from "@crm/message-channels";

import type { SentryBrowserConfig } from "~/shared/observability/sentry-browser-config";

const SECRET_MIN_LENGTH = 32;
const SECRET_MIN_UNIQUE_CHARS = 10;

const LOCAL_DEV_DB_URL = "postgres://postgres@localhost:5432/crm";

const SEQUENTIAL_CHARS =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function validateSecret(key: string, value: string): void {
  if (value.length < SECRET_MIN_LENGTH) {
    throw new Error(
      `${key} must be at least ${SECRET_MIN_LENGTH} characters long`,
    );
  }

  if (/^(.)\1+$/.test(value)) {
    throw new Error(`${key} cannot be a repeating sequence of one character`);
  }

  if (
    SEQUENTIAL_CHARS.includes(value) ||
    SEQUENTIAL_CHARS.split("").toReversed().join("").includes(value)
  ) {
    throw new Error(`${key} cannot be a simple sequential string`);
  }

  const uniqueChars = new Set(value).size;

  if (uniqueChars < SECRET_MIN_UNIQUE_CHARS) {
    throw new Error(
      `${key} has too little entropy (only ${uniqueChars} unique characters)`,
    );
  }
}

type EnvSource = Record<string, string | undefined>;

function required(env: EnvSource, key: string, secret = false): string {
  const value = env[key];

  if (!value) {
    let message = `Missing required env: ${key}`;

    if (secret) {
      message += ". Generate one with: openssl rand -base64 32";
    }

    throw new Error(message);
  }

  try {
    if (secret) {
      validateSecret(key, value);
    }
  } catch (error) {
    if (error instanceof Error) {
      error.message += ". Generate a new one with: openssl rand -base64 32";
    }

    throw error;
  }

  return value;
}

function optional(env: EnvSource, key: string, fallback: string): string {
  return env[key] ?? fallback;
}

function optionalEnum<const T extends readonly string[]>(
  env: EnvSource,
  key: string,
  values: T,
  fallback: T[number],
): T[number] {
  const value = env[key];

  if (!value) {
    return fallback;
  }

  if ((values as readonly string[]).includes(value)) {
    return value;
  }

  throw new Error(`${key} must be one of: ${values.join(", ")}`);
}

function parseSessionEnv(source: EnvSource) {
  return {
    sessionSecret: required(source, "SESSION_SECRET", true),
  } as const;
}

function parseTotpEnv(source: EnvSource) {
  return {
    totpEncryptionKey: required(source, "TOTP_ENCRYPTION_KEY", true),
  } as const;
}

function parseRecoveryEnv(source: EnvSource) {
  return {
    recoveryCodePepper: required(source, "RECOVERY_CODE_PEPPER", true),
  } as const;
}

function parseExtensionEnv(source: EnvSource) {
  return {
    extensionHandoffPrivateKeyPkcs8Base64: optional(
      source,
      "EXTENSION_HANDOFF_PRIVATE_KEY_PKCS8_BASE64",
      "",
    ),
    extensionHandoffPublicKeySpkiBase64: optional(
      source,
      "EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64",
      "",
    ),
    extensionExpectedOrigin: optional(
      source,
      "EXTENSION_EXPECTED_ORIGIN",
      "http://localhost:3000",
    ),
  } as const;
}

function parseSecurityEnv(source: EnvSource) {
  return {
    trustedProxy: optional(source, "TRUSTED_PROXY", "false"),
  } as const;
}

function parseAppEnv(source: EnvSource) {
  return {
    publicOrigin: parsePublicOrigin(
      optional(source, "APP_PUBLIC_ORIGIN", "http://localhost:3000"),
    ),
  } as const;
}

function parsePublicOrigin(raw: string): string {
  let url: URL;

  try {
    url = new URL(raw);
  } catch {
    throw new Error("APP_PUBLIC_ORIGIN must be a valid URL origin");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("APP_PUBLIC_ORIGIN must use http or https");
  }

  if (url.pathname !== "/" || url.search || url.hash) {
    throw new Error(
      "APP_PUBLIC_ORIGIN must not include a path, query, or hash",
    );
  }

  return url.origin;
}

function parseUploadsEnv(source: EnvSource) {
  return {
    storageRoot: optional(
      source,
      "WEB_UPLOADS_ROOT",
      ".local-storage/documents",
    ),
  } as const;
}

function parseDatabaseEnv(source: EnvSource) {
  const configuredUrl = source["WEB_DB_URL"]?.trim();

  if (configuredUrl) {
    return { url: configuredUrl } as const;
  }

  if (source["NODE_ENV"] === "production") {
    throw new Error("Missing required env: WEB_DB_URL");
  }

  return { url: LOCAL_DEV_DB_URL } as const;
}

function parseEngineEnv(source: EnvSource) {
  return {
    engineConnectMode: optionalEnum(
      source,
      "ENGINE_CONNECT_MODE",
      ["local", "internal", "remote"] as const,
      "local",
    ),
    engineUrl: optional(source, "ENGINE_URL", "http://127.0.0.1:3001"),
    engineHmacKeyId: required(source, "ENGINE_HMAC_KEY_ID"),
    engineHmacSecret: required(source, "ENGINE_HMAC_SECRET", true),
    engineTimeoutMs: optional(source, "ENGINE_TIMEOUT_MS", "5000"),
  } as const;
}

function parseGoogleOAuthEnv(source: EnvSource) {
  return {
    googleClientId: required(source, "GOOGLE_CLIENT_ID"),
    googleClientSecret: required(source, "GOOGLE_CLIENT_SECRET"),
    googleRedirectUri: required(source, "GOOGLE_REDIRECT_URI"),
  } as const;
}

function parseNotificationRoutes(source: EnvSource): NotificationRoutes {
  const raw = optional(
    source,
    "NOTIFICATION_ROUTES",
    "email:resend,whatsapp:kapso",
  );
  const routes: NotificationRoutes = {};

  for (const segment of raw.split(",")) {
    const trimmed = segment.trim();

    if (!trimmed) {
      continue;
    }

    const [channel, provider, extra] = trimmed.split(":");

    if (!channel || !provider || extra !== undefined) {
      throw new Error(
        "NOTIFICATION_ROUTES entries must use channel:provider format",
      );
    }

    if (!isNotificationChannel(channel)) {
      throw new Error(`Unknown notification channel in route: ${channel}`);
    }

    if (!isDeliveryProviderId(provider)) {
      throw new Error(`Unknown notification provider in route: ${provider}`);
    }

    if (routes[channel]) {
      throw new Error(`Duplicate notification route for channel: ${channel}`);
    }

    if (deliveryProviderChannel(provider) !== channel) {
      throw routeProviderMismatch(channel, provider);
    }

    Object.assign(routes, { [channel]: provider });
  }

  return routes;
}

function routeProviderMismatch(
  channel: NotificationChannel,
  provider: DeliveryProviderId,
): Error {
  const providerChannel = deliveryProviderChannel(provider);

  return new Error(
    `Notification route ${channel}:${provider} cannot use a ${providerChannel} provider`,
  );
}

function routeUses(
  routes: NotificationRoutes,
  provider: DeliveryProviderId,
): boolean {
  return Object.values(routes).includes(provider);
}

function parseNotificationsEnv(source: EnvSource) {
  const routes = parseNotificationRoutes(source);

  return {
    routes,
    resend: routeUses(routes, "resend")
      ? {
          apiKey: required(source, "RESEND_API_KEY"),
          fromEmail: required(source, "EMAIL_FROM"),
        }
      : null,
    kapso: routeUses(routes, "kapso")
      ? {
          apiKey: required(source, "KAPSO_API_KEY"),
          whatsappPhoneNumberId: required(
            source,
            "KAPSO_WHATSAPP_PHONE_NUMBER_ID",
          ),
          metaGraphVersion: optional(
            source,
            "KAPSO_META_GRAPH_VERSION",
            "v24.0",
          ),
        }
      : null,
    whatsappCloud: routeUses(routes, "whatsapp_cloud")
      ? {
          accessToken: required(source, "WHATSAPP_CLOUD_ACCESS_TOKEN"),
          phoneNumberId: required(source, "WHATSAPP_CLOUD_PHONE_NUMBER_ID"),
          graphVersion: optional(
            source,
            "WHATSAPP_CLOUD_GRAPH_VERSION",
            "v24.0",
          ),
        }
      : null,
    whatsappWebhookVerifyToken: required(
      source,
      "WHATSAPP_WEBHOOK_VERIFY_TOKEN",
      true,
    ),

    // Empty means signature verification always fails; the handshake still works.
    kapsoWebhookSecret: source["KAPSO_WEBHOOK_SECRET"] ?? "",
  } as const;
}

function sentryIngestHostFromDsn(dsn: string): string {
  try {
    return new URL(dsn).host;
  } catch {
    return "";
  }
}

function sampleRate(env: EnvSource, key: string, fallback: number): number {
  const raw = env[key];

  if (!raw) {
    return fallback;
  }

  const rate = Number(raw);

  if (!(rate >= 0 && rate <= 1)) {
    throw new Error(`${key} must be a number between 0 and 1`);
  }

  return rate;
}

function parseSentryEnv(source: EnvSource) {
  const sentryDsn = optional(source, "SENTRY_DSN", "");

  return {
    sentryDsn,
    sentryIngestHost: sentryDsn ? sentryIngestHostFromDsn(sentryDsn) : "",
    sentryTraceSampleRate: optional(source, "SENTRY_TRACES_SAMPLE_RATE", "0.1"),
    browser: sentryDsn
      ? ({
          dsn: sentryDsn,
          tracesSampleRate: sampleRate(
            source,
            "SENTRY_BROWSER_TRACES_SAMPLE_RATE",
            0.1,
          ),
          replaysSessionSampleRate: sampleRate(
            source,
            "SENTRY_BROWSER_REPLAY_SESSION_SAMPLE_RATE",
            0.05,
          ),
          replaysOnErrorSampleRate: sampleRate(
            source,
            "SENTRY_BROWSER_REPLAY_ON_ERROR_SAMPLE_RATE",
            1,
          ),
        } satisfies SentryBrowserConfig)
      : null,
  } as const;
}

export function loadServerEnv(source: EnvSource) {
  return {
    session: parseSessionEnv(source),
    totp: parseTotpEnv(source),
    recovery: parseRecoveryEnv(source),
    extension: parseExtensionEnv(source),
    security: parseSecurityEnv(source),
    app: parseAppEnv(source),
    uploads: parseUploadsEnv(source),
    database: parseDatabaseEnv(source),
    engine: parseEngineEnv(source),
    googleOAuth: parseGoogleOAuthEnv(source),
    notifications: parseNotificationsEnv(source),
    sentry: parseSentryEnv(source),
  } as const;
}

// Tests read process.env on every call. Other environments parse it once.
function section<T>(parse: (source: EnvSource) => T): () => T {
  let cached: T | undefined;

  return () => {
    if (process.env.NODE_ENV === "test") {
      return parse(process.env);
    }

    cached ??= parse(process.env);

    return cached;
  };
}

export const totpConfig = section(parseTotpEnv);
export const recoveryConfig = section(parseRecoveryEnv);
export const extensionConfig = section(parseExtensionEnv);
export const securityConfig = section(parseSecurityEnv);
export const appConfig = section(parseAppEnv);
export const uploadsConfig = section(parseUploadsEnv);
export const databaseConfig = section(parseDatabaseEnv);
export const engineConfig = section(parseEngineEnv);
export const googleOAuthConfig = section(parseGoogleOAuthEnv);
export const notificationsConfig = section(parseNotificationsEnv);
export const sentryConfig = section(parseSentryEnv);

export type NotificationsConfig = ReturnType<typeof parseNotificationsEnv>;
export type AppConfig = ReturnType<typeof parseAppEnv>;
export type EngineConfig = ReturnType<typeof parseEngineEnv>;
export type UploadsConfig = ReturnType<typeof parseUploadsEnv>;

export function validateServerConfig(): void {
  loadServerEnv(process.env);
}
