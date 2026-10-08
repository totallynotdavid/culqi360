import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { resolveDevServer } from "../../../dev-server.ts";

const ORIGIN_VARIABLES = [
  "APP_PUBLIC_ORIGIN",
  "EXTENSION_EXPECTED_ORIGIN",
] as const;

function exampleEnv(): Map<string, string> {
  const text = readFileSync(
    resolve(import.meta.dirname, "../../../../../.env.example"),
    "utf8",
  );
  const entries = text
    .split("\n")
    .filter((line) => /^[A-Z_]+=/.test(line))
    .map((line): [string, string] => {
      const separator = line.indexOf("=");
      return [line.slice(0, separator), line.slice(separator + 1)];
    });

  return new Map(entries);
}

describe("dev server", () => {
  it.each(ORIGIN_VARIABLES)(
    "listens where .env.example points %s",
    (variable) => {
      const origin = exampleEnv().get(variable);

      if (!origin) {
        throw new Error(`${variable} is not set in .env.example`);
      }

      expect(new URL(origin).port).toBe(String(resolveDevServer({}).port));
    },
  );

  it("fails instead of moving to another port when the port is taken", () => {
    expect(resolveDevServer({}).strictPort).toBe(true);
    expect(resolveDevServer({ PORT: "3900" })).toMatchObject({
      port: 3900,
      strictPort: true,
    });
  });
});
