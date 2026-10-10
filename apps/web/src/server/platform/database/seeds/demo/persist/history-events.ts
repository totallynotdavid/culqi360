import type { Kysely } from "kysely";

import {
  nextStep,
  stepDefinition,
  stepsForProduct,
} from "~/server/workflow/lead/fulfillment/steps";

import type { Database } from "../../../types";
import { stableSeedId } from "../../shared/stable-id";
import type { CompiledLead } from "../compiler";
import {
  fulfillmentEnteredOffsetDays,
  type FulfillmentSpec,
} from "../scenario";

interface EventDraft {
  leadId: string;
  type: string;
  actorUserId: string | null;
  subjectUserId: string | null;
  payload: Record<string, unknown>;
  occurredAtMs: number;
}

export async function persistWorkflowHistoryEvents(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const drafts = leads.flatMap((lead) => buildLeadEvents(lead, anchorMs, day));
  if (drafts.length === 0) {
    return;
  }

  await db
    .insertInto("events")
    .values(
      drafts.map((event, index) => ({
        id: stableSeedId(
          `lead-event:${event.leadId}:${event.occurredAtMs}:${event.type}:${index}`,
        ),
        entity_type: "lead",
        entity_id: event.leadId,
        type: event.type,
        actor_user_id: event.actorUserId,
        subject_user_id: event.subjectUserId,
        payload_json: JSON.stringify(event.payload),
        changes_json: null,
        occurred_at: new Date(event.occurredAtMs),
      })),
    )
    .execute();
}

function buildLeadEvents(
  lead: CompiledLead,
  anchorMs: number,
  day: number,
): EventDraft[] {
  const { spec } = lead;
  const at = (offsetDays: number, nudgeMs = 0) =>
    anchorMs - offsetDays * day + nudgeMs;
  const events: EventDraft[] = [];
  const push = (
    type: string,
    payload: Record<string, unknown>,
    occurredAtMs: number,
    actors: { actor?: string | null; subject?: string | null } = {},
  ) =>
    events.push({
      leadId: lead.leadId,
      type,
      actorUserId: actors.actor ?? null,
      subjectUserId: actors.subject ?? null,
      payload,
      occurredAtMs,
    });

  push(
    "lead_registered",
    { ruc: spec.org.ruc, toStage: "QUALIFYING" },
    at(spec.createdOffsetDays),
    { actor: spec.createdBy },
  );
  push(
    "lead_assigned",
    { executiveId: spec.executiveId },
    at(spec.createdOffsetDays, 1_000),
    { actor: spec.createdBy, subject: spec.executiveId },
  );

  if (spec.review) {
    push(
      "lead_status_updated",
      {
        fromStatus: null,
        toStatus: spec.review.status,
        reason: spec.review.reason,
      },
      at(spec.review.offsetDays),
      { actor: spec.review.by },
    );
    push(
      "lead_priority_updated",
      {
        fromPrioridad: null,
        toPrioridad: spec.review.priority,
        reason: spec.review.reason,
      },
      at(spec.review.offsetDays, 25),
      { actor: spec.review.by },
    );
    push(
      "lead_reviewed",
      {
        status: spec.review.status,
        priority: spec.review.priority,
        reason: spec.review.reason,
        fromStage: "QUALIFYING",
        toStage: spec.review.toStage,
      },
      at(spec.review.offsetDays, 50),
      { actor: spec.review.by },
    );
    push(
      "workflow_stage_changed",
      { from: "QUALIFYING", to: spec.review.toStage },
      at(spec.review.offsetDays, 100),
    );
  }

  lead.proposals.forEach(({ spec: proposal, id, revisionId }) => {
    push(
      "rate_proposed",
      {
        proposalId: id,
        round: proposal.round,
        currency: proposal.currency,
      },
      at(proposal.proposedOffsetDays),
      { actor: proposal.proposedBy },
    );
    if (
      proposal.outcome === "accepted" &&
      proposal.decidedOffsetDays !== undefined
    ) {
      push(
        "rate_accepted",
        { proposalId: id },
        at(proposal.decidedOffsetDays),
        { actor: proposal.acceptedBy ?? spec.executiveId },
      );
    }
    if (
      proposal.outcome === "revision_requested" &&
      proposal.decidedOffsetDays !== undefined
    ) {
      push(
        "rate_revision_requested",
        {
          revisionId,
          round: proposal.round,
          justification: "El comercio solicita una tarifa más competitiva",
        },
        at(proposal.decidedOffsetDays),
        { actor: spec.executiveId },
      );
    }
  });

  let fromStage = "PRICING";
  for (const advance of spec.advances ?? []) {
    push(
      "workflow_stage_changed",
      { from: fromStage, to: advance.to },
      at(advance.offsetDays, 100),
    );
    fromStage = advance.to;
  }

  if (spec.venue) {
    push(
      "venue_added",
      { venueId: lead.venueId, tradeName: spec.venue.tradeName },
      at(spec.venue.createdOffsetDays),
      { actor: spec.venue.createdBy },
    );
    push(
      "venue_accounts_added",
      { venueId: lead.venueId },
      at(Math.max(0, spec.venue.createdOffsetDays - 2)),
      { actor: spec.venue.createdBy },
    );
  }

  if (spec.fulfillment) {
    pushFulfillmentEvents(lead, spec.fulfillment, push, at);
  }

  if (spec.legalRep) {
    push(
      "rep_legal_recorded",
      {
        nombres: spec.legalRep.names,
        apellidoPaterno: spec.legalRep.firstSurname,
        apellidoMaterno: spec.legalRep.secondSurname,
        dni: spec.legalRep.dni,
        telefono: spec.legalRep.phone,
        email: spec.legalRep.email,
      },
      at(spec.legalRep.offsetDays),
      { actor: spec.executiveId },
    );
  }

  if (spec.close) {
    push(
      "lead_closed",
      {
        reason: spec.close.reason,
        note: spec.close.note,
        fromStage: "PRICING",
      },
      at(spec.close.offsetDays),
      { actor: spec.close.by },
    );
    push(
      "workflow_stage_changed",
      { from: "PRICING", to: "CLOSED_LOST" },
      at(spec.close.offsetDays, 100),
      { actor: spec.close.by },
    );
  }

  if (spec.expiredOffsetDays !== undefined) {
    push(
      "lead_reservation_expired",
      { fromStage: "PRICING" },
      at(spec.expiredOffsetDays),
    );
  }

  return events;
}

