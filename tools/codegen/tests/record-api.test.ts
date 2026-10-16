import { describe, expect, test } from "bun:test";

import {
  parseRecordApiSpec,
  renderRecordContractRust,
  renderRecordContractTs,
} from "../src/record-api.ts";

const VALID_SPEC = {
  response: {
    candidate: {
      fields: [
        { name: "ruc", type: "string" },
        { name: "person_name", type: "string" },
        { name: "phone_primary", type: "string" },
      ],
    },
  },
  request: {
    import_row: {
      fields: [
        { name: "ruc", type: "string" },
        { name: "dni", type: "string" },
        { name: "quality_tier", type: "i32", optional: true },
        { name: "branch_tag", type: "i64", optional: true },
      ],
    },
  },
};

describe("parseRecordApiSpec", () => {
  test("accepts a valid spec and defaults optional to false", () => {
    const spec = parseRecordApiSpec(VALID_SPEC);
    const requestFields = spec.request.import_row.fields;

    expect(spec.response.candidate.fields).toHaveLength(3);
    expect(requestFields).toHaveLength(4);
    expect(spec.response.candidate.fields[0]!.optional).toBe(false);
    expect(requestFields.find((f) => f.name === "quality_tier")!.optional).toBe(
      true,
    );
  });

  test("rejects non-object input", () => {
    expect(() => parseRecordApiSpec(null)).toThrow();
    expect(() => parseRecordApiSpec("string")).toThrow();
  });

  test("rejects missing response", () => {
    expect(() => parseRecordApiSpec({ request: VALID_SPEC.request })).toThrow(
      "response",
    );
  });

  test("rejects missing request", () => {
    expect(() => parseRecordApiSpec({ response: VALID_SPEC.response })).toThrow(
      "request",
    );
  });

  test("rejects invalid field type", () => {
    expect(() =>
      parseRecordApiSpec({
        ...VALID_SPEC,
        response: {
          candidate: { fields: [{ name: "x", type: "float" }] },
        },
      }),
    ).toThrow('"string" | "i32" | "i64"');
  });

  test("rejects non-boolean optional", () => {
    expect(() =>
      parseRecordApiSpec({
        ...VALID_SPEC,
        request: {
          import_row: {
            fields: [{ name: "x", type: "string", optional: "yes" }],
          },
        },
      }),
    ).toThrow("boolean");
  });
});

describe("record contract rendering", () => {
  const spec = parseRecordApiSpec(VALID_SPEC);

  test("Rust wraps optional fields in Option and leaves required ones bare", () => {
    const output = renderRecordContractRust(spec);

    expect(output).toContain("pub quality_tier: Option<i32>");
    expect(output).toContain("pub branch_tag: Option<i64>");
    expect(output).toContain("pub ruc: String");
    expect(output).not.toContain("pub ruc: Option<String>");
  });

  test("TypeScript marks optional fields with ? and maps integers to number", () => {
    const output = renderRecordContractTs(spec);

    expect(output).toContain("quality_tier?: number");
    expect(output).toContain("branch_tag?: number");
    expect(output).toContain("ruc: string;");
    expect(output).not.toContain("ruc?:");
  });
});
