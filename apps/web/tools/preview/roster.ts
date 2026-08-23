import { sql, type Kysely } from "kysely";

import { isRole, type Role } from "~/domain/auth/access/rbac";
import { UserId } from "~/domain/ids";
import {
  hashSessionToken,
  isValidTokenFormat,
} from "~/server/auth/session/tokens";
import type { Database } from "~/server/platform/database/types";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export interface Persona {
  username: string;
  role: Role;
  token: string;
}

export interface RoleCount {
  role: Role;
  count: number;
}

// Keep preview login tokens stable across reseeds.
function deriveToken(username: string): string {
  const base = username.replace(/[^a-z2-7]/g, "");

  if (!base) {
    throw new Error(
      `username '${username}' has no base32-safe characters to derive a token from`,
    );
  }

  const token = base.repeat(Math.ceil(32 / base.length)).slice(0, 32);

  if (!isValidTokenFormat(token)) {
    throw new Error(
      `derived token for '${username}' is not a valid token format`,
    );
  }

  return token;
}

export async function mintAllSessions(
  db: Kysely<Database>,
  now: Date,
): Promise<number> {
  const users = await db
    .selectFrom("users")
    .select(["id", "username", "role", "branch_id"])
    .where("is_active", "=", true)
    .execute();

  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await db.transaction().execute(async (trx) => {
    for (const user of users) {
      // Seeded users are few and all inserts share the same transaction.
      // eslint-disable-next-line no-await-in-loop
      await trx
        .insertInto("user_sessions")
        .values({
          id: hashSessionToken(deriveToken(user.username)),
          user_id: user.id,
          branch_id: user.branch_id,
          role: user.role,
          session_class: "app",
          primary_auth_method: "password",
          strong_auth_method: null,
          strong_auth_at: null,
          impersonator_user_id: null,
          ip_address: "127.0.0.1",
          user_agent: "preview",
          created_at: now,
          last_activity: now,
          expires_at: expiresAt,
        })
        .execute();
    }
  });

  return users.length;
}

export async function listRoles(db: Kysely<Database>): Promise<RoleCount[]> {
  const { rows } = await sql<{ role: Role; count: number }>`
    SELECT role, count(*)::int AS count
    FROM users
    WHERE is_active = true
    GROUP BY role
    ORDER BY role
  `.execute(db);

  return rows;
}

async function widestExecutivePortfolio(
  db: Kysely<Database>,
): Promise<UserId | null> {
  const { rows } = await sql<{ executive_id: string }>`
    SELECT executive_id
    FROM organization_current_owners
    GROUP BY executive_id
    ORDER BY count(*) DESC
    LIMIT 1
  `.execute(db);

  const executiveId = rows[0]?.executive_id;

  return executiveId ? UserId.trust(executiveId) : null;
}

async function firstActiveByRole(
  db: Kysely<Database>,
  role: Role,
): Promise<Persona | null> {
  const user = await db
    .selectFrom("users")
    .select(["username", "role"])
    .where("role", "=", role)
    .where("is_active", "=", true)
    .orderBy("username")
    .executeTakeFirst();

  return user
    ? {
        username: user.username,
        role: user.role,
        token: deriveToken(user.username),
      }
    : null;
}

export async function resolvePersonaByUsername(
  db: Kysely<Database>,
  username: string,
): Promise<Persona> {
  const user = await db
    .selectFrom("users")
    .select(["username", "role"])
    .where("username", "=", username)
    .where("is_active", "=", true)
    .executeTakeFirst();

  if (!user) {
    throw new Error(`no active user named '${username}' in crm_preview`);
  }

  return {
    username: user.username,
    role: user.role,
    token: deriveToken(user.username),
  };
}

export async function resolvePersonaByRole(
  db: Kysely<Database>,
  role: Role,
): Promise<Persona> {
  // Prefer an executive with actual demo data over an arbitrary account.
  if (role === "executive") {
    const widestId = await widestExecutivePortfolio(db);

    if (widestId) {
      const user = await db
        .selectFrom("users")
        .select(["username", "role"])
        .where("id", "=", widestId)
        .where("is_active", "=", true)
        .executeTakeFirst();

      if (user) {
        return {
          username: user.username,
          role: user.role,
          token: deriveToken(user.username),
        };
      }
    }
  }

  const persona = await firstActiveByRole(db, role);

  if (!persona) {
    throw new Error(`no active '${role}' user in crm_preview`);
  }

  return persona;
}
