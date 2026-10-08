import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { startServer, type RunningServer } from "../../e2e/server";

const SERVER_SOURCE = `
Bun.serve({
  port: Number(process.env.PORT),
  hostname: process.env.HOST,
  fetch(request) {
    const { pathname } = new URL(request.url);
    if (pathname === "/uploads-root") return new Response(process.env.WEB_UPLOADS_ROOT);
    return new Response("ok");
  },
});
`;

describe("e2e server harness", () => {
  let scriptDir: string;
  let serverEntry: string;
  const running: RunningServer[] = [];

  beforeAll(async () => {
    scriptDir = await mkdtemp(join(tmpdir(), "crm-e2e-server-test-"));
    serverEntry = join(scriptDir, "server.ts");
    await writeFile(serverEntry, SERVER_SOURCE);

    return () => rm(scriptDir, { recursive: true, force: true });
  });

  afterEach(async () => {
    await Promise.all(running.splice(0).map((server) => server.stop()));
  });

  async function start(port: number): Promise<RunningServer> {
    const server = await startServer({ serverEntry, port, dbUrl: "unused" });
    running.push(server);
    return server;
  }

  it("gives each server its own uploads root", async () => {
    const first = await start(41_901);
    const second = await start(41_902);

    expect(first.uploadsRoot).not.toBe(second.uploadsRoot);

    for (const server of [first, second]) {
      const served = await fetch(`${server.baseURL}/uploads-root`);
      expect(await served.text()).toBe(server.uploadsRoot);
    }
  });

  it("removes the uploads root when the server stops", async () => {
    const server = await start(41_903);
    expect(existsSync(server.uploadsRoot)).toBe(true);

    await server.stop();

    expect(existsSync(server.uploadsRoot)).toBe(false);
  });
});
