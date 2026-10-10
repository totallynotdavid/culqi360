import type { Transaction } from "kysely";

import { type DomainError } from "~/domain/errors";
import type { Database } from "~/server/platform/database/types";
import { enqueueLeadEffects } from "~/server/workflow/effects/enqueue-lead-effects";
import type { LeadHistoryEventDraft } from "~/server/workflow/lead/domain/history";
import {
  createWorkflowRepos,
  type WorkflowRepos,
} from "~/server/workflow/repos";
import type { WorkflowWriteContext } from "~/server/workflow/types";
import { Err, isErr, type Result } from "~/shared/result";

import {
  appendFacts,
  commitTransition,
  type LeadAssignment,
  type LeadTransition,
} from "./commit";

export type CommittedLeadEvent = { event: LeadHistoryEventDraft; id: string };

export type LeadTransaction = {
  tx: Transaction<Database>;
  repos: WorkflowRepos;
  operationAt: Date;
  commitTransition(
    transition: LeadTransition,
    assignment?: LeadAssignment,
  ): Promise<Result<{ eventIds: string[] }, DomainError>>;
  appendFacts(
    events: LeadHistoryEventDraft[],
  ): Promise<Result<{ eventIds: string[] }, DomainError>>;
};

// A domain failure is thrown as a sentinel so the transaction rolls back; the
// runner unwraps it into Err. Any other throw is a fault and propagates.
class LeadTransactionRollback {
  constructor(readonly error: DomainError) {}
}

export function pairCommittedEvents(
  events: LeadHistoryEventDraft[],
  ids: string[],
): CommittedLeadEvent[] {
  return events.map((event, index) => {
    const id = ids[index];
    if (id === undefined) {
      throw new Error(`Lead event ${index} was committed without an id`);
    }

    return { event, id };
  });
}

export function runLeadTransaction<O>(
  scope: WorkflowWriteContext,
  body: (ctx: LeadTransaction) => Promise<Result<O, DomainError>>,
): Promise<Result<O, DomainError>> {
  return scope.executor
    .transaction()
    .execute(async (tx): Promise<Result<O, DomainError>> => {
      const committed: CommittedLeadEvent[] = [];
      // The transaction's own write context: same operation instant, executor
      // swapped for the transaction handle.
      const txScope: WorkflowWriteContext = {
        executor: tx,
        operationAt: scope.operationAt,
      };

      const result = await body({
        tx,
        repos: createWorkflowRepos(tx),
        operationAt: scope.operationAt,
        commitTransition: async (transition, assignment) => {
          const outcome = await commitTransition(tx, transition, assignment);
          if (outcome.ok) {
            committed.push(
              ...pairCommittedEvents(transition.events, outcome.value.eventIds),
            );
          }
          return outcome;
        },
        appendFacts: async (events) => {
          const outcome = await appendFacts(tx, scope.operationAt, events);
          if (outcome.ok) {
            committed.push(
              ...pairCommittedEvents(events, outcome.value.eventIds),
            );
          }
          return outcome;
        },
      });

      if (isErr(result)) {
        throw new LeadTransactionRollback(result.error);
      }

      // Effects share the transaction with source events: no orphaned delivery.
      await enqueueLeadEffects(txScope, committed);
      return result;
    })
    .catch((error: unknown) => {
      if (error instanceof LeadTransactionRollback) {
        return Err(error.error);
      }
      throw error;
    });
}
