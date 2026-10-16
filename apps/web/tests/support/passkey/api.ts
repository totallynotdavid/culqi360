import type { PublicKeyCredentialCreationOptionsJSON } from "@simplewebauthn/server";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

import type { UserId } from "~/domain/ids";
import {
  createPasskeyProvider,
  PasskeyRequestError,
  resolveWebauthnRelyingParty,
  type PasskeyProviderDeps,
  type VerifiedRegistrationCredential,
} from "~/server/auth/factors/passkey-provider";

import type { TestDbContext } from "../runtime/db";

const TEST_RELYING_PARTY = resolveWebauthnRelyingParty("http://localhost:5173");

export function createTestPasskeyProvider(repos: PasskeyProviderDeps) {
  return createPasskeyProvider(repos, TEST_RELYING_PARTY);
}

type WebauthnOverrides = {
  getRegistrationOptions?: (
    userId: UserId,
  ) => Promise<PublicKeyCredentialCreationOptionsJSON>;
  verifyRegistration?: (
    userId: UserId,
    response: RegistrationResponseJSON,
    challenge: string,
  ) => Promise<{
    verified: boolean;
    credential?: VerifiedRegistrationCredential;
  }>;
  verifyAuthentication?: () => Promise<{
    verified: boolean;
    credentialId?: string;
    newCounter?: number;
    previousCounter?: number;
    userId: UserId;
  }>;
};

interface PasskeyCredentialResponse {
  id: string;
  rawId: string;
  type: "public-key";
  clientExtensionResults: Record<string, never>;
}

function expiresAtFromNow(nowMs: number): Date {
  return new Date(nowMs + 60_000);
}

export async function createAuthFlow(input: {
  ctx: TestDbContext;
  userId: UserId;
  challenge: string;
  identifier?: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  const challengeId = await input.ctx.repos.webauthnChallenges.create({
    user_id: input.userId,
    type: "authentication",
    challenge: input.challenge,
    expires_at: expiresAtFromNow(nowMs),
    created_at: new Date(nowMs),
  });
  const flowId = await input.ctx.repos.loginFlows.create({
    identifier: input.identifier ?? "exec.one",
    primary_auth_method: "passkey",
    user_id: input.userId,
    challenge_id: challengeId,
    state: "passkey",
    expires_at: expiresAtFromNow(nowMs),
    created_at: new Date(nowMs),
  });
  return { challengeId, flowId };
}

export async function createRegistrationChallenge(input: {
  ctx: TestDbContext;
  userId: UserId;
  challenge: string;
  nowMs?: number;
}) {
  const nowMs = input.nowMs ?? Date.now();
  return input.ctx.repos.webauthnChallenges.create({
    user_id: input.userId,
    type: "registration",
    challenge: input.challenge,
    expires_at: expiresAtFromNow(nowMs),
    created_at: new Date(nowMs),
  });
}

export function createWebauthnProvider(overrides: WebauthnOverrides = {}) {
  return {
    async getRegistrationOptions(userId: UserId) {
      if (overrides.getRegistrationOptions) {
        return overrides.getRegistrationOptions(userId);
      }
      throw new Error("not used in this test");
    },
    async verifyRegistration(
      userId: UserId,
      response: RegistrationResponseJSON,
      challenge: string,
    ) {
      if (overrides.verifyRegistration) {
        const result = await overrides.verifyRegistration(
          userId,
          response,
          challenge,
        );
        return {
          verified: result.verified,
          credential: result.credential ?? {
            id: response.id,
            publicKey: Buffer.from("test-public-key").toString("base64"),
            counter: 0,
            transports: JSON.stringify(["internal"]),
          },
        };
      }
      throw new Error("not used in this test");
    },
    async getAuthenticationOptions() {
      throw new Error("not used in this test");
    },
    async getAuthenticationOptionsForChallenge() {
      throw new Error("not used in this test");
    },
    async verifyAuthentication() {
      if (overrides.verifyAuthentication) {
        const result = await overrides.verifyAuthentication();
        return {
          ...result,
          credentialId: result.credentialId ?? "passkey-1",
          newCounter: result.newCounter ?? 1,
          previousCounter: result.previousCounter ?? 0,
        };
      }
      throw new Error("not used in this test");
    },
  };
}

export function createWebauthnProviderWithAuth(
  verifyAuthentication: NonNullable<WebauthnOverrides["verifyAuthentication"]>,
) {
  return createWebauthnProvider({ verifyAuthentication });
}

export function createWebauthnProviderWithRegistration(
  verifyRegistration: NonNullable<WebauthnOverrides["verifyRegistration"]>,
) {
  return createWebauthnProvider({ verifyRegistration });
}

export function buildAssertionResponse(
  credentialId = "passkey-1",
): PasskeyCredentialResponse & {
  response: {
    authenticatorData: string;
    clientDataJSON: string;
    signature: string;
  };
} {
  return {
    id: credentialId,
    rawId: credentialId,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      authenticatorData: "a",
      clientDataJSON: "b",
      signature: "c",
    },
  };
}

export function buildRegistrationResponse(
  credentialId = "cred-r1",
): PasskeyCredentialResponse & {
  response: {
    clientDataJSON: string;
    attestationObject: string;
  };
} {
  return {
    id: credentialId,
    rawId: credentialId,
    type: "public-key",
    clientExtensionResults: {},
    response: {
      clientDataJSON: "a",
      attestationObject: "b",
    },
  };
}

export function invalidRegistrationProvider() {
  return createWebauthnProvider({
    async verifyRegistration() {
      throw new PasskeyRequestError("invalid registration");
    },
  });
}
