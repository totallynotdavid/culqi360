import { generateKeyPairSync } from "node:crypto";

import {
  EXTENSION_HANDOFF_TOKEN_AUDIENCE,
  EXTENSION_HANDOFF_TOKEN_ISSUER,
  isExtensionHandoffClaims,
} from "@crm/contracts/extension";
import { afterEach, describe, expect, it, vi } from "vitest";

interface ExtensionTokenKeyMaterial {
  privateKeyPkcs8Base64: string;
  publicKeySpkiBase64: string;
}

function generateExtensionTokenKeys(): ExtensionTokenKeyMaterial {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");

  return {
    privateKeyPkcs8Base64: Buffer.from(
      privateKey.export({ format: "der", type: "pkcs8" }),
    ).toString("base64"),
    publicKeySpkiBase64: Buffer.from(
      publicKey.export({ format: "der", type: "spki" }),
    ).toString("base64"),
  };
}

async function importExtensionCrypto() {
  vi.resetModules();
  return import("~/server/extension/crypto");
}

function stubExtensionTokenKeys(keys: ExtensionTokenKeyMaterial): void {
  vi.stubEnv(
    "EXTENSION_HANDOFF_PRIVATE_KEY_PKCS8_BASE64",
    keys.privateKeyPkcs8Base64,
  );
  vi.stubEnv(
    "EXTENSION_HANDOFF_PUBLIC_KEY_SPKI_BASE64",
    keys.publicKeySpkiBase64,
  );
}

describe("extension token crypto", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs with the private key and verifies with the configured public key", async () => {
    const keys = generateExtensionTokenKeys();
    stubExtensionTokenKeys(keys);
    const { signExtensionToken, verifyExtensionToken } =
      await importExtensionCrypto();

    const claims = {
      iss: EXTENSION_HANDOFF_TOKEN_ISSUER,
      aud: EXTENSION_HANDOFF_TOKEN_AUDIENCE,
      sub: "user:42",
      authSessionId: "session-1",
      branchId: "7",
      assignmentId: "13",
      contactId: "19",
      phone: "+51999999999",
      clientName: "Ada Lovelace",
      organizationLabel: "Analytical Engines",
      action: "start_call",
      origin: "http://localhost:3000",
      jti: crypto.randomUUID(),
      iat: 1_700_000_000,
      exp: 1_700_000_120,
    } as const;

    const token = await signExtensionToken(claims);

    await expect(
      verifyExtensionToken(token, isExtensionHandoffClaims),
    ).resolves.toEqual(claims);
  });

  it("rejects a token when the public key does not match the signing key", async () => {
    const signingKeys = generateExtensionTokenKeys();
    const verificationKeys = generateExtensionTokenKeys();
    stubExtensionTokenKeys({
      privateKeyPkcs8Base64: signingKeys.privateKeyPkcs8Base64,
      publicKeySpkiBase64: verificationKeys.publicKeySpkiBase64,
    });
    const { signExtensionToken, verifyExtensionToken } =
      await importExtensionCrypto();

    const token = await signExtensionToken({
      iss: EXTENSION_HANDOFF_TOKEN_ISSUER,
      aud: EXTENSION_HANDOFF_TOKEN_AUDIENCE,
      sub: "user:42",
      authSessionId: "session-1",
      branchId: "7",
      assignmentId: "13",
      contactId: "19",
      phone: "+51999999999",
      clientName: null,
      organizationLabel: null,
      action: "start_call",
      origin: "http://localhost:3000",
      jti: crypto.randomUUID(),
      iat: 1_700_000_000,
      exp: 1_700_000_120,
    });

    await expect(
      verifyExtensionToken(token, isExtensionHandoffClaims),
    ).rejects.toThrow("invalid token signature");
  });
});
