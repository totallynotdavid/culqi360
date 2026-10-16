import { createInterface } from "node:readline";

import { Client } from "pg";

import { acquirePostgresServer } from "../../support/runtime/postgres-server";

const server = await acquirePostgresServer();
let released = false;

console.log(`ready:${server.connectionString}`);

const input = createInterface({ input: process.stdin });
for await (const command of input) {
  if (command === "query") {
    const client = new Client({ connectionString: server.connectionString });
    await client.connect();
    try {
      await client.query("SELECT 1");
      console.log("query-ok:1");
    } finally {
      await client.end();
    }
    continue;
  }

  if (command === "release") {
    await server.release();
    released = true;
    console.log("released:");
    continue;
  }

  if (command === "exit") {
    if (!released) {
      await server.release();
    }
    process.exit(0);
  }
}
