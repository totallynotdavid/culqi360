import { makeCompanyResult } from "@tests/support/shared/search-row";
import { describe, expect, it } from "vitest";

import { toSearchResultItems } from "~/features/search/model/search-results";
import { createSearchViewModel } from "~/features/search/model/search-view-model";

describe("company search result item", () => {
  it("shows each person of the company as a name and document chip", () => {
    const model = createSearchViewModel({
      rows: [
        makeCompanyResult({
          ruc: "20100000001",
          people: [
            {
              doc_type: "DNI",
              doc_number: "12345678",
              name: "JUAN PEREZ",
              role_name: null,
              role_start_date: null,
            },
            {
              doc_type: "CE",
              doc_number: "000111",
              name: null,
              role_name: null,
              role_start_date: null,
            },
          ],
        }),
      ],
    });

    const [item] = toSearchResultItems(model);
    const people = item?.fields.find((field) => field.label === "Personas");

    expect(people?.kind).toBe("chips");
    expect(people?.values).toEqual(["JUAN PEREZ (DNI 12345678)", "CE 000111"]);
  });
});
