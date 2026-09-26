import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createRegistrationResponse } from "~/browser/auth/passkey/registration-client";

class TestAuthenticatorAttestationResponse {
  readonly attestationObject = new Uint8Array([2]).buffer;
  readonly clientDataJSON = new Uint8Array([1]).buffer;

  getTransports() {
    return ["usb", "smart-card", "future-transport"];
  }
}

class TestPublicKeyCredential {
  readonly id = "credential-id";
  readonly rawId = new Uint8Array([3]).buffer;
  readonly response = new TestAuthenticatorAttestationResponse();

  getClientExtensionResults() {
    return {};
  }
}

describe("passkey registration client", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("preserves supported transports and filters unknown runtime values", async () => {
    const credential = new TestPublicKeyCredential();
    const create = async () => credential;

    vi.stubGlobal("PublicKeyCredential", TestPublicKeyCredential);
    vi.stubGlobal(
      "AuthenticatorAttestationResponse",
      TestAuthenticatorAttestationResponse,
    );
    vi.stubGlobal("navigator", { credentials: { create } });

    const response = await createRegistrationResponse({
      rp: { name: "Example" },
      user: { id: "dXNlcg", name: "user", displayName: "User" },
      challenge: "Y2hhbGxlbmdl",
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
    } satisfies PublicKeyCredentialCreationOptionsJSON);

    expect(response.response.transports).toEqual(["usb", "smart-card"]);
  });
});
