import { randomUUIDv7 } from "bun";

import type {
  LeadPriority,
  LeadStage,
  LeadStatus,
} from "~/contracts/workflow/vocabulary";
import type {
  IntegrationJobId,
  WorkflowLeadId,
  WorkflowRateProposalId,
} from "~/domain/ids";
import { BranchId, OrganizationId, UserId } from "~/domain/ids";
import type { LeadCommercialScope } from "~/server/workflow/lead/domain/state";

import type { TestRuntime } from "../runtime/app";
import { MERCHANT } from "./workflow-defaults";

export type OrganizationSeedOptions = {
  key?: string;
  ruc?: string;
  legalName?: string | null;
  lineOfBusiness?: string | null;
};

export type LeadCommercialOptions = Partial<LeadCommercialScope>;

type OrganizationSeed = OrganizationSeedOptions & {
  key: string;
  id?: OrganizationId;
  createdAt?: Date;
};

export type SeededOrganizationRef = {
  id: OrganizationId;
  ruc: string;
  legalName: string | null;
};

type LeadSeed = {
  id: WorkflowLeadId;
  organizationId?: OrganizationId;
  organization?: SeededOrganizationRef;
  executiveId: UserId;
  stage: LeadStage;
  status: LeadStatus | null;
  priority: LeadPriority | null;
  createdBy?: UserId;
  updatedBy?: UserId | null;
  createdAt?: Date;
  updatedAt?: Date;
  reservationExpiresAt?: Date | null;
  commercial?: LeadCommercialOptions;
};

type LeadScenarioSeed = {
  organization: OrganizationSeed;
  lead: Omit<LeadSeed, "organization" | "organizationId">;
};

type UserSeed = {
  id: UserId;
  username: string;
  email: string;
  names: string;
  firstSurname: string;
  secondSurname: string;
  role: "admin" | "executive";
  branchId?: BranchId;
  createdAt?: Date;
};

async function seedOrganization(
  runtime: TestRuntime,
  input: OrganizationSeed,
): Promise<SeededOrganizationRef> {
  const createdAt = input.createdAt ?? runtime.now.get();
  const id = input.id ?? OrganizationId.trust(randomUUIDv7());
  const key = input.key?.trim();
  if (!key) {
    throw new Error("missing_seed_organization_key");
  }
  const ruc = input.ruc ?? buildDefaultRuc(key);
  const legalName =
    input.legalName === undefined ? `Org ${key}` : input.legalName;
  await runtime.ctx.db
    .insertInto("organizations")
    .values({
      id,
      ruc,
      legal_name: legalName,
      line_of_business: input.lineOfBusiness ?? null,
      created_at: createdAt,
    })
    .execute();

  return { id, ruc, legalName };
}

async function seedLead(runtime: TestRuntime, input: LeadSeed) {
  const createdAt = input.createdAt ?? runtime.now.get();
  const updatedAt = input.updatedAt ?? createdAt;
  const organizationId = resolveLeadOrganizationId(input);
  const commercial = withMerchantDefaults(input.commercial);
  await runtime.ctx.db
    .insertInto("workflow_leads")
    .values({
      id: input.id,
      organization_id: organizationId,
      stage: input.stage,
      status: input.status,
      priority: input.priority,
      created_by:
        input.createdBy ?? UserId.trust("01974fd5-f261-7a7d-93f5-2f3d0f961001"),
      updated_by: input.updatedBy ?? null,
      created_at: createdAt,
      updated_at: updatedAt,
      current_provider: commercial.currentProvider,
      current_debit_rate: commercial.currentDebitRate,
      current_credit_rate: commercial.currentCreditRate,
      gpv: commercial.gpv,
      ticket: commercial.ticket,
      settlement_bank: commercial.settlementBank,
      pos_count: commercial.posCount,
      reservation_expires_at: input.reservationExpiresAt ?? null,
    })
    .execute();

  await runtime.ctx.db
    .insertInto("organization_owner_assignments")
    .values({
      organization_id: organizationId,
      executive_id: input.executiveId,
      valid_from: createdAt,
      valid_until: null,
      assigned_by: input.createdBy ?? input.executiveId,
      reason: "test_seed",
      created_at: createdAt,
    })
    .execute();
}

