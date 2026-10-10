import type { Transaction } from "kysely";

import { fail, type DomainError } from "~/domain/errors";
import type { UserId } from "~/domain/ids";
import { createEventsWriter } from "~/server/event-logs/events-repo";
import { assignOrganizationOwnerInTransaction } from "~/server/organization/ownership";
import type { Database } from "~/server/platform/database/types";
import type { LeadHistoryEventDraft } from "~/server/workflow/lead/domain/history";
import type { LeadState } from "~/server/workflow/lead/domain/state";
import { Err, Ok, type Result } from "~/shared/result";

import { toLeadEventAppend } from "./lead-events";

export type LeadTransition = {
  next: LeadState;
  events: LeadHistoryEventDraft[];
};

export type LeadAssignment = {
  toExecutiveId: UserId;
  assignedBy: UserId;
  assignedAt: Date;
};

export async function commitTransition(
  tx: Transaction<Database>,
  transition: LeadTransition,
  assignment?: LeadAssignment,
): Promise<Result<{ eventIds: string[] }, DomainError>> {
  const { next, events } = transition;

  const updateResult = await tx
    .updateTable("workflow_leads")
    .set({
      stage: next.stage,
      status: next.status,
      priority: next.priority,
      updated_by: next.updatedBy,
      updated_at: next.updatedAt,
      reservation_expires_at: next.reservationExpiresAt,
      deleted_at: next.deletedAt,
      version: next.version,
    })
    .where("id", "=", next.id)
    .where("version", "=", next.version - 1)
    .executeTakeFirst();

  if (Number(updateResult.numUpdatedRows) === 0) {
    return Err(fail("concurrency_conflict"));
  }

  if (assignment) {
    const assigned = await assignOrganizationOwnerInTransaction(tx, {
      organizationId: next.organizationId,
      executiveId: assignment.toExecutiveId,
      assignedBy: assignment.assignedBy,
      assignedAt: assignment.assignedAt,
      reason: "workflow_reassignment",
    });

    if (!assigned.ok) {
      return assigned;
    }
  }

  const eventIds = await createEventsWriter(tx).append(
    events.map(toLeadEventAppend),
  );

  return Ok({ eventIds });
}

export async function appendFacts(
  tx: Transaction<Database>,
  operationAt: Date,
  events: LeadHistoryEventDraft[],
): Promise<Result<{ eventIds: string[] }, DomainError>> {
  const [firstEvent] = events;

  if (!firstEvent) {
    return Ok({ eventIds: [] });
  }

  const leadId = firstEvent.leadId;

  const updateResult = await tx
    .updateTable("workflow_leads")
    .set({
      updated_at: operationAt,
      updated_by: firstEvent.actorUserId,
    })
    .where("id", "=", leadId)
    .where("deleted_at", "is", null)
    .executeTakeFirst();

  if (Number(updateResult.numUpdatedRows) === 0) {
    return Err(fail("lead_not_found"));
  }

  const eventIds = await createEventsWriter(tx).append(
    events.map(toLeadEventAppend),
  );

  return Ok({ eventIds });
}
