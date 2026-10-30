import { describe, expect, test } from "bun:test";

import { groupByObject } from "../src/search-projection/group.ts";
import { parseProjectionSpec } from "../src/search-projection/parse.ts";
import {
  renderProjectionContractRust,
  renderResultContractRust,
} from "../src/search-projection/render-rust.ts";
import { renderResultContractTs } from "../src/search-projection/render-ts.ts";

const SPEC = {
  projection: "search_projection",
  fields: [
    {
      path: "company.id",
      canonical_fields: ["company_id"],
      nullable: false,
      value_type: "integer",
      storage: [{ table: "search_projection", column: "company_id" }],
    },
    {
      path: "person.dni",
      canonical_fields: ["person_dni"],
      nullable: false,
      storage: [{ table: "search_projection", column: "dni" }],
    },
    {
      path: "person.name",
      canonical_fields: ["person_full_name"],
      nullable: true,
      storage: [{ table: "search_projection", column: "name" }],
    },
    {
      path: "org.ruc",
      canonical_fields: ["company_ruc"],
      nullable: true,
      storage: [{ table: "search_projection", column: "org_ruc" }],
    },
    {
      path: "phones.siblings",
      canonical_fields: ["phone"],
      nullable: true,
      value_type: "string_array",
      derivation: "grouped_phone_aggregate",
      storage: [
        { table: "ruc_phone_agg", column: "phones" },
        { table: "dni_phone_agg", column: "phones" },
      ],
    },
  ],
};

describe("parseProjectionSpec", () => {
  test("applies defaults and preserves explicit values", () => {
    const spec = parseProjectionSpec(SPEC);

    expect(spec.projection).toBe("search_projection");
    expect(spec.fields).toHaveLength(5);

    expect(spec.fields[1]!.value_type).toBe("string");
    expect(spec.fields[0]!.nullable).toBe(false);
    expect(spec.fields[2]!.nullable).toBe(true);
    expect(spec.fields[4]!.derivation).toBe("grouped_phone_aggregate");
    expect(spec.fields[4]!.storage).toHaveLength(2);
  });

  test("rejects invalid root input", () => {
    expect(() => parseProjectionSpec(null)).toThrow();
    expect(() => parseProjectionSpec(42)).toThrow();
  });

  test("rejects invalid storage mappings", () => {
    expect(() =>
      parseProjectionSpec({
        ...SPEC,
        fields: [{ ...SPEC.fields[0], storage: [] }],
      }),
    ).toThrow("non-empty");

    expect(() =>
      parseProjectionSpec({
        ...SPEC,
        fields: [
          {
            ...SPEC.fields[0],
            storage: [{ table: "", column: "company_id" }],
          },
        ],
      }),
    ).toThrow("non-empty");
  });
});

describe("groupByObject", () => {
  test("groups by object prefix and preserves preferred ordering", () => {
    const spec = parseProjectionSpec(SPEC);
    const groups = groupByObject(spec.fields);
    const names = groups.map((g) => g.objectName);

    expect(names).toEqual(["company", "org", "phones", "person"]);
  });

  test("throws when field path is not object.property", () => {
    expect(() =>
      groupByObject([
        {
          path: "nodot",
          canonical_fields: ["x"],
          nullable: false,
          value_type: "string",
          derivation: undefined,
          storage: [{ table: "t", column: "c" }],
        },
      ]),
    ).toThrow("object.property");
  });
});

describe("renderProjectionContract", () => {
  test("Rust emits nullable paths and storage mappings", () => {
    const rust = renderProjectionContractRust(
      parseProjectionSpec(SPEC),
      "SEARCH_PROJECTION",
      "contracts/engine/search-projection.json",
    );

    expect(rust).toContain('"person.name"');
    expect(rust).toContain('"ruc_phone_agg"');
    expect(rust).toContain('"dni_phone_agg"');

    const start = rust.indexOf("SEARCH_PROJECTION_NULLABLE_PATHS");
    const nullableSection = rust.slice(start, rust.indexOf("];", start));
    expect(nullableSection).toContain('"person.name"');
    expect(nullableSection).not.toContain('"person.dni"');
  });
});

describe("renderResultContract", () => {
  test("maps value types and nullability consistently in Rust + TS", () => {
    const spec = parseProjectionSpec(SPEC);

    const rust = renderResultContractRust(spec, spec);
    const ts = renderResultContractTs(spec, spec);

    expect(rust).toContain("pub id: i64");
    expect(rust).toContain("pub name: Option<String>");
    expect(rust).toContain("pub siblings: Option<Vec<String>>");
    expect(rust).toContain("pub org: Option<OrgInfo>");

    expect(ts).toContain("id: number;");
    expect(ts).toContain("name: string | null;");
    expect(ts).toContain("siblings: string[] | null;");
    expect(ts).toContain("org: OrgInfo | null;");
  });

  test("a people object is a list of PersonInfo in Rust + TS", () => {
    const spec = parseProjectionSpec({
      projection: "people_projection",
      fields: [
        SPEC.fields[0],
        {
          path: "people.name",
          canonical_fields: ["rep_name"],
          nullable: true,
          storage: [{ table: "company_people_projection", column: "name" }],
        },
      ],
    });

    const rust = renderResultContractRust(spec, spec);
    const ts = renderResultContractTs(spec, spec);

    expect(rust).toContain("pub people: Vec<PersonInfo>");
    expect(ts).toContain("people: PersonInfo[];");
    expect(ts).toContain("isArrayOf(value.people, isPersonInfo)");
  });

  test("TS guards check the same fields the interfaces declare", () => {
    const spec = parseProjectionSpec(SPEC);
    const ts = renderResultContractTs(spec, spec);

    expect(ts).toContain("isInteger(value.id)");
    expect(ts).toContain("isString(value.dni) &&");
    expect(ts).toContain("isNullable(value.name, isString)");
    expect(ts).toContain("isNullable(value.siblings, isStringArray)");
    expect(ts).toContain("isNullable(value.org, isOrgInfo)");
    expect(ts).toContain("export function isSearchResult(");
  });
});
