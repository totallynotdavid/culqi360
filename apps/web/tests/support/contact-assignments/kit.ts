import type { TestDbContext } from "@tests/support/runtime/db";

import type { OrganizationPersonId, UserId } from "~/domain/ids";

export type ContactAssignmentSeedRow = {
  userId: UserId;
  contactId: OrganizationPersonId;
  assignedAt: Date;
  expiresAt: Date;
  status: "active" | "completed";
};

export function createContactAssignmentsTestKit(ctx: TestDbContext) {
  return {
    async seedAssignments(rows: ContactAssignmentSeedRow[]): Promise<void> {
      if (rows.length === 0) {
        return;
      }
      await ctx.db
        .insertInto("contact_assignments")
        .values(
          // `id` defaults to `uuidv7()` in production (nothing constructs it
          // manually), so the seed leaves it unset rather than fabricating a
          // placeholder that doesn't match the column's real uuid type.
          rows.map((row) => ({
            user_id: row.userId,
            contact_id: row.contactId,
            assigned_at: row.assignedAt,
            expires_at: row.expiresAt,
            status: row.status,
          })),
        )
        .execute();
    },

    async activeContactIdsForUser(
      userId: UserId,
      asOf: Date = new Date(),
    ): Promise<OrganizationPersonId[]> {
      const rows = await ctx.repos.contactAssignments.findActiveByUser(
        userId,
        asOf,
      );
      return rows.map((row) => row.contact_id);
    },

    async hasActiveAssignment(
      userId: UserId,
      contactId: OrganizationPersonId,
      asOf: Date = new Date(),
    ): Promise<boolean> {
      return ctx.repos.contactAssignments.hasActiveForContact(
        userId,
        contactId,
        asOf,
      );
    },
  };
}
