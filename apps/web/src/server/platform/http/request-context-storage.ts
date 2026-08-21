import { getRequestEvent } from "@solidjs/web";

import type { AuthSession } from "~/domain/auth/access/session-types";
import type { OperationContext } from "~/server/platform/operation/context";

export type CsrfState =
  | { kind: "not_applicable" }
  | { kind: "missing" }
  | { kind: "available"; token: string };

export interface RequestContext {
  traceId: string;
  requestId: string;
  route: string;
  method: string;

  // Wall-clock time captured once when the request enters the system.
  startedAt: Date;

  // Monotonic origin used for elapsed-time measurements.
  startedTicks: number;

  nonce: string;
  csrf: CsrfState;
  principal: AuthSession | null;
  publicOrigin: string;
  clientIp: string;
  userAgent: string | null;
}

// Keep this read side free of server-only cookie APIs. Cookie access belongs in
// request-context-builder and is imported only by middleware.
export function getRequestContext(): RequestContext {
  const event = getRequestEvent();
  const context = event?.locals?.requestContext;

  if (!context) {
    throw new Error("Missing request context");
  }

  return context;
}

export function getRequestOperation(): OperationContext {
  return {
    operationAt: getRequestContext().startedAt,
  };
}

export function getRequestClientMetadata(): {
  ipAddress: string;
  userAgent: string | null;
} {
  const context = getRequestContext();

  return {
    ipAddress: context.clientIp,
    userAgent: context.userAgent,
  };
}
