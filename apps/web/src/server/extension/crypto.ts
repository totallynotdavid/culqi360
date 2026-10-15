import type { ExtensionHandoffClaims } from "@crm/contracts/extension";

import { extensionConfig } from "~/server/platform/config/env";

import type { ExtensionInstallationSessionClaims } from "./contracts";

type ExtensionTokenClaims =
  | ExtensionHandoffClaims
  | ExtensionInstallationSessionClaims;

interface ExtensionTokenHeader {
  alg: "EdDSA";
  typ: "JWT";
}

export class ExtensionTokenVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExtensionTokenVerificationError";
  }
}

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64(value: string): Uint8Array {
  return Buffer.from(value, "base64");
}

function fromBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Uint8Array.from(Buffer.from(padded, "base64"));
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function encodeJson(value: unknown): string {
  return toBase64Url(new TextEncoder().encode(JSON.stringify(value)));
}

function encodeSigningInput(
  header: ExtensionTokenHeader,
  claims: ExtensionTokenClaims,
): Uint8Array {
  return Buffer.from(`${encodeJson(header)}.${encodeJson(claims)}`, "utf8");
}

async function importPrivateKey(): Promise<CryptoKey> {
  const env = extensionConfig();
  if (!env.extensionHandoffPrivateKeyPkcs8Base64) {
    throw new Error("Missing extension handoff private key");
  }

  return crypto.subtle.importKey(
    "pkcs8",
    toArrayBuffer(fromBase64(env.extensionHandoffPrivateKeyPkcs8Base64)),
    { name: "Ed25519" },
    false,
    ["sign"],
  );
}

async function importPublicKey(): Promise<CryptoKey> {
  const env = extensionConfig();
  if (!env.extensionHandoffPublicKeySpkiBase64) {
    throw new Error("Missing extension handoff public key");
  }

  return crypto.subtle.importKey(
    "spki",
    toArrayBuffer(fromBase64(env.extensionHandoffPublicKeySpkiBase64)),
    { name: "Ed25519" },
    false,
    ["verify"],
  );
}

export async function signExtensionToken(
  claims: ExtensionTokenClaims,
): Promise<string> {
  const header: ExtensionTokenHeader = {
    alg: "EdDSA",
    typ: "JWT",
  };
  const signingInput = encodeSigningInput(header, claims);
  const privateKey = await importPrivateKey();
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      "Ed25519",
      privateKey,
      toArrayBuffer(signingInput),
    ),
  );
  const [encodedHeader, encodedPayload] = new TextDecoder()
    .decode(signingInput)
    .split(".");

  return `${encodedHeader}.${encodedPayload}.${toBase64Url(signature)}`;
}

function decodeJsonPart(value: string): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(fromBase64Url(value)));
  } catch {
    throw new ExtensionTokenVerificationError("invalid token encoding");
  }
}

export async function verifyExtensionToken<T extends ExtensionTokenClaims>(
  token: string,
  isClaims: (value: unknown) => value is T,
): Promise<T> {
  const [encodedHeader, encodedPayload, encodedSignature, ...extraParts] =
    token.split(".");
  if (
    encodedHeader === undefined ||
    encodedPayload === undefined ||
    encodedSignature === undefined ||
    extraParts.length > 0
  ) {
    throw new ExtensionTokenVerificationError("invalid token format");
  }

  const header = decodeJsonPart(encodedHeader);
  if (
    typeof header !== "object" ||
    header === null ||
    !("alg" in header) ||
    header.alg !== "EdDSA"
  ) {
    throw new ExtensionTokenVerificationError("invalid token header");
  }

  const payload = decodeJsonPart(encodedPayload);
  if (!isClaims(payload)) {
    throw new ExtensionTokenVerificationError("invalid token claims");
  }

  const publicKey = await importPublicKey();
  const verified = await crypto.subtle.verify(
    "Ed25519",
    publicKey,
    toArrayBuffer(fromBase64Url(encodedSignature)),
    toArrayBuffer(
      new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`),
    ),
  );
  if (!verified) {
    throw new ExtensionTokenVerificationError("invalid token signature");
  }

  return payload;
}

export async function hashExtensionSecretToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token),
  );
  return toBase64Url(new Uint8Array(digest));
}
