import { expectErr, expectOk } from "@tests/support/_core/assertions";
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

describe("update venue", () => {
  let runtime: TestRuntime;

  beforeAll(async () => {
    runtime = await createTestRuntime("workflow-update-venue");
  });

  afterAll(async () => {
    await runtime.dispose();
  });

  beforeEach(async () => {
    await runtime.reset();
  });

  it("updates venue fields during setup", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "setup",
      key: "venue-update",
      organization: { key: "venue-update" },
    });

    expectOk(
      await runtime.workflow.commands.createVenue(
        {
          actor,
          leadId: lead.id,
          tradeName: "Local antiguo",
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

    const seeded = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    const [seededVenue] = seeded.venues;
    assert(seededVenue, "the lead has one venue");
    const venueId = WorkflowVenueId.trust(seededVenue.id);

    const result = await runtime.workflow.commands.updateVenue(
      {
        actor,
        leadId: lead.id,
        venueId,
        tradeName: "Local corregido",
        posQuantity: 3,
        address: "Av. Nueva 123",
        addressReference: "Frente al parque",
        district: "Miraflores",
        province: "Lima",
        department: "Lima",
      },
      operationAt(runtime.now.get()),
    );
    expectOk(result);

    const updated = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expect(updated.venues[0]).toMatchObject({
      tradeName: "Local corregido",
      posQuantity: 3,
      address: "Av. Nueva 123",
    });
  });

  it("blocks venue updates after setup", async () => {
    const actor = actorBy("execOne");
    const lead = await createLeadFixtureWriter(runtime)({
      kind: "live",
      key: "venue-update-live",
      organization: { key: "venue-update-live" },
    });
    const venueId = lead.venueIds[0];
    assert(venueId, "the lead has a venue");

    const detail = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expect(detail.lead.stage).toBe("LIVE");
    expect(detail.availableActions).not.toContain("update-venue");
    const originalTradeName = detail.venues[0]?.tradeName;
    assert(originalTradeName, "the venue has a trade name");

    const result = await runtime.workflow.commands.updateVenue(
      {
        actor,
        leadId: lead.id,
        venueId,
        tradeName: "Local cambiado",
        posQuantity: 4,
        address: "Av. Cambio 456",
        addressReference: "Esquina",
        district: "San Isidro",
        province: "Lima",
        department: "Lima",
      },
      operationAt(runtime.now.get()),
    );

    const error = expectErr(result);
    expect(error.code).toBe("invalid_stage");

    const after = expectOk(
      await runtime.workflow.queries.getLeadDetail(
        {
          actorUserId: actor.userId,
          actorRole: actor.role,
          leadId: lead.id,
        },
        operationAt(runtime.now.get()),
      ),
    );
    expect(after.venues[0]?.tradeName).toBe(originalTradeName);
  });
});
