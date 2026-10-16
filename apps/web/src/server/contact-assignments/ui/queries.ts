import type { LeadCapacitySnapshot } from "~/contracts/capacity";
import type { MyContactAssignmentView } from "~/contracts/contact-assignments/views";
import { getApplication } from "~/server/composition/application";
import { executeSessionServerFunction } from "~/server/platform/action";

export async function getMyContactAssignmentCapacity(): Promise<LeadCapacitySnapshot> {
  return executeSessionServerFunction({
    name: "contact_assignments.get_capacity",
    access: { kind: "permission", permission: "capacity:read:self" },
    execute: (ctx) =>
      getApplication().contactAssignments.getCapacity(ctx.actor.userId, ctx),
  });
}

export async function getMyContactAssignments(): Promise<
  MyContactAssignmentView[]
> {
  return executeSessionServerFunction({
    name: "contact_assignments.list_mine",
    access: { kind: "permission", permission: "lead:work" },
    execute: (ctx) =>
      getApplication().contactAssignments.listActive(ctx.actor.userId, ctx),
  });
}
