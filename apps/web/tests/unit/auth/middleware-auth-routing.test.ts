import { createRequestContext } from "@tests/support/auth/request-context";
import { makeAuthSession } from "@tests/support/unit/factories";
import { describe, expect, it } from "vitest";

import { enforceAuthRequest } from "~/server/platform/http/request-auth";

describe("auth middleware routing", () => {
  it("redirects to /login when private route has no session", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/home"),
      locals: { nonce: "nonce", requestContext: createRequestContext(null) },
    });

    expect(decision.kind).toBe("redirect_login");
  });

  it("keeps validated session on request context", async () => {
    const session = makeAuthSession({ role: "executive" });
    const event = {
      request: new Request("http://localhost:3000/records"),
      locals: { nonce: "nonce", requestContext: createRequestContext(session) },
    };

    const decision = await enforceAuthRequest(event);

    expect(decision.kind).toBe("allow");
    expect(event.locals.requestContext.principal).toEqual(session);
  });

  it("redirects to onboarding when session is not onboarded", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/home"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "executive", sessionClass: "pre_auth" }),
        ),
      },
    });

    expect(decision.kind).toBe("redirect_onboarding");
  });

  it("redirects onboarded users away from onboarding", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/onboarding"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "executive" }),
        ),
      },
    });

    expect(decision.kind).toBe("redirect_home");
    if (decision.kind !== "redirect_home") {
      throw new Error("Expected redirect");
    }
    expect(decision.to).toBe("/home");
  });

  it("redirects users from routes they cannot access", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/settings/event-logs"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "executive" }),
        ),
      },
    });

    expect(decision.kind).toBe("redirect_home");
    if (decision.kind !== "redirect_home") {
      throw new Error("Expected redirect");
    }
    expect(decision.to).toBe("/home");
  });

  it("redirects authenticated users from root to home route", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "logistics" }),
        ),
      },
    });

    expect(decision.kind).toBe("redirect_home");
    if (decision.kind !== "redirect_home") {
      throw new Error("Expected redirect");
    }
    expect(decision.to).toBe("/inventory");
  });

  it("allows users to access permitted routes", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/settings/profile"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "admin" }),
        ),
      },
    });

    expect(decision.kind).toBe("allow");
  });

  it("allows not-onboarded users to reach onboarding", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/onboarding"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(
          makeAuthSession({ role: "executive", sessionClass: "pre_auth" }),
        ),
      },
    });

    expect(decision.kind).toBe("allow");
  });

  it("restricts recovery-setup sessions to the recovery-code route", async () => {
    const session = makeAuthSession({ sessionClass: "recovery_setup" });
    const redirected = await enforceAuthRequest({
      request: new Request("http://localhost:3000/records"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(session),
      },
    });
    const allowed = await enforceAuthRequest({
      request: new Request("http://localhost:3000/recovery-codes"),
      locals: {
        nonce: "nonce",
        requestContext: createRequestContext(session),
      },
    });

    expect(redirected.kind).toBe("redirect_recovery_setup");
    expect(allowed.kind).toBe("allow");
  });

  it("rejects an unauthenticated API request with 401 instead of a redirect", async () => {
    const decision = await enforceAuthRequest({
      request: new Request("http://localhost:3000/api/me/avatar"),
      locals: { nonce: "nonce", requestContext: createRequestContext(null) },
    });

    expect(decision.kind).toBe("reject");
    if (decision.kind !== "reject") {
      throw new Error("Expected reject");
    }
    expect(decision.response.status).toBe(401);
  });
});
