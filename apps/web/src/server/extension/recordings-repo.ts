import type { Kysely } from "kysely";

import type {
  BranchId,
  ContactAssignmentId,
  ExtensionCallId,
  ExtensionRecordingId,
  InstallationId,
  OrganizationPersonId,
  UserId,
} from "~/domain/ids";
import type { Database } from "~/server/platform/database/types";

export function createExtensionRecordingsRepo(db: Kysely<Database>) {
  return {
    async insertCallIfAbsent(values: {
      handoff_jti: string;
      installation_id: InstallationId;
      user_id: UserId;
      branch_id: BranchId;
      assignment_id: ContactAssignmentId;
      contact_id: OrganizationPersonId;
      started_at: Date;
    }) {
      await db
        .insertInto("extension_calls")
        .values({ ...values, ended_at: null })
        .onConflict((oc) => oc.column("handoff_jti").doNothing())
        .execute();
    },

    findCallByHandoffJti(handoffJti: string) {
      return db
        .selectFrom("extension_calls")
        .selectAll()
        .where("handoff_jti", "=", handoffJti)
        .executeTakeFirst();
    },

    findCallForInstallation(
      callId: ExtensionCallId,
      owner: { userId: UserId; installationId: InstallationId },
    ) {
      return db
        .selectFrom("extension_calls")
        .selectAll()
        .where("id", "=", callId)
        .where("user_id", "=", owner.userId)
        .where("installation_id", "=", owner.installationId)
        .executeTakeFirst();
    },

    async endCall(callId: ExtensionCallId, endedAt: Date) {
      await db
        .updateTable("extension_calls")
        .set({ ended_at: endedAt })
        .where("id", "=", callId)
        .where("ended_at", "is", null)
        .execute();
    },

    async endCallsWithoutRecording(startedBefore: Date, endedAt: Date) {
      const ended = await db
        .updateTable("extension_calls")
        .set({ ended_at: endedAt })
        .where("ended_at", "is", null)
        .where("started_at", "<=", startedBefore)
        .where((eb) =>
          eb.not(
            eb.exists(
              eb
                .selectFrom("extension_recordings")
                .select("extension_recordings.id")
                .whereRef(
                  "extension_recordings.call_id",
                  "=",
                  "extension_calls.id",
                ),
            ),
          ),
        )
        .returning("id")
        .execute();
      return ended.length;
    },

    async insertRecordingIfAbsent(values: {
      call_id: ExtensionCallId;
      created_at: Date;
    }) {
      await db
        .insertInto("extension_recordings")
        .values({
          call_id: values.call_id,
          created_at: values.created_at,
          last_activity_at: values.created_at,
        })
        .onConflict((oc) => oc.column("call_id").doNothing())
        .execute();
    },

    findRecordingByCallId(callId: ExtensionCallId) {
      return db
        .selectFrom("extension_recordings")
        .selectAll()
        .where("call_id", "=", callId)
        .executeTakeFirst();
    },

    findRecordingForInstallation(
      recordingId: ExtensionRecordingId,
      owner: { userId: UserId; installationId: InstallationId },
    ) {
      return db
        .selectFrom("extension_recordings")
        .innerJoin(
          "extension_calls",
          "extension_calls.id",
          "extension_recordings.call_id",
        )
        .selectAll("extension_recordings")
        .where("extension_recordings.id", "=", recordingId)
        .where("extension_calls.user_id", "=", owner.userId)
        .where("extension_calls.installation_id", "=", owner.installationId)
        .executeTakeFirst();
    },

    /**
     * Takes the row lock that serializes segment writes, the extension's close
     * and the sweeper on one recording. Only meaningful inside a transaction.
     */
    lockRecording(recordingId: ExtensionRecordingId) {
      return db
        .selectFrom("extension_recordings")
        .selectAll()
        .where("id", "=", recordingId)
        .forUpdate()
        .executeTakeFirst();
    },

    async touchRecording(recordingId: ExtensionRecordingId, at: Date) {
      await db
        .updateTable("extension_recordings")
        .set({ last_activity_at: at })
        .where("id", "=", recordingId)
        .execute();
    },

    findSegment(recordingId: ExtensionRecordingId, seq: number) {
      return db
        .selectFrom("extension_recording_segments")
        .selectAll()
        .where("recording_id", "=", recordingId)
        .where("seq", "=", seq)
        .executeTakeFirst();
    },

    async insertSegmentIfAbsent(values: {
      recording_id: ExtensionRecordingId;
      seq: number;
      storage_key: string;
      content_type: string;
      channels: string;
      started_at: Date;
      size_bytes: number;
      sha256_hex: string;
      received_at: Date;
    }): Promise<boolean> {
      const result = await db
        .insertInto("extension_recording_segments")
        .values(values)
        .onConflict((oc) => oc.columns(["recording_id", "seq"]).doNothing())
        .executeTakeFirst();
      return Number(result.numInsertedOrUpdatedRows ?? 0) > 0;
    },

    listSegmentSizesBelow(recordingId: ExtensionRecordingId, count: number) {
      return db
        .selectFrom("extension_recording_segments")
        .select(["seq", "size_bytes"])
        .where("recording_id", "=", recordingId)
        .where("seq", "<", count)
        .orderBy("seq", "asc")
        .execute();
    },

    async completeRecording(values: {
      recording_id: ExtensionRecordingId;
      closed_at: Date;
      reported_interrupted: boolean;
      expected_segments: number;
      expected_bytes: number;
    }) {
      await db
        .updateTable("extension_recordings")
        .set({
          status: "complete",
          closed_at: values.closed_at,
          last_activity_at: values.closed_at,
          reported_interrupted: values.reported_interrupted,
          expected_segments: values.expected_segments,
          expected_bytes: values.expected_bytes,
        })
        .where("id", "=", values.recording_id)
        .execute();
    },

    interruptIdleRecordings(idleBefore: Date, interruptedAt: Date) {
      return db
        .updateTable("extension_recordings")
        .set({ status: "interrupted", closed_at: interruptedAt })
        .where("status", "=", "open")
        .where("last_activity_at", "<=", idleBefore)
        .returning(["id", "call_id"])
        .execute();
    },
  };
}

export type ExtensionRecordingsRepo = ReturnType<
  typeof createExtensionRecordingsRepo
>;
