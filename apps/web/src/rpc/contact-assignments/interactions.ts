import type { ActionSuccess } from "~/contracts/common";
import { CONTACT_ASSIGNMENT_CALL_OUTCOMES } from "~/contracts/contact-assignments/vocabulary";
import { ContactAssignmentId, OrganizationPersonId } from "~/domain/ids";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";
import {
  parseObject,
  validationFail,
} from "~/server/platform/action/input-reader";

export async function completeContactAssignmentCall(
  input: unknown,
): Promise<ActionSuccess> {
  "use server";

  return executeSessionServerFunction({
    name: "contact_assignments.complete_call",
    access: { kind: "permission", permission: "lead:work" },

    parse: () =>
      parseObject(input, validationFail, (r) => ({
        assignmentId: r.id("assignmentId", ContactAssignmentId),
        contactId: r.id("contactId", OrganizationPersonId),
        outcome: r.enum("outcome", CONTACT_ASSIGNMENT_CALL_OUTCOMES),
        notes: r.optStr("notes") ?? null,
      })),

    telemetry: ({ assignmentId, contactId }) => ({
      assignmentId,
      contactId,
    }),

    execute: (ctx, command) =>
      getApplication().contactAssignments.completeCall(
        {
          actorUserId: ctx.actor.userId,
          assignmentId: command.assignmentId,
          contactId: command.contactId,
          outcome: command.outcome,
          notes: command.notes,
        },
        ctx,
      ),
  });
}
