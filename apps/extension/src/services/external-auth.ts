import {
  isExtensionHandoffClaims,
  type ExtensionHandoffClaims,
} from "@crm/contracts/extension";

import type { AssignmentHandoff, SyncConfig } from "../domain/model";

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0));
}

function decodeJsonPart(value: string): unknown {
  return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function expectedWebOrigin(): string {
  return import.meta.env.VITE_CRM_WEB_ORIGIN || "http://localhost:3000";
}

function publicKeyBase64(): string {
  return import.meta.env.VITE_CRM_HANDOFF_PUBLIC_KEY_RAW_BASE64 || "";
}

async function importPublicKey(): Promise<CryptoKey> {
  const rawBase64 = publicKeyBase64();
  if (rawBase64.trim() === "") {
    throw new Error("missing extension handoff public key");
  }

  return crypto.subtle.importKey(
    "raw",
    toArrayBuffer(fromBase64Url(rawBase64)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
}

function senderOrigin(sender: { url?: string }): string {
  if (!sender.url) {
    throw new Error("missing sender url");
  }

  const url = new URL(sender.url);
  return url.origin;
}

function validateClaims(claims: ExtensionHandoffClaims, origin: string): void {
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (claims.iss !== "web") {
    throw new Error("invalid token issuer");
  }
  if (claims.aud !== "crm-extension") {
    throw new Error("invalid token audience");
  }
  if (claims.action !== "start_call") {
    throw new Error("invalid token action");
  }
  if (claims.origin !== origin) {
    throw new Error("token origin mismatch");
  }
  if (claims.exp <= nowSeconds) {
    throw new Error("token expired");
  }
  if (claims.iat > nowSeconds + 30) {
    throw new Error("token issued in the future");
  }
}

async function verifyTokenSignature(
  token: string,
): Promise<ExtensionHandoffClaims> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("invalid token format");
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  if (
    encodedHeader === undefined ||
    encodedPayload === undefined ||
    encodedSignature === undefined
  ) {
    throw new Error("invalid token format");
  }

  const header = decodeJsonPart(encodedHeader);
  if (
    typeof header !== "object" ||
    header === null ||
    !("alg" in header) ||
    header.alg !== "EdDSA"
  ) {
    throw new Error("invalid token header");
  }

  const payload = decodeJsonPart(encodedPayload);
  if (!isExtensionHandoffClaims(payload)) {
    throw new Error("invalid handoff claims");
  }

  const signingInput = new TextEncoder().encode(
    `${encodedHeader}.${encodedPayload}`,
  );
  const signature = fromBase64Url(encodedSignature);
  const publicKey = await importPublicKey();
  const verified = await crypto.subtle.verify(
    "Ed25519",
    publicKey,
    toArrayBuffer(signature),
    toArrayBuffer(signingInput),
  );
  if (!verified) {
    throw new Error("invalid token signature");
  }

  return payload;
}

export interface VerifiedExternalHandoff {
  handoff: AssignmentHandoff;
  origin: string;
}

export async function verifyExternalHandoff(input: {
  token: string;
  sender: { url?: string };
}): Promise<VerifiedExternalHandoff> {
  const origin = senderOrigin(input.sender);
  if (origin !== expectedWebOrigin()) {
    throw new Error("untrusted sender origin");
  }

  const claims = await verifyTokenSignature(input.token);
  validateClaims(claims, origin);

  return {
    handoff: {
      assignmentId: claims.assignmentId,
      contactId: claims.contactId,
      phone: claims.phone,
      clientName: claims.clientName,
      organizationLabel: claims.organizationLabel,
      receivedAt: Date.now(),
    },
    origin,
  };
}

export async function claimExternalSession(input: {
  token: string;
  installationId: string;
  origin: string;
}): Promise<SyncConfig> {
  const claimResponse = await fetch(
    `${input.origin}/api/extension/session/claim`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        handoffToken: input.token,
        installationId: input.installationId,
      }),
    },
  );
  if (!claimResponse.ok) {
    let errorMessage = `session claim failed with status ${claimResponse.status}`;
    try {
      const body = (await claimResponse.json()) as { error?: unknown };
      if (typeof body.error === "string" && body.error.trim() !== "") {
        errorMessage = body.error;
      }
    } catch {
      // Use the status-based fallback when reading the error body fails.
    }
    throw new Error(errorMessage);
  }

  const claimBody = (await claimResponse.json()) as {
    sessionToken?: unknown;
    refreshToken?: unknown;
  };
  if (
    typeof claimBody.sessionToken !== "string" ||
    claimBody.sessionToken === ""
  ) {
    throw new Error("session claim returned an invalid session token");
  }
  if (
    typeof claimBody.refreshToken !== "string" ||
    claimBody.refreshToken === ""
  ) {
    throw new Error("session claim returned an invalid refresh token");
  }

  return {
    apiBaseUrl: `${input.origin}/api`,
    sessionToken: claimBody.sessionToken,
    refreshToken: claimBody.refreshToken,
  };
}
