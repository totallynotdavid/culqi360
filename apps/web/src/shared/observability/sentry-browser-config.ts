export const SENTRY_BROWSER_CONFIG_META_NAME = "sentry-browser-config";

/**
 * What the browser needs to start Sentry. The server resolves it from its own
 * environment per request and ships it in the document head, so one built
 * image serves any DSN.
 */
export interface SentryBrowserConfig {
  dsn: string;
  tracesSampleRate: number;
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
}

function isSampleRate(value: unknown): value is number {
  return typeof value === "number" && value >= 0 && value <= 1;
}

/** Returns null for a missing or malformed value, so the page still loads. */
export function parseSentryBrowserConfig(
  content: string | null,
): SentryBrowserConfig | null {
  if (!content) {
    return null;
  }

  let value: unknown;

  try {
    value = JSON.parse(content);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) {
    return null;
  }

  const dsn: unknown = Reflect.get(value, "dsn");
  const tracesSampleRate: unknown = Reflect.get(value, "tracesSampleRate");
  const replaysSessionSampleRate: unknown = Reflect.get(
    value,
    "replaysSessionSampleRate",
  );
  const replaysOnErrorSampleRate: unknown = Reflect.get(
    value,
    "replaysOnErrorSampleRate",
  );

  if (
    typeof dsn !== "string" ||
    !dsn ||
    !isSampleRate(tracesSampleRate) ||
    !isSampleRate(replaysSessionSampleRate) ||
    !isSampleRate(replaysOnErrorSampleRate)
  ) {
    return null;
  }

  return {
    dsn,
    tracesSampleRate,
    replaysSessionSampleRate,
    replaysOnErrorSampleRate,
  };
}
