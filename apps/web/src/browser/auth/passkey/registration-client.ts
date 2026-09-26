import type {
  PublicKeyCredentialCreationOptionsJSON,
  RegistrationResponseJSON,
} from "@simplewebauthn/server";

import { decodeBase64Url, encodeBase64Url } from "./client-shared";

const REGISTRATION_TRANSPORTS = new Set([
  "ble",
  "cable",
  "hybrid",
  "internal",
  "nfc",
  "smart-card",
  "usb",
]);

export function isPasskeyRegistrationSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof PublicKeyCredential !== "undefined" &&
    typeof navigator.credentials?.create === "function"
  );
}

export async function createRegistrationResponse(
  options: PublicKeyCredentialCreationOptionsJSON,
): Promise<RegistrationResponseJSON> {
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: decodeBase64Url(options.challenge),
      rp: options.rp,
      user: {
        ...options.user,
        id: decodeBase64Url(options.user.id),
      },
      pubKeyCredParams: options.pubKeyCredParams,
      timeout: options.timeout,
      attestation: options.attestation,
      authenticatorSelection: options.authenticatorSelection,
      excludeCredentials: options.excludeCredentials?.map((descriptor) => ({
        id: decodeBase64Url(descriptor.id),
        type: "public-key",
      })),
    },
  });

  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("No se pudo crear la clave de acceso");
  }

  if (!(credential.response instanceof AuthenticatorAttestationResponse)) {
    throw new Error("Invalid passkey registration response");
  }

  const transports =
    typeof credential.response.getTransports === "function"
      ? normalizeRegistrationTransports(credential.response.getTransports())
      : undefined;

  return {
    id: credential.id,
    rawId: encodeBase64Url(credential.rawId),
    type: "public-key",
    response: transports
      ? {
          clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
          attestationObject: encodeBase64Url(
            credential.response.attestationObject,
          ),
          transports,
        }
      : {
          clientDataJSON: encodeBase64Url(credential.response.clientDataJSON),
          attestationObject: encodeBase64Url(
            credential.response.attestationObject,
          ),
        },
    clientExtensionResults: credential.getClientExtensionResults(),
  };
}

function normalizeRegistrationTransports(transports: string[]): string[] {
  return transports.filter((transport) =>
    REGISTRATION_TRANSPORTS.has(transport),
  );
}
