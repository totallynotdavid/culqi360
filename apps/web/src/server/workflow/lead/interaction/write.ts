import type { AddLeadNoteInput } from "~/contracts/workflow/inputs";
import { fail, type DomainError } from "~/domain/errors";
import type { WorkflowLeadId } from "~/domain/ids";
import type { WorkflowActor } from "~/server/workflow/actor";
import { runLeadTransaction } from "~/server/workflow/lead/write/transition";
import type { WorkflowWriteContext } from "~/server/workflow/types";
import { Err, isErr, Ok, type Result } from "~/shared/result";

import { recordNote } from "./domain";

export async function addLeadNote(
  input: Omit<AddLeadNoteInput, "leadId"> & {
    actor: WorkflowActor;
    leadId: WorkflowLeadId;
  },
  scope: WorkflowWriteContext,
): Promise<Result<{ interactionId: string }, DomainError>> {
  return runLeadTransaction(scope, async (ctx) => {
    const state = await ctx.repos.leads.findById(input.leadId);
    if (!state) {
      return Err(fail("lead_not_found"));
    }

    const events = recordNote(state, {
      actor: input.actor,
      body: input.body,
      occurredAt: ctx.operationAt,
    });
    if (isErr(events)) {
      return Err(events.error);
    }

    const appended = await ctx.appendFacts(events.value);
    if (!appended.ok) {
      return appended;
    }

    const [interactionId] = appended.value.eventIds;
    if (interactionId === undefined) {
      throw new Error("Lead note was appended without an event id");
    }

    return Ok({ interactionId });
  });
}
