import type { Kysely, SelectQueryBuilder } from "kysely";

import type { Json } from "~/contracts/json";
import type {
  BranchId,
  ContactAssignmentId,
  InstallationId,
  OrganizationPersonId,
  UserId,
} from "~/domain/ids";
import type { Database } from "~/server/platform/database/types";

function withExecutiveStatusJoinsAndSelect(
  qb: SelectQueryBuilder<Database, "extension_executive_statuses", object>,
) {
  return qb
    .innerJoin("users", "users.id", "extension_executive_statuses.user_id")
    .leftJoin("teams", "teams.id", "users.team_id")
    .select([
      "users.id as userId",
      "users.names",
      "users.first_surname as firstSurname",
      "users.team_id as teamId",
      "teams.name as teamName",
      "extension_executive_statuses.presence_status as presenceStatus",
      "extension_executive_statuses.sync_health as syncHealth",
      "extension_executive_statuses.assignment_id as assignmentId",
      "extension_executive_statuses.contact_id as contactId",
      "extension_executive_statuses.call_session_id as callSessionId",
      "extension_executive_statuses.presence_updated_at as presenceUpdatedAt",
      "extension_executive_statuses.sync_updated_at as syncUpdatedAt",
    ])
    .where("users.is_active", "=", true)
    .where("users.role", "=", "executive");
}
import type {
  ExtensionExecutivePresenceStatus,
  ExtensionSyncHealth,
} from "~/server/extension/contracts";

