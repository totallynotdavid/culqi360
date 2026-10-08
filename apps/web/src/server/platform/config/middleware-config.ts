export interface MiddlewareConfig {
  trustedProxy: boolean;
}

export function middlewareConfig(
  source: Record<string, string | undefined> = process.env,
): MiddlewareConfig {
  return {
    trustedProxy: source["TRUSTED_PROXY"] === "true",
  };
}