// Mirrors the transition events addVenueAccountsCommand / commands.ts /
// completeFulfillment emit in real operation, so a seeded lead's timeline has
// no gaps where these leads' fulfillment history should be. The
// FULFILLMENT -> LIVE workflow_stage_changed pair itself is already covered
// by the advances loop above; this only adds the fulfillment-specific events.
function pushFulfillmentEvents(
  lead: CompiledLead,
  fulfillment: FulfillmentSpec,
  push: (
    type: string,
    payload: Record<string, unknown>,
    occurredAtMs: number,
    actors?: { actor?: string | null; subject?: string | null },
  ) => void,
  at: (offsetDays: number, nudgeMs?: number) => number,
): void {
  const { spec } = lead;
  const orderId = lead.fulfillmentOrderId;
  push(
    "fulfillment_started",
    { orderId, unitCount: 0 },
    at(fulfillmentEnteredOffsetDays(spec)),
    { actor: spec.executiveId },
  );

  if (
    fulfillment.productKind === null ||
    fulfillment.chosenOffsetDays === undefined
  ) {
    return;
  }

  const sequence = stepsForProduct(fulfillment.productKind);
  const targetIndex = sequence.indexOf(fulfillment.targetStep);
  const chosenAtMs = at(fulfillment.chosenOffsetDays);
  const anchorMs = at(0);
  const stepGapMs =
    targetIndex > 0 ? (anchorMs - chosenAtMs) / (targetIndex + 1) : 0;
  const stepAtMs = (index: number) => chosenAtMs + index * stepGapMs;

  push(
    "fulfillment_product_chosen",
    { orderId, productKind: fulfillment.productKind },
    chosenAtMs,
    { actor: spec.executiveId },
  );
  push(
    "fulfillment_step_advanced",
    {
      orderId,
      from: "CHOOSE_PRODUCT",
      to: sequence[1],
      action: "choose_product",
    },
    chosenAtMs + 1,
    { actor: spec.executiveId },
  );

  for (const [offset, from] of sequence.slice(1, targetIndex).entries()) {
    const to = nextStep(fulfillment.productKind, from);
    const atMs = stepAtMs(offset + 2);
    const actor =
      stepDefinition(from).owner === "back_office"
        ? (spec.review?.by ?? spec.executiveId)
        : spec.executiveId;

    if (to === "COMPLETED") {
      push("fulfillment_completed", { orderId }, atMs, { actor });
      continue;
    }
    push(
      "fulfillment_step_advanced",
      { orderId, from, to, action: stepDefinition(from).action },
      atMs,
      { actor },
    );
  }
}
