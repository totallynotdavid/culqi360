import { redirect } from "@solidjs/web";

import type { Role } from "~/domain/auth/access/rbac";
import { getSessionPath } from "~/domain/auth/access/route-policy";
import type { SessionClass } from "~/domain/auth/core/session-contract";
import { parseLoginFlowId } from "~/domain/auth/login-flow/parse-id";
import type { AuthLoginFlowId } from "~/domain/ids";
import { setSessionCookie } from "~/server/auth/session/cookies";

export function readPasskeyStartMode(
  formData: FormData,
): "identified" | "discoverable" | null {
  const value = formData.get("mode");

  return value === "identified" || value === "discoverable" ? value : null;
}

export function readLoginText(
  formData: FormData,
  field: "identifier" | "password" | "totpCode" | "recoveryCode",
  options?: { trim?: boolean },
): string {
  const value = formData.get(field);

  if (typeof value !== "string") {
    return "";
  }

  return options?.trim === false ? value : value.trim();
}

export function readLoginFlowId(
  formData: FormData,
  field: "flowId",
): AuthLoginFlowId | null {
  const value = formData.get(field);

  return typeof value === "string" ? parseLoginFlowId(value) : null;
}

export function completeLoginAndRedirect(result: {
  token: string;
  role: Role;
  sessionClass: SessionClass;
}): never {
  setSessionCookie(result.token);

  throw redirect(getSessionPath(result.sessionClass, result.role));
}
