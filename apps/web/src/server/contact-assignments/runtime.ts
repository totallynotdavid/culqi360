import type { MyContactAssignmentView } from "~/contracts/contact-assignments/views";
import { epochMilliseconds } from "~/domain/time/clock";
import { getLeadCapacitySnapshot } from "~/server/capacity/application/queries/get-lead-capacity-snapshot";
import type { UsageReservationPorts } from "~/server/capacity/application/usage/ledger";
import { createCapacityUsersRepo } from "~/server/capacity/infrastructure/capacity-users-repo";
import {
  createLeadPolicyDefaultsRepo,
  createLeadPolicyOverridesRepo,
} from "~/server/capacity/infrastructure/policy-repos";
import {
  createLeadCapacityGrantsRepo,
  createLeadUsageCommitsRepo,
  createLeadUsageReservationsRepo,
} from "~/server/capacity/infrastructure/usage-repo";
import { createContactAssignmentsRepo } from "~/server/contact-assignments/infrastructure/assignment-repo";
import { createContactCadenceRepo } from "~/server/contact-assignments/infrastructure/cadence-repo";
import { createInteractionLogsRepo } from "~/server/contact-assignments/infrastructure/interaction-logs-repo";
import type { EngineClient } from "~/server/integrations/engine/client";
import { createOrganizationRepo } from "~/server/organization/organization-repo";
import type { DatabaseExecutor } from "~/server/platform/database/executor";
import { createExecutorUow } from "~/server/platform/database/uow";
import type { OperationContext } from "~/server/platform/operation/context";
import { isErr, Ok } from "~/shared/result";

import { assignContacts } from "./application/assign-contacts";
import { completeContactAssignmentCall } from "./application/complete-contact-assignment-call";

type ContactAssignmentRepos = {
  users: ReturnType<typeof createCapacityUsersRepo>;
  leadPolicyDefaults: ReturnType<typeof createLeadPolicyDefaultsRepo>;
  leadPolicyOverrides: ReturnType<typeof createLeadPolicyOverridesRepo>;
  leadCapacityGrants: ReturnType<typeof createLeadCapacityGrantsRepo>;
  leadUsageReservations: ReturnType<typeof createLeadUsageReservationsRepo>;
  leadUsageCommits: ReturnType<typeof createLeadUsageCommitsRepo>;
  contactAssignments: ReturnType<typeof createContactAssignmentsRepo>;
  organization: ReturnType<typeof createOrganizationRepo>;
  cadence: ReturnType<typeof createContactCadenceRepo>;
};

interface ContactAssignmentsRuntimeDeps {
  executor: DatabaseExecutor;
  engine: Pick<EngineClient, "requestCandidates">;
}

function buildRepos(executor: DatabaseExecutor): ContactAssignmentRepos {
  return {
    users: createCapacityUsersRepo(executor),
    leadPolicyDefaults: createLeadPolicyDefaultsRepo(executor),
    leadPolicyOverrides: createLeadPolicyOverridesRepo(executor),
    leadCapacityGrants: createLeadCapacityGrantsRepo(executor),
    leadUsageReservations: createLeadUsageReservationsRepo(executor),
    leadUsageCommits: createLeadUsageCommitsRepo(executor),
    contactAssignments: createContactAssignmentsRepo(executor),
    organization: createOrganizationRepo(executor),
    cadence: createContactCadenceRepo(executor),
  };
}

function buildLeadUsageReservationPorts(
  executor: DatabaseExecutor,
): UsageReservationPorts<"lead"> {
  return {
    executor,
    async checkRemaining(trx, actorUserId, operation) {
      const snapshot = await getLeadCapacitySnapshot(
        actorUserId,
        buildRepos(trx),
        operation,
      );
      if (isErr(snapshot)) {
        return snapshot;
      }
      return Ok(snapshot.value.remaining);
    },
    reservations: createLeadUsageReservationsRepo,
    commits: createLeadUsageCommitsRepo,
  };
}

export function createContactAssignmentsRuntime(
  deps: ContactAssignmentsRuntimeDeps,
) {
  const { executor, engine } = deps;

  const repos = buildRepos(executor);
  const interactionUow = createExecutorUow(executor, (txDb) => ({
    contactAssignments: createContactAssignmentsRepo(txDb),
    interactionLogs: createInteractionLogsRepo(txDb),
  }));
  const uow = createExecutorUow(executor, buildRepos);
  const leadUsageReservationPorts = buildLeadUsageReservationPorts(executor);

  return {
    getCapacity: (
      actorUserId: Parameters<typeof getLeadCapacitySnapshot>[0],
      operation: OperationContext,
    ) => getLeadCapacitySnapshot(actorUserId, repos, operation),
    assign: (
      command: Parameters<typeof assignContacts>[0],
      operation: OperationContext,
    ) =>
      assignContacts(
        command,
        { repos, uow, engine, leadUsageReservationPorts },
        operation,
      ),
    listActive: async (
      actorUserId: Parameters<typeof getLeadCapacitySnapshot>[0],
      operation: OperationContext,
    ) => {
      const rows = await repos.contactAssignments.findActiveByUserWithContacts(
        actorUserId,
        operation.operationAt,
      );

      return Ok(
        rows.map((row): MyContactAssignmentView => ({
          assignmentId: row.assignmentId,
          contactId: row.contactId,
          name: row.name,
          phone: row.phonePrimary,
          assignedAt: epochMilliseconds(row.assignedAt),
          expiresAt: epochMilliseconds(row.expiresAt),
        })),
      );
    },
    completeCall: (
      command: Parameters<typeof completeContactAssignmentCall>[0],
      operation: OperationContext,
    ) => completeContactAssignmentCall(command, interactionUow, operation),
  };
}
