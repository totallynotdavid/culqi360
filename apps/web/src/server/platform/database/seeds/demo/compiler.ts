import {
  FulfillmentOrderId,
  WorkflowLeadId,
  WorkflowRateProposalId,
  WorkflowRateRevisionId,
  WorkflowVenueId,
} from "~/domain/ids";

import { stableSeedId } from "../shared/stable-id";
import {
  BACK_OFFICE,
  EXECUTIVES,
  LEAD_SPECS,
  SUPERVISORS,
  type LeadSpec,
  type RateProposalSpec,
} from "./scenario";

export interface CompiledRateProposal {
  spec: RateProposalSpec;
  id: WorkflowRateProposalId;
  revisionId: WorkflowRateRevisionId | null;
}

export interface CompiledLead {
  spec: LeadSpec;
  projection: {
    stage: LeadSpec["stage"];
    status: LeadSpec["status"];
    priority: LeadSpec["priority"];
    updatedOffsetDays: number;
  };
  leadId: WorkflowLeadId;
  assignmentId: string;
  proposals: CompiledRateProposal[];
  venueId: WorkflowVenueId | null;
  venueAccountIds: string[];
  fulfillmentOrderId: FulfillmentOrderId | null;
  fulfillmentUnitIds: string[];
}

export interface CompiledWorkflowScenario {
  leads: CompiledLead[];
  generatedAtMs: number;
  dayMs: number;
  overlayTtlMs: number;
}

export function compileWorkflowScenario(
  anchorMs: number,
): CompiledWorkflowScenario {
  const keys = new Set<string>();
  const rucs = new Set<string>();
  const leads = LEAD_SPECS.map((spec) => {
    if (keys.has(spec.key)) {
      throw new Error(`duplicate_workflow_seed_key:${spec.key}`);
    }
    keys.add(spec.key);
    if (rucs.has(spec.org.ruc)) {
      throw new Error(`duplicate_workflow_seed_ruc:${spec.org.ruc}`);
    }
    rucs.add(spec.org.ruc);
    validateLeadStory(spec);
    return compileLead(spec);
  });

  return {
    leads,
    generatedAtMs: anchorMs,
    dayMs: 86_400_000,
    overlayTtlMs: 7 * 86_400_000,
  };
}

function compileLead(spec: LeadSpec): CompiledLead {
  return {
    spec,
    projection: deriveProjection(spec),
    leadId: WorkflowLeadId.trust(stableSeedId(`lead:${spec.key}`)),
    assignmentId: stableSeedId(`lead-assignment:${spec.key}`),
    proposals: (spec.proposals ?? []).map((proposal) => ({
      spec: proposal,
      id: WorkflowRateProposalId.trust(
        stableSeedId(`rate-proposal:${spec.key}:${proposal.round}`),
      ),
      revisionId:
        proposal.outcome === "revision_requested"
          ? WorkflowRateRevisionId.trust(
              stableSeedId(`rate-revision:${spec.key}:${proposal.round}`),
            )
          : null,
    })),
    venueId: spec.venue
      ? WorkflowVenueId.trust(stableSeedId(`venue:${spec.key}`))
      : null,
    venueAccountIds: (spec.venue?.accounts ?? []).map((account) =>
      stableSeedId(`venue-account:${spec.key}:${account.currency}`),
    ),
    fulfillmentOrderId: spec.fulfillment
      ? FulfillmentOrderId.trust(stableSeedId(`fulfillment-order:${spec.key}`))
      : null,
    fulfillmentUnitIds: Array.from(
      { length: fulfillmentUnitCount(spec) },
      (_, index) => stableSeedId(`fulfillment-unit:${spec.key}:${index}`),
    ),
  };
}

function fulfillmentUnitCount(spec: LeadSpec): number {
  const fulfillment = spec.fulfillment;
  if (!fulfillment || fulfillment.productKind === null) {
    return 0;
  }
  if (fulfillment.productKind === "digital_only") {
    return 1;
  }
  return Math.max(1, spec.venue?.posQuantity ?? 1);
}

function deriveProjection(spec: LeadSpec): CompiledLead["projection"] {
  const stage =
    spec.close !== undefined
      ? "CLOSED_LOST"
      : spec.expiredOffsetDays !== undefined
        ? "EXPIRED"
        : (spec.advances?.at(-1)?.to ?? spec.review?.toStage ?? "QUALIFYING");
  const eventOffsets = [
    spec.createdOffsetDays,
    spec.review?.offsetDays,
    ...(spec.proposals ?? []).flatMap((proposal) => [
      proposal.proposedOffsetDays,
      proposal.decidedOffsetDays,
    ]),
    ...(spec.advances ?? []).map((advance) => advance.offsetDays),
    spec.venue?.createdOffsetDays,
    spec.venue ? Math.max(0, spec.venue.createdOffsetDays - 2) : undefined,
    spec.fulfillment?.chosenOffsetDays,
    spec.digitalPolicy?.updatedOffsetDays,
    spec.legalRep?.offsetDays,
    spec.close?.offsetDays,
    spec.expiredOffsetDays,
  ].filter((offset): offset is number => offset !== undefined);

  return {
    stage,
    status: spec.review?.status ?? null,
    priority: spec.review?.priority ?? null,
    updatedOffsetDays: Math.min(...eventOffsets),
  };
}

