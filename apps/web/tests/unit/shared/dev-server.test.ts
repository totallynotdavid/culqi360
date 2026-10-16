import { describe, expect, it } from "vitest";

import { resolveDevServer } from "../../../dev-server.ts";

describe("dev server", () => {
  it("fails instead of moving to another port when the port is taken", () => {
    expect(resolveDevServer({}).strictPort).toBe(true);
    expect(resolveDevServer({ PORT: "3900" })).toMatchObject({
      port: 3900,
      strictPort: true,
    });
  });
});
