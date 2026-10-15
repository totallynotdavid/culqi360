import type { DomainError } from "~/domain/errors";
import { toWire } from "~/server/platform/action/domain-error";
import { HTTP_STATUS_BY_WIRE_KIND } from "~/server/platform/http/wire-status";

// The extension treats 401 as "claim or refresh a session". An invalid session
// has wire kind `forbidden`, which would otherwise map to 403 and hide that.
const STATUS_BY_CODE: Record<string, number> = {
  extension_session_invalid: 401,
  misconfigured: 503,
  segment_too_large: 413,
};

export function getBearerToken(request: Request): string | null {
  const header = request.headers.get("authorization");

  if (!header?.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice("Bearer ".length).trim();

  return token === "" ? null : token;
}

export function extensionErrorResponse(error: DomainError): Response {
  const wire = toWire(error);
  const status =
    (wire.code === null ? undefined : STATUS_BY_CODE[wire.code]) ??
    HTTP_STATUS_BY_WIRE_KIND[wire.kind];

  return Response.json({ error: wire.message, code: wire.code }, { status });
}
