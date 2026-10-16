import { operationAt } from "@tests/support/operation";
import { createTestPasskeyProvider } from "@tests/support/passkey/api";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { submitPasswordLogin } from "~/server/auth/flows/submit-password-login";
import { createAuthLoginContext } from "~/server/auth/infrastructure/login-context";
import { isErr } from "~/shared/result";

import { BENCH_NOW } from "../_shared/constants";
import { createBenchDbFixture } from "../_shared/fixture";
import { SINGLE_CALL } from "../_shared/options";
import {
  LOGIN_PASSWORD,
  type LoginFixture,
  resetLoginState,
  seedAuthLoginUser,
} from "./fixtures";

describe("auth login service benchmark", () => {
  const db = createBenchDbFixture("bench-auth-login-service");
  let fixture: LoginFixture;

  beforeAll(async () => {
    const ctx = await db.setup();
    fixture = await seedAuthLoginUser(ctx);
  });

  afterAll(async () => {
    await db.teardown();
  });

  test("service path: authenticate password login", async ({ bench }) => {
    const result = await bench(
      "service path: authenticate password login",
      {
        beforeEach: async () => {
          await resetLoginState(db.ctx(), fixture.userId);
        },
      },
      async () => {
        const ctx = db.ctx();
        const loginResult = await submitPasswordLogin(
          {
            identifier: fixture.username,
            password: LOGIN_PASSWORD,
            ipAddress: fixture.ipAddress,
            userAgent: "codspeed-bench",
          },
          createAuthLoginContext(ctx.db),
          createTestPasskeyProvider(ctx.repos),
          operationAt(BENCH_NOW),
        );

        if (
          isErr(loginResult) ||
          loginResult.value.kind !== "complete" ||
          !loginResult.value.result.token
        ) {
          throw new Error("expected non-empty session token");
        }
      },
    ).run(SINGLE_CALL);
    expect(result.state).toBe("completed");
  });
});
