import { expectOk } from "@tests/support/_core/assertions";
import {
  actorBy,
  createLeadFixtureWriter,
} from "@tests/support/database/workflow-fixtures";
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

describe("lead detail setup pipeline", () => {
  let runtime: TestRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime("workflow-lead-detail-setup-pipeline");
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.reset();
    runtime.now.set(new Date(1_000));
  });

  it("composes profile from lead commercial scope, organization, and optional digital policy", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "setup",
      key: "detail-profile",
      organization: {
        key: "detail-profile",
        legalName: "Acme SAC",
        lineOfBusiness: "Retail",
      },
      commercial: {
        currentProvider: "Izipay",
        currentDebitRate: 2.9,
        currentCreditRate: 3.4,
        gpv: 80_000,
        ticket: 150,
        settlementBank: "BCP",
        posCount: 4,
      },
    });

    const initialDetail = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        { actorUserId: actor.userId, actorRole: actor.role, leadId: lead.id },
        operationAt(runtime.now.get()),
      ),
    );
    expect(initialDetail.lead).toMatchObject({
      ruc: lead.organization.ruc,
      legalName: "Acme SAC",
    });
    expect(initialDetail.profile).toMatchObject({
      currentProvider: "Izipay",
      currentDebitRate: 2.9,
      currentCreditRate: 3.4,
      gpv: 80_000,
      ticket: 150,
      lineOfBusiness: "Retail",
      settlementBank: "BCP",
      posCount: 4,
      linkScope: "none",
      linkUrl: null,
      onlineScope: "none",
      onlineUrl: null,
      onlineCollectionMode: null,
    });
    expect(initialDetail.blockingFields).toEqual(["digitalPolicy"]);

    const policyResult = await runtime.workflow.commands.saveDigitalPolicy(
      {
        actor,
        leadId: lead.id,
        linkScope: "per_venue",
        linkUrl: null,
        onlineScope: "per_venue",
        onlineUrl: null,
        onlineCollectionMode: null,
      },
      operationAt(runtime.now.get()),
    );
    expectOk(policyResult);

    const afterPolicy = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        { actorUserId: actor.userId, actorRole: actor.role, leadId: lead.id },
        operationAt(runtime.now.get()),
      ),
    );
    expect(afterPolicy.profile).toMatchObject({
      linkScope: "per_venue",
      linkUrl: null,
      onlineScope: "per_venue",
      onlineUrl: null,
      onlineCollectionMode: null,
    });
    expect(afterPolicy.blockingFields).toEqual(["venueAccounts"]);
  });

  it("persists per-venue digital configuration and clears setup blockers when venue accounts are complete", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "setup",
      key: "detail-venue-digital",
      organization: { key: "detail-venue-digital" },
    });

    expectOk(
      await runtime.workflow.commands.saveDigitalPolicy(
        {
          actor,
          leadId: lead.id,
          linkScope: "per_venue",
          linkUrl: null,
          onlineScope: "per_venue",
          onlineUrl: null,
          onlineCollectionMode: null,
        },
        operationAt(runtime.now.get()),
      ),
    );

    expectOk(
      await runtime.workflow.commands.createVenue(
        {
          actor,
          leadId: lead.id,
          tradeName: "Local Miraflores",
          posQuantity: 2,
          digitalConfig: {
            linkUrl: "https://pay.example/local-miraflores",
            onlineUrl: "https://shop.example/local-miraflores",
            onlineCollectionMode: "ONE_CLIC",
          },
          address: "Av. Nueva 123",
          addressReference: "Frente al parque",
          district: "Miraflores",
          province: "Lima",
          department: "Lima",
        },
        operationAt(runtime.now.get()),
      ),
    );

    const withVenue = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        { actorUserId: actor.userId, actorRole: actor.role, leadId: lead.id },
        operationAt(runtime.now.get()),
      ),
    );
    expect(withVenue.venues).toHaveLength(1);
    const [venue] = withVenue.venues;
    assert(venue, "the lead has one venue");
    expect(venue).toMatchObject({
      tradeName: "Local Miraflores",
      linkUrl: "https://pay.example/local-miraflores",
      onlineUrl: "https://shop.example/local-miraflores",
      onlineCollectionMode: "ONE_CLIC",
    });
    expect(withVenue.blockingFields).toEqual(["venueAccounts"]);

    expectOk(
      await runtime.workflow.commands.addVenueAccounts(
        {
          actor,
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

    const completed = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        { actorUserId: actor.userId, actorRole: actor.role, leadId: lead.id },
        operationAt(runtime.now.get()),
      ),
    );
    expect(completed.lead.stage).toBe("FULFILLMENT");
    expect(completed.blockingFields).toEqual([]);
    expect(completed.venues[0]?.solesAccount).toMatchObject({
      currency: "PEN",
      banco: "BCP",
      tipoCuenta: "AHORROS",
      nroCuenta: "19100000000001",
      isSettlement: true,
    });
  });
});
