import { isRole, type Role } from "~/domain/auth/access/rbac";
import { SESSION_COOKIE_NAME } from "~/server/auth/session/cookies";
import { createDb } from "~/server/platform/database/client";

import { ensureDatabase, previewDbUrl } from "./db";
import {
  listRoles,
  resolvePersonaByRole,
  resolvePersonaByUsername,
  type Persona,
  type RoleCount,
} from "./roster";
import { ensureServer, stopServer } from "./server";

function flagValue(args: string[], flag: string): string | undefined {
  const index = args.indexOf(flag);

  if (index === -1) {
    return undefined;
  }

  const value = args[index + 1];

  if (!value || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }

  return value;
}

type Selector =
  | { kind: "list" }
  | { kind: "role"; role: Role }
  | { kind: "username"; username: string };

function parseSelector(args: string[]): Selector {
  const roleArg = flagValue(args, "--role");
  const asArg = flagValue(args, "--as");

  if (roleArg && asArg) {
    throw new Error("pass either --role or --as, not both");
  }

  if (asArg) {
    return { kind: "username", username: asArg };
  }

  if (!roleArg) {
    return { kind: "list" };
  }

  if (!isRole(roleArg)) {
    throw new Error(`unknown role '${roleArg}'`);
  }

  return { kind: "role", role: roleArg };
}

function printPersona(baseURL: string, persona: Persona, json: boolean): void {
  if (json) {
    console.log(
      JSON.stringify({
        baseURL,
        cookieName: SESSION_COOKIE_NAME,
        cookieValue: persona.token,
        username: persona.username,
        role: persona.role,
      }),
    );

    return;
  }

  console.log("Preview ready.");
  console.log(`  URL:      ${baseURL}`);
  console.log(`  Persona:  ${persona.username} (${persona.role})`);
  console.log("");
  console.log("Try:");
  console.log(`  agent-browser open ${baseURL}/login`);
  console.log(
    `  agent-browser cookies set ${SESSION_COOKIE_NAME} ${persona.token}`,
  );
  console.log(`  agent-browser open ${baseURL}/home`);
  console.log("  agent-browser screenshot");
}

function printRoleList(
  baseURL: string,
  roles: RoleCount[],
  json: boolean,
): void {
  if (json) {
    console.log(JSON.stringify({ baseURL, roles }));
    return;
  }

  console.log("Preview ready.");
  console.log(`  URL: ${baseURL}`);
  console.log("");
  console.log("Available roles:");

  for (const { role, count } of roles) {
    console.log(`  ${role} (${count})`);
  }

  console.log("");
  console.log("Pick one: bun run preview --role <role>");
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);

  if (args[0] === "stop") {
    await stopServer();
    return;
  }

  const json = args.includes("--json");
  const fresh = args.includes("--fresh");
  const selector = parseSelector(args);

  const rebuilt = await ensureDatabase({ fresh });
  const databaseUrl = previewDbUrl();
  const { baseURL } = await ensureServer(databaseUrl, {
    forceRestart: rebuilt,
  });

  const db = createDb(previewDbUrl);

  try {
    if (selector.kind === "list") {
      printRoleList(baseURL, await listRoles(db), json);
      return;
    }

    const persona =
      selector.kind === "username"
        ? await resolvePersonaByUsername(db, selector.username)
        : await resolvePersonaByRole(db, selector.role);

    printPersona(baseURL, persona, json);
  } finally {
    await db.destroy();
  }
}

await main();
