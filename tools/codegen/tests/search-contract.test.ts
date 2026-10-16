import { describe, expect, test } from "bun:test";

import { checkSearchContract } from "../src/search-contract/check.ts";
import type { LoadedSource } from "../src/search-contract/check.ts";
import {
  parseCanonicalContract,
  parseSourceContract,
  parseSourceManifest,
  parseSourceMapping,
} from "../src/search-contract/parse.ts";
import { parseProjectionSpec } from "../src/search-projection/parse.ts";

const CANONICAL = parseCanonicalContract({
  fields: ["person_dni", "company_ruc", "company_name", "phone"],
});

const SOURCE_CONTRACT = parseSourceContract({
  sources: [
    {
      source_key: "phones",
      required_canonical_fields: ["person_dni"],
      requires_any_phone_input: true,
    },
    {
      source_key: "padron_ruc",
      required_canonical_fields: ["company_ruc", "company_name"],
    },
  ],
});

const PROJECTION = parseProjectionSpec({
  projection: "search_projection",
  fields: [
    {
      path: "person.dni",
      canonical_fields: ["person_dni"],
      nullable: false,
      storage: [{ table: "search_projection", column: "dni" }],
    },
    {
      path: "org.ruc",
      canonical_fields: ["company_ruc"],
      nullable: true,
      storage: [{ table: "search_projection", column: "org_ruc" }],
    },
    {
      path: "org.name",
      canonical_fields: ["company_name"],
      nullable: true,
      storage: [{ table: "search_projection", column: "org_name" }],
    },
    {
      path: "phones.primary",
      canonical_fields: ["phone"],
      nullable: true,
      derivation: "ranked_top_phone",
      storage: [{ table: "search_projection", column: "phone_primary" }],
    },
  ],
});

function makeLoaded(
  overrides?: Partial<LoadedSource["mapping"]>,
): LoadedSource[] {
  return [
    {
      entry: {
        source_key: "phones",
        mapping_path: "phones.json",
        enabled: true,
      },
      mapping: parseSourceMapping({
        fields: { person_dni: "dni_col" },
        phone_columns: ["phone_col"],
        ...overrides,
      }),
    },
    {
      entry: {
        source_key: "padron_ruc",
        mapping_path: "padron_ruc.json",
        enabled: true,
      },
      mapping: parseSourceMapping({
        fields: { company_ruc: "ruc_col", company_name: "name_col" },
        ...overrides,
      }),
    },
  ];
}

describe("checkSearchContract — valid", () => {
  test("returns ok:true with a summary string", () => {
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      PROJECTION,
      makeLoaded(),
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.summary).toContain("search contract OK");
    }
  });
});

describe("checkSearchContract — source contract errors", () => {
  test("errors when enabled source has no contract entry", () => {
    const loaded: LoadedSource[] = [
      {
        entry: {
          source_key: "unknown_source",
          mapping_path: "x.json",
          enabled: true,
        },
        mapping: parseSourceMapping({ fields: { person_dni: "col" } }),
      },
    ];
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      PROJECTION,
      loaded,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("unknown_source"))).toBe(
        true,
      );
    }
  });

  test("errors when required canonical field is missing from mapping", () => {
    const loaded: LoadedSource[] = [
      {
        entry: {
          source_key: "phones",
          mapping_path: "phones.json",
          enabled: true,
        },
        // person_dni is required but absent
        mapping: parseSourceMapping({ phone_columns: ["phone_col"] }),
      },
      ...makeLoaded().slice(1),
    ];
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      PROJECTION,
      loaded,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("person_dni"))).toBe(true);
    }
  });

  test("errors when phone input is required but absent", () => {
    const loaded: LoadedSource[] = [
      {
        entry: {
          source_key: "phones",
          mapping_path: "phones.json",
          enabled: true,
        },
        // has required fields but no phone mapping
        mapping: parseSourceMapping({ fields: { person_dni: "col" } }),
      },
      ...makeLoaded().slice(1),
    ];
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      PROJECTION,
      loaded,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.includes("phone input"))).toBe(true);
    }
  });
});

