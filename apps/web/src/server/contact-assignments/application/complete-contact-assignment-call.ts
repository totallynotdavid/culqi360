import type { ActionSuccess } from "~/contracts/common";
import { fail, type DomainError } from "~/domain/errors";
import type { ContactAssignmentsRepo } from "~/server/contact-assignments/infrastructure/assignment-repo";
import type { InteractionLogsRepo } from "~/server/contact-assignments/infrastructure/interaction-logs-repo";
import type { AppUow } from "~/server/platform/database/uow";
import type { OperationContext } from "~/server/platform/operation/context";
import { Err, Ok, type Result } from "~/shared/result";

import type { CompleteContactAssignmentCallCommand } from "./contracts";

type CompleteContactAssignmentCallTxRepos = {
  contactAssignments: Pick<
    ContactAssignmentsRepo,
    "findActiveByIdForUser" | "markCompleted"
  >;
  interactionLogs: Pick<InteractionLogsRepo, "create">;
};

async function completeAssignmentInteraction(
  input: CompleteContactAssignmentCallCommand,
  repos: CompleteContactAssignmentCallTxRepos,
  operation: OperationContext,
): Promise<Result<ActionSuccess, DomainError>> {
  const assignment = await repos.contactAssignments.findActiveByIdForUser(
    input.assignmentId,
    input.actorUserId,
    operation.operationAt,
  );
  if (!assignment || assignment.contact_id !== input.contactId) {
    return Err(fail("assignment_inactive"));
  }

  await repos.contactAssignments.markCompleted(
    input.assignmentId,
    input.actorUserId,
  );
  await repos.interactionLogs.create({
    contact_id: input.contactId,
    user_id: input.actorUserId,
    outcome: input.outcome,
    notes: input.notes,
    duration_seconds: null,
    created_at: operation.operationAt,
  });

  return Ok({ success: true });
}

export function completeContactAssignmentCall(
  input: CompleteContactAssignmentCallCommand,
  uow: AppUow<CompleteContactAssignmentCallTxRepos>,
  operation: OperationContext,
): Promise<Result<ActionSuccess, DomainError>> {
  return uow.run((repos) =>
    completeAssignmentInteraction(input, repos, operation),
  );
}
