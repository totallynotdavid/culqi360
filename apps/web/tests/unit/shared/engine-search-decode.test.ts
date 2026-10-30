import { createServer, type Server } from "node:http";

import {
  makeCompanyResult,
  makeDocumentResult,
} from "@tests/support/shared/search-row";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createEngineAdapter } from "~/server/integrations/engine/http-client";
import { isPlainRecord } from "~/shared/type-guards";

let server: Server;
let responseBody: unknown;
let lastRequestId: string | undefined;

function searchWith(body: unknown) {
  responseBody = body;
  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("test server is not listening on a port");
  }
  const adapter = createEngineAdapter({
    baseUrl: `http://127.0.0.1:${address.port}`,
    keyId: "web",
    hmacSecret: "k7vB9pL2mN5qR4xT1yZ8wS3uJ6hA0gC9",
    timeoutMs: 5_000,
    uploadTimeoutMs: 5_000,
  });
  return adapter.search("people", "garcia");
}

// Returns a copy of the row with the value at `path` replaced. An undefined
// value removes the key, which is how a missing field reaches the decoder.
function withField(row: unknown, path: string[], value: unknown): unknown {
  const [key, ...rest] = path;
  if (key === undefined) {
    return value;
  }
  if (!isPlainRecord(row)) {
    throw new Error(`path leaves the row at ${key}`);
  }
  const { [key]: child, ...siblings } = row;
  const replaced = withField(child, rest, value);
  return replaced === undefined ? siblings : { ...siblings, [key]: replaced };
}

beforeAll(async () => {
  server = createServer((request, response) => {
    lastRequestId = String(request.headers["x-request-id"]);
    response.setHeader("Content-Type", "application/json");
    response.end(JSON.stringify(responseBody));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("engine search response decoding", () => {
  const person = makeDocumentResult({
    phone_primary: "999111222",
    org_ruc: "20100000001",
    org_name: "ACME SAC",
    sibling_phones: ["999333444"],
  });
  const companyPerson = {
    doc_type: "DNI",
    doc_number: "12345678",
    name: "JUAN PEREZ",
    role_name: null,
    role_start_date: null,
  };
  const company = makeCompanyResult({
    ruc: "20100000001",
    people: [companyPerson],
  });

  it("returns every row of a valid response", async () => {
    const result = await searchWith({ results: [person, company], count: 2 });

    expect(result).toEqual({ ok: true, value: [person, company] });
  });

  it("accepts an empty result set", async () => {
    const result = await searchWith({ results: [], count: 0 });

    expect(result).toEqual({ ok: true, value: [] });
  });

  it.each([
    ["a bare array", []],
    ["a missing results array", { count: 0 }],
    ["a non-array results", { results: "none", count: 0 }],
    ["a missing count", { results: [] }],
    ["a null body", null],
  ])("rejects %s as an invalid Engine response", async (_label, body) => {
    const result = await searchWith(body);

    expect(lastRequestId).toBeTruthy();
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "external",
        code: "engine_response_invalid",
        internalMessage: "Invalid SearchResponse structure",
        details: { request_id: lastRequestId },
      },
    });
  });

  it("names the bad row and carries the request id when one row is malformed", async () => {
    const broken = withField(person, ["doc"], undefined);

    const result = await searchWith({
      results: [person, company, broken],
      count: 3,
    });

    expect(lastRequestId).toBeTruthy();
    expect(result).toMatchObject({
      ok: false,
      error: {
        kind: "external",
        code: "engine_response_invalid",
        internalMessage: "Invalid SearchResponse row at results[2]",
        details: { request_id: lastRequestId },
      },
    });
  });

  it.each([
    ["a missing doc", withField(person, ["doc"], undefined)],
    ["a null doc", withField(person, ["doc"], null)],
    ["null phones", withField(person, ["phones"], null)],
    ["missing phones", withField(person, ["phones"], undefined)],
    [
      "a non-array sibling list",
      withField(person, ["phones", "siblings"], "1"),
    ],
    [
      "a numeric sibling entry",
      withField(person, ["phones", "siblings"], [999333444]),
    ],
    [
      "a missing nullable field",
      withField(person, ["doc", "email"], undefined),
    ],
    [
      "a numeric doc_number",
      withField(person, ["doc", "doc_number"], 12345678),
    ],
    ["a missing org", withField(person, ["org"], undefined)],
    ["a malformed org", withField(person, ["org", "ruc"], 1)],
    ["a missing role", withField(person, ["role"], undefined)],
    ["a missing company", withField(company, ["company"], undefined)],
    ["a non-integer company id", withField(company, ["company", "id"], "20")],
    ["a null company ruc", withField(company, ["company", "ruc"], null)],
    ["a missing people list", withField(company, ["people"], undefined)],
    ["a non-array people list", withField(company, ["people"], null)],
    [
      "a numeric person name",
      withField(company, ["people"], [{ ...companyPerson, name: 1 }]),
    ],
    ["an unknown kind", withField(person, ["kind"], "branch")],
    ["a missing kind", withField(person, ["kind"], undefined)],
    ["a non-object row", null],
  ])("rejects a row with %s", async (_label, row) => {
    const result = await searchWith({ results: [company, row], count: 2 });

    expect(result).toMatchObject({
      ok: false,
      error: {
        code: "engine_response_invalid",
        internalMessage: "Invalid SearchResponse row at results[1]",
        details: { request_id: lastRequestId },
      },
    });
  });
});