function validateLeadStory(spec: LeadSpec): void {
  requireMember("executive", spec.key, spec.executiveId, EXECUTIVES);
  requireMember("creator", spec.key, spec.createdBy, SUPERVISORS);

  if (spec.review) {
    requireMember("reviewer", spec.key, spec.review.by, BACK_OFFICE);
  }
  for (const proposal of spec.proposals ?? []) {
    requireMember("proposer", spec.key, proposal.proposedBy, BACK_OFFICE);
    if (
      proposal.outcome !== "pending" &&
      proposal.decidedOffsetDays === undefined
    ) {
      throw new Error(`missing_workflow_seed_rate_decision:${spec.key}`);
    }
    if (
      proposal.outcome === "pending" &&
      proposal.decidedOffsetDays !== undefined
    ) {
      throw new Error(`invalid_workflow_seed_pending_decision:${spec.key}`);
    }
    if (
      proposal.acceptedBy !== undefined &&
      proposal.acceptedBy !== spec.executiveId
    ) {
      throw new Error(`invalid_workflow_seed_rate_acceptor:${spec.key}`);
    }
    if (
      proposal.decidedOffsetDays !== undefined &&
      proposal.decidedOffsetDays >= proposal.proposedOffsetDays
    ) {
      throw new Error(`invalid_workflow_seed_proposal_timeline:${spec.key}`);
    }
  }
  if (spec.venue?.createdBy !== undefined) {
    requireOwner("venue_creator", spec, spec.venue.createdBy);
  }
  if (spec.digitalPolicy?.updatedBy !== undefined) {
    requireOwner("digital_policy_actor", spec, spec.digitalPolicy.updatedBy);
  }
  if (spec.close?.by !== undefined) {
    requireOwner("close_actor", spec, spec.close.by);
  }
  validateFulfillmentStory(spec);

  const eventOffsets = [
    spec.review?.offsetDays,
    ...(spec.proposals ?? []).flatMap((proposal) => [
      proposal.proposedOffsetDays,
      proposal.decidedOffsetDays,
    ]),
    ...(spec.advances ?? []).map((advance) => advance.offsetDays),
    spec.venue?.createdOffsetDays,
    spec.fulfillment?.chosenOffsetDays,
    spec.digitalPolicy?.updatedOffsetDays,
    spec.legalRep?.offsetDays,
    spec.close?.offsetDays,
    spec.expiredOffsetDays,
  ].filter((offset): offset is number => offset !== undefined);

  if (eventOffsets.some((offset) => offset > spec.createdOffsetDays)) {
    throw new Error(`invalid_workflow_seed_event_before_creation:${spec.key}`);
  }

  const projection = deriveProjection(spec);
  if (projection.stage !== spec.stage) {
    throw new Error(
      `invalid_workflow_seed_final_stage:${spec.key}:${projection.stage}:${spec.stage}`,
    );
  }
  if (
    projection.status !== spec.status ||
    projection.priority !== spec.priority
  ) {
    throw new Error(`invalid_workflow_seed_review_projection:${spec.key}`);
  }
}

// A fulfillment order is created the moment a lead's venue-accounts
// transition pushes it to FULFILLMENT (addVenueAccountsCommand), and reaching
// COMPLETED on it is what flips the lead to LIVE (completeFulfillment). So
// every FULFILLMENT/LIVE lead must carry one, LIVE must be COMPLETED, and a
// venue must exist -- these are not just coverage gaps, they are states the
// real domain logic could not otherwise produce.
function validateFulfillmentStory(spec: LeadSpec): void {
  const isPastSetup = spec.stage === "FULFILLMENT" || spec.stage === "LIVE";
  if (!isPastSetup) {
    if (spec.fulfillment !== undefined) {
      throw new Error(`invalid_workflow_seed_fulfillment_stage:${spec.key}`);
    }
    return;
  }

  if (spec.fulfillment === undefined) {
    throw new Error(`missing_workflow_seed_fulfillment:${spec.key}`);
  }
  if (spec.venue === undefined) {
    throw new Error(`missing_workflow_seed_fulfillment_venue:${spec.key}`);
  }

  const { productKind, targetStep, chosenOffsetDays } = spec.fulfillment;
  if (spec.stage === "LIVE" && targetStep !== "COMPLETED") {
    throw new Error(`invalid_workflow_seed_live_not_completed:${spec.key}`);
  }
  if (targetStep === "CHOOSE_PRODUCT") {
    if (productKind !== null || chosenOffsetDays !== undefined) {
      throw new Error(`invalid_workflow_seed_fulfillment_choice:${spec.key}`);
    }
  } else if (productKind === null || chosenOffsetDays === undefined) {
    throw new Error(`missing_workflow_seed_fulfillment_choice:${spec.key}`);
  }
}

function requireOwner(label: string, spec: LeadSpec, userId: string): void {
  if (userId === spec.executiveId) {
    return;
  }
  throw new Error(`invalid_workflow_seed_${label}:${spec.key}:${userId}`);
}

function requireMember(
  label: string,
  leadKey: string,
  userId: string,
  members: Record<string, string>,
): void {
  if (Object.values(members).includes(userId)) {
    return;
  }
  throw new Error(`invalid_workflow_seed_${label}:${leadKey}:${userId}`);
}
