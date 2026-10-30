import { makeCompanyResult } from "@tests/support/shared/search-row";
import { describe, expect, it } from "vitest";

import { groupByCompany } from "~/features/search/model/grouping";
describe("client search grouping companies", () => {
  it("groups company rows by ruc and aggregates phones", () => {
    const groups = groupByCompany([
      makeCompanyResult({
        ruc: "20100000001",
        legal_name: "ACME SAC",
        phone_primary: "999111222",
      }),
      makeCompanyResult({
        ruc: "20100000001",
        legal_name: "ACME SAC",
        phone_secondary: "999333444",
      }),
      makeCompanyResult({
        ruc: "20100000001",
        legal_name: "ACME SAC",
        phone_secondary: "999777888",
      }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.ruc).toBe("20100000001");
    expect(groups[0]?.name).toBe("ACME SAC");
    expect(groups[0]?.phones).toEqual(["999111222", "999333444", "999777888"]);
  });

  it("two company rows with different RUCs produce two groups", () => {
    const groups = groupByCompany([
      makeCompanyResult({ ruc: "20100000001", legal_name: "ACME SAC" }),
      makeCompanyResult({ ruc: "20100000002", legal_name: "GLOBEX SAC" }),
    ]);

    expect(groups).toHaveLength(2);
    expect(groups[0]?.ruc).toBe("20100000001");
    expect(groups[1]?.ruc).toBe("20100000002");
  });

  it("deduplicates repeated phones within one company group", () => {
    const groups = groupByCompany([
      makeCompanyResult({ ruc: "20100000001", phone_primary: "999111222" }),
      makeCompanyResult({ ruc: "20100000001", phone_secondary: "999111222" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.phones).toEqual(["999111222"]);
  });

  it("lists the company's people once each across rows", () => {
    const juan = {
      doc_type: "DNI",
      doc_number: "12345678",
      name: "JUAN PEREZ",
      role_name: "GERENTE GENERAL",
      role_start_date: "2020-01-01",
    };
    const unnamed = {
      doc_type: null,
      doc_number: null,
      name: null,
      role_name: "SOCIO",
      role_start_date: null,
    };
    const groups = groupByCompany([
      makeCompanyResult({ ruc: "20100000001", people: [juan, unnamed] }),
      makeCompanyResult({ ruc: "20100000001", people: [juan] }),
    ]);

    expect(groups[0]?.people).toEqual([
      { doc_type: "DNI", doc_number: "12345678", name: "JUAN PEREZ" },
    ]);
  });

  it("recovers company name from later rows", () => {
    const groups = groupByCompany([
      makeCompanyResult({ ruc: "20100000001", legal_name: null }),
      makeCompanyResult({ ruc: "20100000001", legal_name: "ACME SAC" }),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0]?.name).toBe("ACME SAC");
  });
});
