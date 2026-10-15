import type { Role } from "~/domain/auth/access/rbac";
import { external, type DomainError } from "~/domain/errors";
import {
  ContactAssignmentId,
  OrganizationPersonId,
  type BranchId,
  type UserId,
} from "~/domain/ids";
import { dateFromEpochMilliseconds } from "~/domain/time/clock";
import type { AppUow } from "~/server/platform/database/uow";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, isErr, type Result } from "~/shared/result";

import {
  type ExtensionRuntimeEventEnvelope,
  type TeamExecutiveStatusView,
} from "../contracts";
import { authenticateInstallationSession } from "./authenticate";
import {
  mapLifecycleStatus,
  upsertSyncHealth,
  withDerivedProjectionStatuses,
} from "./presence";
import type { ExtensionRepos } from "./shared";

interface EventsWriteContext extends OperationContext {
  repos: ExtensionRepos;
  uow: AppUow<ExtensionRepos>;
}
interface EventsReadContext extends OperationContext {
  repos: ExtensionRepos;
}

function readAssignmentId(
  payload: ExtensionRuntimeEventEnvelope["payload"],
): Result<ContactAssignmentId | null, DomainError> {
  if (
    !("assignmentId" in payload) ||
    typeof payload.assignmentId !== "string"
  ) {
    return Ok(null);
  }
  return ContactAssignmentId.parse(payload.assignmentId);
}

function readContactId(
  payload: ExtensionRuntimeEventEnvelope["payload"],
): Result<OrganizationPersonId | null, DomainError> {
  if (!("contactId" in payload) || typeof payload.contactId !== "string") {
    return Ok(null);
  }
  return OrganizationPersonId.parse(payload.contactId);
}

export async function ingestRuntimeEvent(
  context: EventsWriteContext,
  input: {
    sessionToken: string;
    event: ExtensionRuntimeEventEnvelope;
  },
): Promise<Result<void, DomainError>> {
  const { uow } = context;

  try {
    const authenticated = await authenticateInstallationSession(
      context.repos,
      input.sessionToken,
      context.operationAt,
    );
    if (isErr(authenticated)) {
      return authenticated;
    }
    const session = authenticated.value;

    const eventAssignmentId = readAssignmentId(input.event.payload);
    if (isErr(eventAssignmentId)) {
      return eventAssignmentId;
    }

    const eventContactId = readContactId(input.event.payload);
    if (isErr(eventContactId)) {
      return eventContactId;
    }

    const payloadText = JSON.stringify(input.event.payload);
    const eventSessionId =
      "sessionId" in input.event.payload &&
      typeof input.event.payload.sessionId === "string"
        ? input.event.payload.sessionId
        : null;
    const eventCreatedAt = dateFromEpochMilliseconds(input.event.createdAt);

    return await uow.run(async (txRepos) => {
      const inserted =
        await txRepos.extensionRuntime.insertRuntimeEventIfAbsent({
          id: input.event.id,
          sequence: input.event.sequence,
          user_id: session.user_id,
          branch_id: session.branch_id,
          assignment_id: eventAssignmentId.value,
          contact_id: eventContactId.value,
          call_session_id: eventSessionId,
          type: input.event.type,
          payload_json: payloadText,
          created_at: eventCreatedAt,
          received_at: context.operationAt,
        });

      await upsertSyncHealth(txRepos.extensionRuntime, {
        userId: session.user_id,
        branchId: session.branch_id,
        syncHealth: "ok",
        updatedAt: context.operationAt,
      });

      if (!inserted) {
        return Ok(undefined);
      }

      if (input.event.type === "executive.presence") {
        await txRepos.extensionRuntime.upsertExecutivePresence({
          user_id: session.user_id,
          branch_id: session.branch_id,
          assignment_id: eventAssignmentId.value,
          contact_id: eventContactId.value,
          call_session_id: input.event.payload.callSessionId,
          presence_status: input.event.payload.presenceStatus,
          presence_updated_at: dateFromEpochMilliseconds(
            input.event.payload.updatedAt,
          ),
          source_event_id: input.event.id,
          source_event_sequence: input.event.sequence,
        });
        return Ok(undefined);
      }

      if (input.event.type === "call.lifecycle") {
        await txRepos.extensionRuntime.upsertExecutivePresence({
          user_id: session.user_id,
          branch_id: session.branch_id,
          assignment_id: eventAssignmentId.value,
          contact_id: eventContactId.value,
          call_session_id: eventSessionId,
          presence_status: mapLifecycleStatus(input.event),
          presence_updated_at: dateFromEpochMilliseconds(
            input.event.payload.at,
          ),
          source_event_id: input.event.id,
          source_event_sequence: input.event.sequence,
        });
      }

      return Ok(undefined);
    });
  } catch (error: unknown) {
    return Err(
      external(
        error instanceof Error
          ? error.message
          : "Unexpected extension event ingest failure",
        { code: "unexpected" },
      ),
    );
  }
}

export async function listTeamExecutiveStatuses(
  context: EventsReadContext,
  input: {
    role: Role;
    userId: UserId;
    branchId: BranchId;
  },
): Promise<Result<TeamExecutiveStatusView[], DomainError>> {
  const { repos } = context;

  try {
    if (input.role === "supervisor") {
      return Ok(
        withDerivedProjectionStatuses(
          await repos.extensionRuntime.listTeamStatusesBySupervisor(
            input.userId,
          ),
          context.operationAt,
        ),
      );
    }

    return Ok(
      withDerivedProjectionStatuses(
        await repos.extensionRuntime.listBranchStatuses(input.branchId),
        context.operationAt,
      ),
    );
  } catch (error: unknown) {
    return Err(
      external(
        error instanceof Error
          ? error.message
          : "Unexpected extension status read failure",
        { code: "unexpected" },
      ),
    );
  }
}
