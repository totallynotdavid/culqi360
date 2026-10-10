import { expectErr, expectOk } from "@tests/support/_core/assertions";
import {
  actorBy,
  createLeadFixtureWriter,
} from "@tests/support/database/workflow-fixtures";
import { proposePendingRate } from "@tests/support/integration/pricing";
import { operationAt } from "@tests/support/operation";
import {
  createTestRuntime,
  type TestRuntime,
} from "@tests/support/runtime/app";
import { randomUUIDv7 } from "bun";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { UserId, WorkflowLeadId } from "~/domain/ids";
import {
  WorkflowRateRevisionFileId,
  WorkflowRateRevisionId,
} from "~/domain/ids";

async function seedRateRevisionFile(
  runtime: TestRuntime,
  input: {
    fileId: WorkflowRateRevisionFileId;
    leadId: WorkflowLeadId;
    uploadedByUserId: UserId;
    linkedRevisionId?: WorkflowRateRevisionId;
  },
): Promise<void> {
  const now = runtime.now.get();

  const { id: fileAssetId } = await runtime.ctx.db
    .insertInto("file_assets")
    .values({
      storage_key: `test/${input.fileId}.xlsx`,
      purpose: "rate_revision_file",
      original_filename: "support.xlsx",
      safe_display_filename: "support.xlsx",
      detected_mime:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      extension: "xlsx",
      size_bytes: 4,
      sha256_hex:
        "0000000000000000000000000000000000000000000000000000000000000000",
      signature_kind: "xlsx",
      scan_status: "clean",
      scan_engine: null,
      scan_reference: null,
      created_by_user_id: input.uploadedByUserId,
      created_at: now,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await runtime.ctx.db
    .insertInto("workflow_rate_revision_files")
    .values({
      id: input.fileId,
      lead_id: input.leadId,
      revision_id: input.linkedRevisionId ?? null,
      file_asset_id: fileAssetId,
      uploaded_by_user_id: input.uploadedByUserId,
      created_at: now,
    })
    .executeTakeFirstOrThrow();
}

describe("request rate revision command", () => {
  let runtime: TestRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime("workflow-rate-revision");
  }, 30_000);

  afterAll(async () => {
    await runtime.dispose();
  }, 30_000);

  beforeEach(async () => {
    await runtime.reset();
    runtime.now.set(new Date(1_000));
  });

  async function loadDetail(leadId: WorkflowLeadId) {
    const actor = actorBy("execOne");

    return expectOk(
      await runtime.workflow.queries.getLeadDetail(
        { actorUserId: actor.userId, actorRole: actor.role, leadId },
        operationAt(runtime.now.get()),
      ),
    );
  }

  it("requires a pending proposal before opening a revision round", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "pricing",
      proposal: "none",
      key: "revision-no-proposal",
      organization: { key: "revision-no-proposal" },
    });
    const fileId = WorkflowRateRevisionFileId.trust(randomUUIDv7());

    await seedRateRevisionFile(runtime, {
      fileId,
      leadId: lead.id,
      uploadedByUserId: actor.userId,
    });

    const result = await runtime.workflow.commands.requestRateRevision(
      {
        actor,
        leadId: lead.id,
        justification: "Need better rate",
        fileIds: [fileId],
      },
      operationAt(runtime.now.get()),
    );

    expect(expectErr(result).code).toBe("rate_proposal_not_found");
    expect((await loadDetail(lead.id)).rateRevisions).toHaveLength(0);
  });

  it("creates a revision, links ready files, and marks the proposal decided", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "pricing",
      proposal: "none",
      key: "revision-ready",
      organization: { key: "revision-ready" },
    });
    const { proposalId } = await proposePendingRate(runtime, {
      leadId: lead.id,
      backOffice: actorBy("backOne"),
    });
    const fileId = WorkflowRateRevisionFileId.trust(randomUUIDv7());

    await seedRateRevisionFile(runtime, {
      fileId,
      leadId: lead.id,
      uploadedByUserId: actor.userId,
    });

    const result = await runtime.workflow.commands.requestRateRevision(
      {
        actor,
        leadId: lead.id,
        justification: "Need better rate",
        fileIds: [fileId],
      },
      operationAt(runtime.now.get()),
    );

    expectOk(result);

    const detail = await loadDetail(lead.id);
    const proposal = detail.rateProposals.find(
      (candidate) => candidate.id === proposalId,
    );

    expect(proposal?.outcome).toBe("revision_requested");
    expect(detail.rateRevisions).toHaveLength(1);
    expect(detail.rateRevisions[0]).toMatchObject({
      round: 1,
      justification: "Need better rate",
    });
    expect(detail.rateRevisions[0]?.files.map((file) => file.fileId)).toEqual([
      fileId,
    ]);
  });

  it("rolls back when duplicate file ids fail transition validation", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "pricing",
      proposal: "none",
      key: "revision-duplicate",
      organization: { key: "revision-duplicate" },
    });
    const { proposalId } = await proposePendingRate(runtime, {
      leadId: lead.id,
      backOffice: actorBy("backOne"),
    });
    const fileId = WorkflowRateRevisionFileId.trust(randomUUIDv7());

    await seedRateRevisionFile(runtime, {
      fileId,
      leadId: lead.id,
      uploadedByUserId: actor.userId,
    });

    const result = await runtime.workflow.commands.requestRateRevision(
      {
        actor,
        leadId: lead.id,
        justification: "Need better rate",
        fileIds: [fileId, fileId],
      },
      operationAt(runtime.now.get()),
    );

    expect(expectErr(result).code).toBe("duplicate_rate_revision_file");

    const detail = await loadDetail(lead.id);

    expect(detail.rateRevisions).toHaveLength(0);
    expect(
      detail.rateProposals.find((proposal) => proposal.id === proposalId)
        ?.outcome,
    ).toBe("pending");
  });

  it.each([
    {
      name: "uploaded by another user",
      fileId: WorkflowRateRevisionFileId.trust(randomUUIDv7()),
      override: () => ({
        uploadedByUserId: actorBy("execTwo").userId,
      }),
    },
    {
      name: "unknown",
      fileId: WorkflowRateRevisionFileId.trust(randomUUIDv7()),
      seed: false,
    },
  ])(
    "rejects a staged file that is $name",
    async ({ fileId, override, seed = true }) => {
      const actor = actorBy("execOne");
      const lead = await createLeadFixtureWriter(runtime)({
        kind: "pricing",
        proposal: "none",
        key: fileId,
        organization: { key: fileId },
      });

      await proposePendingRate(runtime, {
        leadId: lead.id,
        backOffice: actorBy("backOne"),
      });

      if (seed) {
        await seedRateRevisionFile(runtime, {
          fileId,
          leadId: lead.id,
          uploadedByUserId: actor.userId,
          ...override?.(),
        });
      }

      const result = await runtime.workflow.commands.requestRateRevision(
        {
          actor,
          leadId: lead.id,
          justification: "Need better rate",
          fileIds: [fileId],
        },
        operationAt(runtime.now.get()),
      );

      expect(expectErr(result).code).toBe(
        "rate_revision_file_not_submit_ready",
      );
      expect((await loadDetail(lead.id)).rateRevisions).toHaveLength(0);
    },
  );

  it("rejects already linked revision files", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "pricing",
      proposal: "none",
      key: "revision-linked",
      organization: { key: "revision-linked" },
    });
    const { proposalId } = await proposePendingRate(runtime, {
      leadId: lead.id,
      backOffice: actorBy("backOne"),
    });

    // This state cannot be reached through the normal command sequence because
    // creating a revision decides the proposal, so the revision is seeded directly.
    const revisionId = WorkflowRateRevisionId.trust("revision-existing");

    await runtime.ctx.db
      .insertInto("workflow_rate_revisions")
      .values({
        id: revisionId,
        lead_id: lead.id,
        proposal_id: proposalId,
        round: 1,
        justification: "Previous revision",
        requested_by: actor.userId,
        requested_at: runtime.now.get(),
      })
      .executeTakeFirstOrThrow();

    const fileId = WorkflowRateRevisionFileId.trust(randomUUIDv7());

    await seedRateRevisionFile(runtime, {
      fileId,
      leadId: lead.id,
      uploadedByUserId: actor.userId,
      linkedRevisionId: revisionId,
    });

    const result = await runtime.workflow.commands.requestRateRevision(
      {
        actor,
        leadId: lead.id,
        justification: "Need better rate",
        fileIds: [fileId],
      },
      operationAt(runtime.now.get()),
    );

    expect(expectErr(result).code).toBe("rate_revision_file_not_submit_ready");
    expect((await loadDetail(lead.id)).rateRevisions).toHaveLength(1);
  });
});