export async function seedLeadScenario(
  runtime: TestRuntime,
  input: LeadScenarioSeed,
): Promise<{ organization: SeededOrganizationRef; leadId: WorkflowLeadId }> {
  const organization = await seedOrganization(runtime, input.organization);
  await seedLead(runtime, {
    ...input.lead,
    organization,
  });
  return { organization, leadId: input.lead.id };
}

function resolveLeadOrganizationId(input: LeadSeed): OrganizationId {
  if (input.organization) {
    return input.organization.id;
  }
  if (input.organizationId) {
    return input.organizationId;
  }
  throw new Error("missing_seed_lead_organization");
}

function buildDefaultRuc(key: string): string {
  let hash = 0;
  for (let index = 0; index < key.length; index += 1) {
    hash = (hash * 131 + key.charCodeAt(index)) % 1_000_000_000;
  }
  const digits = String(hash).padStart(9, "0");
  return `20${digits}`;
}

export function withMerchantDefaults(
  input: LeadCommercialOptions | undefined,
): LeadCommercialScope {
  return {
    currentProvider:
      input?.currentProvider ?? MERCHANT.standard.currentProvider,
    currentDebitRate:
      input?.currentDebitRate ?? MERCHANT.standard.currentDebitRate,
    currentCreditRate:
      input?.currentCreditRate ?? MERCHANT.standard.currentCreditRate,
    gpv: input?.gpv ?? MERCHANT.standard.gpv,
    ticket: input?.ticket ?? MERCHANT.standard.ticket,
    settlementBank: input?.settlementBank ?? MERCHANT.standard.settlementBank,
    posCount: input?.posCount ?? MERCHANT.standard.posCount,
  };
}

export async function seedUser(runtime: TestRuntime, input: UserSeed) {
  const createdAt = input.createdAt ?? runtime.now.get();
  await runtime.ctx.db
    .insertInto("users")
    .values({
      id: input.id,
      branch_id:
        input.branchId ??
        BranchId.trust("01974fd5-f261-7a7d-93f5-2f3d0f960001"),
      team_id: null,
      username: input.username,
      email: input.email,
      password_hash: "hash",
      names: input.names,
      first_surname: input.firstSurname,
      second_surname: input.secondSurname,
      onboarding_completed_at: createdAt,
      role: input.role,
      is_active: true,
      created_at: createdAt,
    })
    .execute();
}

type RateProposalSeed = {
  id: WorkflowRateProposalId;
  leadId: WorkflowLeadId;
  round: number;
  proposedDebitRate: number;
  proposedCreditRate: number;
  proposedForeignRate: number;
  fee: number;
  paybackPricing: number;
  proposedBy: UserId;
  currency?: "PEN" | "USD";
  outcome?: "pending" | "accepted" | "revision_requested";
  proposedAt?: Date;
  decidedAt?: Date | null;
};

export async function seedRateProposal(
  runtime: TestRuntime,
  input: RateProposalSeed,
): Promise<void> {
  const proposedAt = input.proposedAt ?? runtime.now.get();
  await runtime.ctx.db
    .insertInto("workflow_rate_proposals")
    .values({
      id: input.id,
      lead_id: input.leadId,
      round: input.round,
      proposed_debit_rate: input.proposedDebitRate,
      proposed_credit_rate: input.proposedCreditRate,
      proposed_foreign_rate: input.proposedForeignRate,
      fee: input.fee,
      payback_pricing: input.paybackPricing,
      currency: input.currency ?? "PEN",
      proposed_by: input.proposedBy,
      proposed_at: proposedAt,
      outcome: input.outcome ?? "pending",
      decided_at: input.decidedAt ?? null,
    })
    .execute();
}

export async function seedImportJob(
  runtime: TestRuntime,
): Promise<{ id: IntegrationJobId }> {
  const now = runtime.now.get();
  const row = await runtime.ctx.db
    .insertInto("workflow_integration_jobs")
    .values({
      type: "import_status",
      queue_state: "processing",
      requested_by_user_id: UserId.trust(
        "01974fd5-f261-7a7d-93f5-2f3d0f961005",
      ),
      file_path: "inline",
      error_message: null,
      rows_total: null,
      rows_applied: null,
      rows_failed: null,
      results_json: null,
      lease_owner: "test-worker",
      attempt_count: 1,
      max_attempts: 3,
      claimable_at: new Date(now.getTime() + 30_000),
      created_at: now,
      completed_at: null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return { id: row.id };
}