export function createExtensionRuntimeRepo(db: Kysely<Database>) {
  return {
    createHandoff(values: {
      jti: string;
      user_id: UserId;
      branch_id: BranchId;
      auth_session_id: string;
      assignment_id: ContactAssignmentId;
      contact_id: OrganizationPersonId;
      origin: string;
      issued_at: Date;
      expires_at: Date;
    }) {
      return db
        .insertInto("extension_handoffs")
        .values(values)
        .executeTakeFirstOrThrow();
    },

    findHandoffByJti(jti: string) {
      return db
        .selectFrom("extension_handoffs")
        .selectAll()
        .where("jti", "=", jti)
        .executeTakeFirst();
    },

    consumeHandoff(values: {
      jti: string;
      installation_id: InstallationId;
      installation_session_jti: string;
      consumed_at: Date;
    }) {
      return db
        .updateTable("extension_handoffs")
        .set({
          installation_id: values.installation_id,
          installation_session_jti: values.installation_session_jti,
          consumed_at: values.consumed_at,
        })
        .where("jti", "=", values.jti)
        .where("consumed_at", "is", null)
        .executeTakeFirst();
    },

    createInstallationSession(values: {
      jti: string;
      user_id: UserId;
      branch_id: BranchId;
      auth_session_id: string;
      installation_id: InstallationId;
      refresh_token_hash: string;
      issued_at: Date;
      expires_at: Date;
    }) {
      return db
        .insertInto("extension_installation_sessions")
        .values({
          ...values,
          revoked_at: null,
          last_seen_at: null,
          refreshed_at: values.issued_at,
        })
        .executeTakeFirstOrThrow();
    },

    findActiveInstallationSession(
      auth_session_id: string,
      installation_id: InstallationId,
      activeAsOf: Date,
    ) {
      return db
        .selectFrom("extension_installation_sessions")
        .selectAll()
        .where("auth_session_id", "=", auth_session_id)
        .where("installation_id", "=", installation_id)
        .where("revoked_at", "is", null)
        .where("expires_at", ">", activeAsOf)
        .executeTakeFirst();
    },

    findValidInstallationSession(jti: string, activeAsOf: Date) {
      return db
        .selectFrom("extension_installation_sessions")
        .selectAll()
        .where("jti", "=", jti)
        .where("revoked_at", "is", null)
        .where("expires_at", ">", activeAsOf)
        .executeTakeFirst();
    },

    findRefreshableInstallationSession(
      refresh_token_hash: string,
      installation_id: InstallationId,
      activeAsOf: Date,
    ) {
      return db
        .selectFrom("extension_installation_sessions")
        .selectAll()
        .where("refresh_token_hash", "=", refresh_token_hash)
        .where("installation_id", "=", installation_id)
        .where("revoked_at", "is", null)
        .where("expires_at", ">", activeAsOf)
        .executeTakeFirst();
    },

    touchInstallationSession(jti: string, last_seen_at: Date) {
      return db
        .updateTable("extension_installation_sessions")
        .set({ last_seen_at })
        .where("jti", "=", jti)
        .executeTakeFirst();
    },

    rotateInstallationSessionRefreshToken(values: {
      jti: string;
      refresh_token_hash: string;
      refreshed_at: Date;
      expires_at: Date;
    }) {
      return db
        .updateTable("extension_installation_sessions")
        .set({
          refresh_token_hash: values.refresh_token_hash,
          refreshed_at: values.refreshed_at,
          expires_at: values.expires_at,
        })
        .where("jti", "=", values.jti)
        .executeTakeFirst();
    },

    revokeInstallationSession(jti: string, revoked_at: Date) {
      return db
        .updateTable("extension_installation_sessions")
        .set({ revoked_at })
        .where("jti", "=", jti)
        .executeTakeFirst();
    },

    revokeInstallationSessionsByAuthSession(
      auth_session_id: string,
      revoked_at: Date,
    ) {
      return db
        .updateTable("extension_installation_sessions")
        .set({ revoked_at })
        .where("auth_session_id", "=", auth_session_id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
    },

    revokeInstallationSessionsByUser(user_id: UserId, revoked_at: Date) {
      return db
        .updateTable("extension_installation_sessions")
        .set({ revoked_at })
        .where("user_id", "=", user_id)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
    },

    revokeOtherInstallationSessionsByUser(
      user_id: UserId,
      keep_jti: string,
      revoked_at: Date,
    ) {
      return db
        .updateTable("extension_installation_sessions")
        .set({ revoked_at })
        .where("user_id", "=", user_id)
        .where("jti", "!=", keep_jti)
        .where("revoked_at", "is", null)
        .executeTakeFirst();
    },

    async insertRuntimeEventIfAbsent(values: {
      id: string;
      sequence: number;
      user_id: UserId;
      branch_id: BranchId;
      assignment_id: ContactAssignmentId | null;
      contact_id: OrganizationPersonId | null;
      call_session_id: string | null;
      type: Database["extension_runtime_events"]["type"];
      payload_json: Json;
      created_at: Date;
      received_at: Date;
    }) {
      const result = await db
        .insertInto("extension_runtime_events")
        .values(values)
        .onConflict((oc) => oc.column("id").doNothing())
        .executeTakeFirst();
      return Number(result.numInsertedOrUpdatedRows ?? 0) > 0;
    },

    upsertExecutivePresence(values: {
      user_id: UserId;
      branch_id: BranchId;
      assignment_id: ContactAssignmentId | null;
      contact_id: OrganizationPersonId | null;
      call_session_id: string | null;
      presence_status: ExtensionExecutivePresenceStatus;
      presence_updated_at: Date;
      source_event_id: string | null;
      source_event_sequence: number;
    }) {
      return db
        .insertInto("extension_executive_statuses")
        .values({
          user_id: values.user_id,
          branch_id: values.branch_id,
          assignment_id: values.assignment_id,
          contact_id: values.contact_id,
          call_session_id: values.call_session_id,
          presence_status: values.presence_status,
          presence_updated_at: values.presence_updated_at,
          sync_health: "stale",
          sync_updated_at: null,
          source_event_id: values.source_event_id,
          source_event_sequence: values.source_event_sequence,
        })
        .onConflict((oc) =>
          oc
            .column("user_id")
            .doUpdateSet((eb) => ({
              branch_id: eb.ref("excluded.branch_id"),
              assignment_id: eb.ref("excluded.assignment_id"),
              contact_id: eb.ref("excluded.contact_id"),
              call_session_id: eb.ref("excluded.call_session_id"),
              presence_status: eb.ref("excluded.presence_status"),
              presence_updated_at: eb.ref("excluded.presence_updated_at"),
              source_event_id: eb.ref("excluded.source_event_id"),
              source_event_sequence: eb.ref("excluded.source_event_sequence"),
            }))
            .where((eb) =>
              eb.or([
                eb(
                  "extension_executive_statuses.presence_updated_at",
                  "is",
                  null,
                ),
                eb(
                  "extension_executive_statuses.presence_updated_at",
                  "<",
                  eb.ref("excluded.presence_updated_at"),
                ),
                eb.and([
                  eb(
                    "extension_executive_statuses.presence_updated_at",
                    "=",
                    eb.ref("excluded.presence_updated_at"),
                  ),
                  eb.or([
                    eb(
                      "extension_executive_statuses.source_event_sequence",
                      "is",
                      null,
                    ),
                    eb(
                      "extension_executive_statuses.source_event_sequence",
                      "<",
                      eb.ref("excluded.source_event_sequence"),
                    ),
                  ]),
                ]),
              ]),
            ),
        )
        .executeTakeFirstOrThrow();
    },

    upsertExecutiveSyncHealth(values: {
      user_id: UserId;
      branch_id: BranchId;
      sync_health: ExtensionSyncHealth;
      sync_updated_at: Date;
    }) {
      return db
        .insertInto("extension_executive_statuses")
        .values({
          user_id: values.user_id,
          branch_id: values.branch_id,
          assignment_id: null,
          contact_id: null,
          call_session_id: null,
          presence_status: null,
          presence_updated_at: null,
          sync_health: values.sync_health,
          sync_updated_at: values.sync_updated_at,
          source_event_id: null,
        })
        .onConflict((oc) =>
          oc.column("user_id").doUpdateSet({
            branch_id: values.branch_id,
            sync_health: values.sync_health,
            sync_updated_at: values.sync_updated_at,
          }),
        )
        .executeTakeFirstOrThrow();
    },

    updateExecutiveSyncHealthByUser(values: {
      user_id: UserId;
      sync_health: ExtensionSyncHealth;
      sync_updated_at: Date;
    }) {
      return db
        .updateTable("extension_executive_statuses")
        .set({
          sync_health: values.sync_health,
          sync_updated_at: values.sync_updated_at,
        })
        .where("user_id", "=", values.user_id)
        .executeTakeFirst();
    },

    findCurrentStatusByUser(userId: UserId) {
      return db
        .selectFrom("extension_executive_statuses")
        .selectAll()
        .where("user_id", "=", userId)
        .executeTakeFirst();
    },

    listTeamStatusesBySupervisor(supervisorUserId: UserId) {
      return db
        .selectFrom("extension_executive_statuses")
        .$call(withExecutiveStatusJoinsAndSelect)
        .innerJoin(
          "branch_supervisors",
          "branch_supervisors.branch_id",
          "extension_executive_statuses.branch_id",
        )
        .where("branch_supervisors.user_id", "=", supervisorUserId)
        .orderBy("users.names", "asc")
        .execute();
    },

    listBranchStatuses(branchId: BranchId) {
      return db
        .selectFrom("extension_executive_statuses")
        .$call(withExecutiveStatusJoinsAndSelect)
        .where("extension_executive_statuses.branch_id", "=", branchId)
        .orderBy("users.names", "asc")
        .execute();
    },
  };
}

export type ExtensionRuntimeRepo = ReturnType<
  typeof createExtensionRuntimeRepo
>;
