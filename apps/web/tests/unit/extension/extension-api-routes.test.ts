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
  it.each([
    ["handoff token", postHandoffToken, "/api/extension/handoff-token"],
    ["claim", postClaim, "/api/extension/session/claim"],
    ["refresh", postRefresh, "/api/extension/session/refresh"],
    ["events", postEvents, "/api/extension/events"],
  ])(
    "returns 400 for malformed JSON in the %s route",
    async (_, post, path) => {
      const response = await post({
        request: invalidJsonRequest(`http://localhost${path}`),
      });

      expect(response.status).toBe(400);
    },
  );
});
