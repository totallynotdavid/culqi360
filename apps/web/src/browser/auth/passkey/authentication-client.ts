import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";

import { decodeBase64Url, encodeBase64Url } from "./client-shared";

export function isPasskeyAuthenticationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.get === "function"
  );
}

export async function createAuthenticationResponse(
  options: PublicKeyCredentialRequestOptionsJSON,
): Promise<AuthenticationResponseJSON> {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: decodeBase64Url(options.challenge),
      timeout: options.timeout,
      rpId: options.rpId,
      userVerification: options.userVerification,
      allowCredentials: options.allowCredentials?.map((descriptor) => ({
        id: decodeBase64Url(descriptor.id),
        type: "public-key",
      })),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("Respuesta de credencial invalida");
  }

  if (!(credential.response instanceof AuthenticatorAssertionResponse)) {
    throw new Error("Invalid passkey assertion response");
  }

  const userHandle = credential.response.userHandle
    ? encodeBase64Url(credential.response.userHandle)
    : undefined;

  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: "public-key",
    response: {
      authenticatorData: encodeBase64Url(credential.response.authenticatorData),
      clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
      signature: encodeBase64Url(credential.response.signature),
      ...(userHandle ? { userHandle } : {}),
    },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}
