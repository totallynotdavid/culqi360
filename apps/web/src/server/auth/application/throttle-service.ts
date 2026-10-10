import { buildThrottleKeys } from "~/server/auth/password/throttle-keys";
import {
  AUTH_THROTTLE_POLICY,
  AUTH_THROTTLE_SCOPES,
  type AuthThrottleEndpoint,
} from "~/server/auth/password/throttle-policy";
import {
  calculateBlockMs,
  isThrottleWindowExpired,
} from "~/server/auth/password/throttle-state";
import type { AuthThrottleRepo } from "~/server/auth/repos-auth-throttle";

type CheckResult = { allowed: true } | { allowed: false; retryAfterMs: number };

export interface AuthThrottleServiceDeps {
  authThrottle: AuthThrottleRepo;
}

export function createAuthThrottleService(deps: AuthThrottleServiceDeps) {
  function findScopeRows(keyMap: ReturnType<typeof buildThrottleKeys>) {
    return Promise.all(
      AUTH_THROTTLE_SCOPES.map(async (scope) => ({
        scope,
        row: await deps.authThrottle.findByScopeAndKey(scope, keyMap[scope]),
      })),
    );
  }

  async function checkThrottle(
    endpoint: AuthThrottleEndpoint,
    identifier: string,
    ipAddress: string,
    attemptedAt: Date,
  ): Promise<CheckResult> {
    const keyMap = buildThrottleKeys(endpoint, identifier, ipAddress);
    const scopeRows = await findScopeRows(keyMap);

    for (const { scope, row } of scopeRows) {
      if (
        !row ||
        isThrottleWindowExpired(
          endpoint,
          scope,
          attemptedAt,
          row.window_started_at,
        )
      ) {
        continue;
      }
      if (row.blocked_until && row.blocked_until > attemptedAt) {
        return {
          allowed: false,
          retryAfterMs: row.blocked_until.getTime() - attemptedAt.getTime(),
        };
      }
    }

    return { allowed: true };
  }

  async function recordFailure(
    endpoint: AuthThrottleEndpoint,
    identifier: string,
    ipAddress: string,
    failedAt: Date,
  ): Promise<void> {
    const keyMap = buildThrottleKeys(endpoint, identifier, ipAddress);

    const scopeRows = await findScopeRows(keyMap);
    await Promise.all(
      scopeRows.map(({ scope, row }) => {
        const reset =
          !row ||
          isThrottleWindowExpired(
            endpoint,
            scope,
            failedAt,
            row.window_started_at,
          );
        const failures = reset ? 1 : row.failure_count + 1;
        const block =
          failures > AUTH_THROTTLE_POLICY[endpoint][scope].threshold;
        const blockedUntil = block
          ? new Date(
              failedAt.getTime() + calculateBlockMs(endpoint, scope, failures),
            )
          : null;
        return deps.authThrottle.upsert({
          scope,
          key_hash: keyMap[scope],
          window_started_at: reset ? failedAt : row.window_started_at,
          failure_count: failures,
          blocked_until: blockedUntil,
          updated_at: failedAt,
        });
      }),
    );
  }

  async function clearFailureState(
    endpoint: AuthThrottleEndpoint,
    identifier: string,
    ipAddress: string,
  ): Promise<void> {
    const keyMap = buildThrottleKeys(endpoint, identifier, ipAddress);
    await deps.authThrottle.deleteByScopeAndKey("account", keyMap.account);
    await deps.authThrottle.deleteByScopeAndKey(
      "ip_account",
      keyMap.ip_account,
    );
  }

  return {
    checkLoginThrottle(
      email: string,
      ipAddress: string,
      attemptedAt: Date,
    ): Promise<CheckResult> {
      return checkThrottle("password_login", email, ipAddress, attemptedAt);
    },

    recordLoginFailure(
      email: string,
      ipAddress: string,
      failedAt: Date,
    ): Promise<void> {
      return recordFailure("password_login", email, ipAddress, failedAt);
    },

    clearLoginFailureState(email: string, ipAddress: string): Promise<void> {
      return clearFailureState("password_login", email, ipAddress);
    },

    checkPasskeyChallengeThrottle(
      identifier: string,
      ipAddress: string,
      attemptedAt: Date,
    ): Promise<CheckResult> {
      return checkThrottle(
        "passkey_challenge",
        identifier,
        ipAddress,
        attemptedAt,
      );
    },

    recordPasskeyChallengeFailure(
      identifier: string,
      ipAddress: string,
      failedAt: Date,
    ): Promise<void> {
      return recordFailure(
        "passkey_challenge",
        identifier,
        ipAddress,
        failedAt,
      );
    },

    checkPasskeyVerifyThrottle(
      identifier: string,
      ipAddress: string,
      attemptedAt: Date,
    ): Promise<CheckResult> {
      return checkThrottle(
        "passkey_verify",
        identifier,
        ipAddress,
        attemptedAt,
      );
    },

    recordPasskeyVerifyFailure(
      identifier: string,
      ipAddress: string,
      failedAt: Date,
    ): Promise<void> {
      return recordFailure("passkey_verify", identifier, ipAddress, failedAt);
    },

    clearPasskeyVerifyFailureState(
      identifier: string,
      ipAddress: string,
    ): Promise<void> {
      return clearFailureState("passkey_verify", identifier, ipAddress);
    },

    checkTotpVerifyThrottle(
      identifier: string,
      ipAddress: string,
      attemptedAt: Date,
    ): Promise<CheckResult> {
      return checkThrottle("totp_verify", identifier, ipAddress, attemptedAt);
    },

    recordTotpVerifyFailure(
      identifier: string,
      ipAddress: string,
      failedAt: Date,
    ): Promise<void> {
      return recordFailure("totp_verify", identifier, ipAddress, failedAt);
    },

    clearTotpVerifyFailureState(
      identifier: string,
      ipAddress: string,
    ): Promise<void> {
      return clearFailureState("totp_verify", identifier, ipAddress);
    },

    checkRecoveryVerifyThrottle(
      identifier: string,
      ipAddress: string,
      attemptedAt: Date,
    ): Promise<CheckResult> {
      return checkThrottle(
        "recovery_verify",
        identifier,
        ipAddress,
        attemptedAt,
      );
    },

    recordRecoveryVerifyFailure(
      identifier: string,
      ipAddress: string,
      failedAt: Date,
    ): Promise<void> {
      return recordFailure("recovery_verify", identifier, ipAddress, failedAt);
    },

    clearRecoveryVerifyFailureState(
      identifier: string,
      ipAddress: string,
    ): Promise<void> {
      return clearFailureState("recovery_verify", identifier, ipAddress);
    },
  };
}

export type AuthThrottleService = ReturnType<typeof createAuthThrottleService>;
