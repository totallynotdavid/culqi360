import { describe, expect, it } from "vitest";

import { POST as postEvents } from "~/routes/api/extension/events";
import { POST as postHandoffToken } from "~/routes/api/extension/handoff-token";
import { POST as postClaim } from "~/routes/api/extension/session/claim";
import { POST as postRefresh } from "~/routes/api/extension/session/refresh";

function invalidJsonRequest(url: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: "http://localhost:3000",
      authorization: "Bearer token",
    },
    body: "{",
  });
}

describe("extension api routes", () => {
  it("returns 400 for malformed JSON in the handoff token route", async () => {
    const response = await postHandoffToken({
      request: invalidJsonRequest(
        "http://localhost/api/extension/handoff-token",
      ),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON in the claim route", async () => {
    const response = await postClaim({
      request: invalidJsonRequest(
        "http://localhost/api/extension/session/claim",
      ),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON in the refresh route", async () => {
    const response = await postRefresh({
      request: invalidJsonRequest(
        "http://localhost/api/extension/session/refresh",
      ),
    });

    expect(response.status).toBe(400);
  });

  it("returns 400 for malformed JSON in the events route", async () => {
    const response = await postEvents({
      request: invalidJsonRequest("http://localhost/api/extension/events"),
    });

    expect(response.status).toBe(400);
  });
});
