import type { Kysely } from "kysely";

import type { OrganizationId } from "~/domain/ids";

import type { Database } from "../../../types";
import type { CompiledLead } from "../compiler";
import type { LegalRepSpec } from "../scenario";
import type { OrganizationsByRuc } from "./organizations";

export async function persistWorkflowCommercialData(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  orgIdByRuc: OrganizationsByRuc,
  leads: readonly CompiledLead[],
): Promise<void> {
  await insertRateProposals(db, anchorMs, day, leads);
  await insertRateRevisions(db, anchorMs, day, leads);
  await insertVenues(db, anchorMs, day, leads);
  await insertDigitalPolicies(db, anchorMs, day, leads);
  await insertLegalReps(db, anchorMs, day, orgIdByRuc, leads);
}

async function insertRateRevisions(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const rows = leads.flatMap((lead) =>
    lead.proposals.flatMap(({ spec: proposal, id, revisionId }) => {
      if (proposal.outcome !== "revision_requested") {
        return [];
      }
      if (revisionId === null || proposal.decidedOffsetDays === undefined) {
        throw new Error(`missing_compiled_rate_revision:${lead.spec.key}`);
      }

      return [
        {
          id: revisionId,
          lead_id: lead.leadId,
          proposal_id: id,
          round: proposal.round,
          justification: "El comercio solicita una tarifa más competitiva",
          requested_by: lead.spec.executiveId,
          requested_at: new Date(anchorMs - proposal.decidedOffsetDays * day),
        },
      ];
    }),
  );
  if (rows.length === 0) {
    return;
  }
  await db.insertInto("workflow_rate_revisions").values(rows).execute();
}

async function insertRateProposals(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const rows = leads.flatMap((lead) =>
    lead.proposals.map(({ spec: proposal, id }) => ({
      id,
      lead_id: lead.leadId,
      round: proposal.round,
      payback_pricing: proposal.paybackPricing,
      proposed_debit_rate: proposal.debitRate,
      proposed_credit_rate: proposal.creditRate,
      proposed_foreign_rate: proposal.foreignRate,
      fee: proposal.fee,
      currency: proposal.currency,
      proposed_by: proposal.proposedBy,
      proposed_at: new Date(anchorMs - proposal.proposedOffsetDays * day),
      outcome: proposal.outcome,
      decided_at:
        proposal.decidedOffsetDays === undefined
          ? null
          : new Date(anchorMs - proposal.decidedOffsetDays * day),
    })),
  );
  if (rows.length === 0) {
    return;
  }
  await db.insertInto("workflow_rate_proposals").values(rows).execute();
}

async function insertVenues(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const venueRows = leads.flatMap((lead) => {
    const venue = lead.spec.venue;
    const venueId = lead.venueId;
    if (!venue || !venueId) {
      return [];
    }

    return [
      {
        id: venueId,
        lead_id: lead.leadId,
        trade_name: venue.tradeName,
        pos_quantity: venue.posQuantity,
        // Only set for a per_venue digital policy; every other lead leaves
        // these null exactly as before.
        link_url: venue.linkUrl ?? null,
        online_url: venue.onlineUrl ?? null,
        online_collection_mode: venue.onlineCollectionMode ?? null,
        address: venue.address,
        address_reference: venue.addressReference,
        district: lead.spec.org.district,
        province: lead.spec.org.province,
        department: lead.spec.org.department,
        created_at: new Date(anchorMs - venue.createdOffsetDays * day),
        created_by: venue.createdBy,
      },
    ];
  });
  if (venueRows.length === 0) {
    return;
  }

  await db.insertInto("workflow_lead_venues").values(venueRows).execute();

  const accountRows = leads.flatMap((lead) => {
    const venue = lead.spec.venue;
    const venueId = lead.venueId;
    if (!venue || !venueId) {
      return [];
    }

    return venue.accounts.map((account, index) => {
      const accountId = lead.venueAccountIds[index];
      if (!accountId) {
        throw new Error(
          `missing_seed_venue_account_id:${lead.spec.key}:${index}`,
        );
      }
      return {
        id: accountId,
        venue_id: venueId,
        currency: account.currency,
        bank: account.bank,
        account_type: account.accountType,
        account_number: account.accountNumber,
        cci: account.cci,
        is_settlement: account.isSettlement,
      };
    });
  });
  if (accountRows.length === 0) {
    return;
  }
  await db
    .insertInto("workflow_lead_venue_accounts")
    .values(accountRows)
    .execute();
}

async function insertDigitalPolicies(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const rows = leads.flatMap((lead) => {
    const policy = lead.spec.digitalPolicy;
    if (!policy) {
      return [];
    }
    return [
      {
        lead_id: lead.leadId,
        link_scope: policy.linkScope,
        link_url: policy.linkUrl,
        online_scope: policy.onlineScope,
        online_url: policy.onlineUrl,
        online_collection_mode: policy.onlineCollectionMode,
        updated_at: new Date(anchorMs - policy.updatedOffsetDays * day),
        updated_by: policy.updatedBy,
      },
    ];
  });
  if (rows.length === 0) {
    return;
  }
  await db.insertInto("workflow_lead_digital_policy").values(rows).execute();
}

// Legal reps are relational (people -> organization_people -> role), so each
// is inserted in sequence rather than batched.
async function insertLegalReps(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  orgIdByRuc: OrganizationsByRuc,
  leads: readonly CompiledLead[],
): Promise<void> {
  for (const lead of leads) {
    if (!lead.spec.legalRep) {
      continue;
    }
    const organizationId = orgIdByRuc.get(lead.spec.org.ruc);
    if (!organizationId) {
      throw new Error(`missing_seed_organization_id:${lead.spec.org.ruc}`);
    }
    // eslint-disable-next-line no-await-in-loop
    await insertLegalRep(db, anchorMs, day, organizationId, lead.spec.legalRep);
  }
}

async function insertLegalRep(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  organizationId: OrganizationId,
  rep: LegalRepSpec,
): Promise<void> {
  const registeredAt = new Date(anchorMs - rep.offsetDays * day);

  const person = await db
    .insertInto("people")
    .values({
      dni: rep.dni,
      names: rep.names,
      first_surname: rep.firstSurname,
      second_surname: rep.secondSurname,
      email: rep.email,
      created_at: registeredAt,
      updated_at: registeredAt,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  const orgPerson = await db
    .insertInto("organization_people")
    .values({
      person_id: person.id,
      organization_id: organizationId,
      phone: rep.phone,
      email: rep.email,
      created_at: registeredAt,
      updated_at: registeredAt,
    })
    .returning("id")
    .executeTakeFirstOrThrow();

  await db
    .insertInto("organization_person_roles")
    .values({
      organization_person_id: orgPerson.id,
      role: "LEGAL_REPRESENTATIVE",
      is_primary: true,
      effective_from: registeredAt,
      effective_to: null,
    })
    .execute();
}