describe("checkSearchContract — projection errors", () => {
  test("errors when projection field references unknown canonical field", () => {
    const badProjection = parseProjectionSpec({
      projection: "search_projection",
      fields: [
        {
          path: "person.unknown",
          canonical_fields: ["totally_unknown_field"],
          nullable: true,
          storage: [{ table: "t", column: "c" }],
        },
      ],
    });
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      badProjection,
      makeLoaded(),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some((e) => e.includes("totally_unknown_field")),
      ).toBe(true);
    }
  });

  test("errors when non-derived projection field is not backed by any enabled source", () => {
    // company_ruc is canonical but not mapped by any enabled source
    const loaded: LoadedSource[] = [
      {
        entry: {
          source_key: "phones",
          mapping_path: "phones.json",
          enabled: true,
        },
        mapping: parseSourceMapping({
          fields: { person_dni: "col" },
          phone_columns: ["p"],
        }),
      },
      // padron_ruc source omitted — no one maps company_ruc or company_name
    ];
    const result = checkSearchContract(
      CANONICAL,
      SOURCE_CONTRACT,
      PROJECTION,
      loaded,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.errors.some(
          (e) => e.includes("company_ruc") || e.includes("company_name"),
        ),
      ).toBe(true);
    }
  });

  test("derived fields are exempt from the enabled-source backing check", () => {
    // phones.primary has derivation set, so it should not require a direct source mapping
    // Even with no phone mapping, phones.primary should not produce an error
    const projectionWithDerivedOnly = parseProjectionSpec({
      projection: "search_projection",
      fields: [
        {
          path: "person.dni",
          canonical_fields: ["person_dni"],
          nullable: false,
          storage: [{ table: "search_projection", column: "dni" }],
        },
        {
          path: "phones.primary",
          canonical_fields: ["phone"],
          nullable: true,
          derivation: "ranked_top_phone",
          storage: [{ table: "search_projection", column: "phone_primary" }],
        },
      ],
    });

    const minimalLoaded: LoadedSource[] = [
      {
        entry: {
          source_key: "phones",
          mapping_path: "phones.json",
          enabled: true,
        },
        mapping: parseSourceMapping({
          fields: { person_dni: "col" },
          phone_columns: ["p"],
        }),
      },
    ];

    const minimalContract = parseSourceContract({
      sources: [
        {
          source_key: "phones",
          required_canonical_fields: ["person_dni"],
          requires_any_phone_input: true,
        },
      ],
    });

    const result = checkSearchContract(
      CANONICAL,
      minimalContract,
      projectionWithDerivedOnly,
      minimalLoaded,
    );
    expect(result.ok).toBe(true);
  });
});

describe("parseSourceManifest", () => {
  test("parses enabled and disabled sources", () => {
    const manifest = parseSourceManifest({
      sources: [
        { source_key: "a", mapping_path: "a.json", enabled: true },
        { source_key: "b", mapping_path: "b.json", enabled: false },
      ],
    });
    expect(manifest.sources).toHaveLength(2);
    expect(manifest.sources[0]!.enabled).toBe(true);
    expect(manifest.sources[1]!.enabled).toBe(false);
  });

  test("rejects missing enabled flag", () => {
    expect(() =>
      parseSourceManifest({
        sources: [{ source_key: "a", mapping_path: "a.json" }],
      }),
    ).toThrow("boolean");
  });
});

describe("parseSourceMapping", () => {
  test("tolerates fully missing sections", () => {
    const mapping = parseSourceMapping({});
    expect(mapping.fields).toEqual({});
    expect(mapping.phone_columns).toEqual([]);
    expect(mapping.phone_prefixes).toEqual([]);
  });

  test("filters out non-string values in fields", () => {
    const mapping = parseSourceMapping({ fields: { valid: "col", bad: 42 } });
    expect(mapping.fields["valid"]).toBe("col");
    expect(mapping.fields["bad"]).toBeUndefined();
  });
});
