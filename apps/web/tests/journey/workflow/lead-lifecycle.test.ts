import { expectOk } from "@tests/support/_core/assertions";
import { actorBy } from "@tests/support/database/workflow-fixtures";
import { withMerchantDefaults } from "@tests/support/database/workflow-seed";
import { createWorkflowImporter } from "@tests/support/integration/workflow-import";
import { operationAt } from "@tests/support/operation";
import {
  createTestRuntime,
  type TestRuntime,
} from "@tests/support/runtime/app";
import {
  afterAll,
  assert,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import { WorkflowVenueId } from "~/domain/ids";

describe("lead lifecycle journey", () => {
  let runtime: TestRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime("journey-lead-lifecycle");
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.reset();
    runtime.now.set(new Date(1_700_000_000_000));
  });

  it("moves a registered lead through pricing and setup into fulfillment", async () => {
    const executive = actorBy("execOne");
    const backOffice = actorBy("backOne");
    const registered = expectOk(
      await runtime.workflow.commands.registerLead(
        {
          actor: executive,
          ruc: "20987654321",
          lineOfBusiness: "Retail",
          ...withMerchantDefaults(undefined),
        },
        operationAt(runtime.now.get()),
      ),
    );
    const lead = {
      id: registered.leadId,
      organization: { ruc: "20987654321" },
    };
    const importer = createWorkflowImporter({
      runtime,
    });

    await importer.run({
      actor: "backOne",
      rows: [
        { type: "status", lead, status: "DISPONIBLE" },
        { type: "priority", lead, priority: "P1" },
      ],
    });

    const proposal = expectOk(
      await runtime.workflow.commands.proposeRate(
        {
          actor: backOffice,
          leadId: lead.id,
          proposedDebitRate: 2.5,
          proposedCreditRate: 3,
          proposedForeignRate: 3.5,
          fee: 0.5,
          paybackPricing: 12,
          currency: "PEN",
        },
        operationAt(runtime.now.get()),
      ),
    );
    expectOk(
      await runtime.workflow.commands.acceptRate(
        {
          actor: executive,
          leadId: lead.id,
          proposalId: proposal.proposalId,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expectOk(
      await runtime.workflow.commands.saveDigitalPolicy(
        {
          actor: executive,
          leadId: lead.id,
          linkScope: "none",
          linkUrl: null,
          onlineScope: "none",
          onlineUrl: null,
          onlineCollectionMode: null,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expectOk(
      await runtime.workflow.commands.createVenue(
        {
          actor: executive,
          leadId: lead.id,
          tradeName: "Local principal",
          posQuantity: 1,
          address: "Av. Principal 100",
          addressReference: "Primer piso",
          district: "Lima",
          province: "Lima",
          department: "Lima",
        },
        operationAt(runtime.now.get()),
      ),
    );

    const setup = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: executive.userId,
          actorRole: executive.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    const [venue] = setup.venues;
    assert(venue, "the lead has one venue");
    expectOk(
      await runtime.workflow.commands.addVenueAccounts(
        {
          actor: executive,
          leadId: lead.id,
          venueId: WorkflowVenueId.trust(venue.id),
          solesAccount: {
            currency: "PEN",
            banco: "BCP",
            tipoCuenta: "AHORROS",
            nroCuenta: "19100000000001",
            cci: "00219100000000000001",
            isSettlement: true,
          },
        },
        operationAt(runtime.now.get()),
      ),
    );

    const fulfillment = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: executive.userId,
          actorRole: executive.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expect(fulfillment.lead.stage).toBe("FULFILLMENT");
    expect(fulfillment.fulfillment?.currentStep).toBe("CHOOSE_PRODUCT");
  });
});
