import { operationAt } from "@tests/support/operation";

import type { BranchId, OrganizationPersonId, UserId } from "~/domain/ids";
import { ContactAssignmentId } from "~/domain/ids";
import { createExtensionService } from "~/server/extension/service";
import type { ExtensionRepos } from "~/server/extension/service/shared";
import { createFileStorage } from "~/server/files/storage";
import type { AppUow } from "~/server/platform/database/uow";
import { Err, type Result } from "~/shared/result";

import { TEST_FIXTURES, type TestDbContext } from "../runtime/db";
import { createTestRepositories } from "../runtime/repos";

export function createTransactionRunner(ctx: TestDbContext) {
  class TestRollbackError<TError> extends Error {
    constructor(readonly error: TError) {
      super("rollback");
    }
  }

  return {
    async run<T, TError>(
      work: (
        transactionRepos: TestDbContext["repos"],
      ) => Promise<Result<T, TError>>,
    ): Promise<Result<T, TError>> {
      try {
        return await ctx.db.transaction().execute(async (transactionDb) => {
          const result = await work(createTestRepositories(transactionDb));
          if (!result.ok) {
            throw new TestRollbackError(result.error);
          }
          return result;
        });
      } catch (error) {
        if (error instanceof TestRollbackError) {
          return Err(error.error);
        }
        throw error;
      }
    },
  };
}

/** A unit of work whose database fails before anything is written. */
export function rejectingUow(error: Error): AppUow<ExtensionRepos> {
  return {
    run: () => {
      throw error;
    },
  };
}

/** Commits the work, then fails, as a connection lost before the ack would. */
export function commitThenRejectUow(
  ctx: TestDbContext,
  error: Error,
): AppUow<ExtensionRepos> {
  const real = createTransactionRunner(ctx);
  return {
    run: async (work) => {
      await real.run(work);
      throw error;
    },
  };
}

export function createExtensionScenario(
  ctx: TestDbContext,
  now: () => Date = () => new Date(),
) {
  const storage = createFileStorage(ctx.storageRoot);
  const service = createExtensionService(ctx.repos, {
    uow: createTransactionRunner(ctx),
    storage,
  });

  return {
    service,
    storage,
    async session(
      input: {
        userId?: UserId;
        branchId?: BranchId;
        sessionId?: string;
      } = {},
    ) {
      const authSessionId = input.sessionId ?? crypto.randomUUID();
      const currentTime = now();
      await ctx.repos.sessions.create({
        id: authSessionId,
        user_id: input.userId ?? TEST_FIXTURES.users.execOne.id,
        branch_id: input.branchId ?? TEST_FIXTURES.branches.lima.id,
        role: "executive",
        session_class: "app",
        primary_auth_method: "password",
        strong_auth_method: null,
        strong_auth_at: null,
        ip_address: "127.0.0.1",
        user_agent: "vitest",
        created_at: currentTime,
        last_activity: currentTime,
        expires_at: new Date(currentTime.getTime() + 60 * 60_000),
      });
      return authSessionId;
    },
    async assignment(
      input: { userId?: UserId; contactId?: OrganizationPersonId } = {},
    ): Promise<ContactAssignmentId> {
      const currentTime = now();
      const assignmentId = ContactAssignmentId.trust(crypto.randomUUID());
      await ctx.db
        .insertInto("contact_assignments")
        .values({
          id: assignmentId,
          user_id: input.userId ?? TEST_FIXTURES.users.execOne.id,
          contact_id:
            input.contactId ?? TEST_FIXTURES.organizationPeople.lima.id,
          assigned_at: currentTime,
          expires_at: new Date(currentTime.getTime() + 60 * 60_000),
          status: "active",
        })
        .executeTakeFirstOrThrow();
      return assignmentId;
    },
    async contactWithoutPhone(sequence: number) {
      const currentTime = now();
      const dni = `7999${sequence.toString().padStart(4, "0")}`;
      // `id` defaults to `uuidv7()` on both tables (nothing constructs it
      // manually in production), so the seed leaves it unset.
      const person = await ctx.db
        .insertInto("people")
        .values({
          dni,
          names: "Contacto sin telefono",
          first_surname: null,
          second_surname: null,
          email: null,
          created_at: currentTime,
          updated_at: currentTime,
        })
        .onConflict((oc) => oc.column("dni").doNothing())
        .returning("id")
        .executeTakeFirstOrThrow();
      const organizationPerson = await ctx.db
        .insertInto("organization_people")
        .values({
          person_id: person.id,
          organization_id: ctx.fixtures.organizations.lima.id,
          phone: null,
          email: null,
          created_at: currentTime,
          updated_at: currentTime,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      return organizationPerson.id;
    },
    async handoff(executive: "execOne" | "execTwo" = "execOne") {
      const user = TEST_FIXTURES.users[executive];
      const contact =
        executive === "execOne"
          ? TEST_FIXTURES.organizationPeople.lima
          : TEST_FIXTURES.organizationPeople.norte;
      const authSessionId = await this.session({
        userId: user.id,
        branchId: user.branchId,
      });
      const assignmentId = await this.assignment({
        userId: user.id,
        contactId: contact.id,
      });
      const handoffResult = await service.createHandoffToken(
        {
          userId: user.id,
          authSessionId,
          branchId: user.branchId,
          assignmentId,
          origin: "http://localhost:3000",
        },
        operationAt(now()),
      );
      if (!handoffResult.ok) {
        throw new Error(handoffResult.error.code ?? handoffResult.error.kind);
      }
      return {
        authSessionId,
        assignmentId,
        handoffToken: handoffResult.value.handoffToken,
      };
    },
    async claim(
      installationId: string,
      executive: "execOne" | "execTwo" = "execOne",
    ) {
      const handoff = await this.handoff(executive);
      const claimResult = await service.claimInstallationSession(
        { handoffToken: handoff.handoffToken, installationId },
        operationAt(now()),
      );
      if (!claimResult.ok) {
        throw new Error(claimResult.error.code ?? claimResult.error.kind);
      }
      return {
        ...handoff,
        sessionToken: claimResult.value.sessionToken,
        callId: claimResult.value.callId,
      };
    },
  };
}
