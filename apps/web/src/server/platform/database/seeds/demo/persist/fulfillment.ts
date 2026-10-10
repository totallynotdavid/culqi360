import type { Insertable, Kysely } from "kysely";

import type { FulfillmentDocKind } from "~/contracts/workflow/vocabulary";
import {
  stepDefinition,
  stepsForProduct,
  type UnitField,
} from "~/server/workflow/lead/fulfillment/steps";

import type { Database } from "../../../types";
import { stableSeedId } from "../../shared/stable-id";
import type { CompiledLead } from "../compiler";
import {
  fulfillmentEnteredOffsetDays,
  type FulfillmentSpec,
  type LeadSpec,
} from "../scenario";

type OrderRow = Insertable<Database["lead_fulfillment_orders"]>;
type UnitRow = Insertable<Database["lead_fulfillment_units"]>;
type FileAssetRow = Insertable<Database["file_assets"]>;
type DocumentRow = Insertable<Database["lead_fulfillment_documents"]>;

interface OrderPlan {
  order: OrderRow;
  units: UnitRow[];
  fileAssets: FileAssetRow[];
  documents: DocumentRow[];
}

// Reuses the real per-kind step sequence (server/workflow/lead/fulfillment/
// steps.ts) to derive which unit fields, documents and file assets a lead
// parked at `targetStep` must already carry -- so the seed cannot silently
// drift from the rules the app itself enforces.
export async function persistWorkflowFulfillment(
  db: Kysely<Database>,
  anchorMs: number,
  day: number,
  leads: readonly CompiledLead[],
): Promise<void> {
  const plans = leads
    .filter((lead) => lead.spec.fulfillment)
    .map((lead) => buildOrderPlan(lead, anchorMs, day));
  if (plans.length === 0) {
    return;
  }

  await db
    .insertInto("lead_fulfillment_orders")
    .values(plans.map((plan) => plan.order))
    .execute();

  // file_assets before units: a unit's payment_proof_file_asset_id is an FK
  // into it.
  const fileAssets = plans.flatMap((plan) => plan.fileAssets);
  if (fileAssets.length > 0) {
    await db.insertInto("file_assets").values(fileAssets).execute();
  }

  const units = plans.flatMap((plan) => plan.units);
  if (units.length > 0) {
    await db.insertInto("lead_fulfillment_units").values(units).execute();
  }

  const documents = plans.flatMap((plan) => plan.documents);
  if (documents.length > 0) {
    await db
      .insertInto("lead_fulfillment_documents")
      .values(documents)
      .execute();
  }
}

function buildOrderPlan(
  lead: CompiledLead,
  anchorMs: number,
  day: number,
): OrderPlan {
  const { spec } = lead;
  const fulfillment = spec.fulfillment;
  const orderId = lead.fulfillmentOrderId;
  if (!fulfillment || !orderId) {
    throw new Error(`missing_seed_fulfillment_spec:${spec.key}`);
  }

  const enteredOffsetDays = fulfillmentEnteredOffsetDays(spec);
  const createdAt = new Date(anchorMs - enteredOffsetDays * day);

  const order: OrderRow = {
    id: orderId,
    lead_id: lead.leadId,
    product_kind: fulfillment.productKind,
    current_step: fulfillment.targetStep,
    service_b_ref: null,
    created_by: spec.executiveId,
    created_at: createdAt,
    updated_at: createdAt,
  };

  if (fulfillment.productKind === null) {
    // Still at CHOOSE_PRODUCT: units are created together with the product
    // choice, never before it.
    return { order, units: [], fileAssets: [], documents: [] };
  }

  const venue = spec.venue;
  if (!venue) {
    throw new Error(`missing_seed_fulfillment_venue:${spec.key}`);
  }

  const sequence = stepsForProduct(fulfillment.productKind);
  const targetIndex = sequence.indexOf(fulfillment.targetStep);
  if (targetIndex < 0) {
    throw new Error(`invalid_seed_fulfillment_step:${spec.key}`);
  }
  if (fulfillment.chosenOffsetDays === undefined) {
    throw new Error(`missing_seed_fulfillment_chosen_offset:${spec.key}`);
  }

  const chosenAtMs = anchorMs - fulfillment.chosenOffsetDays * day;
  // Spread the steps strictly between CHOOSE_PRODUCT and targetStep evenly
  // across [chosenAtMs, anchorMs) so later steps land at later timestamps without
  // needing a per-step offset authored on every touched lead.
  const stepGapMs =
    targetIndex > 0 ? (anchorMs - chosenAtMs) / (targetIndex + 1) : 0;
  const stepAtMs = (index: number) => chosenAtMs + index * stepGapMs;

  order.updated_at = new Date(
    targetIndex > 0 ? stepAtMs(targetIndex) : chosenAtMs,
  );

  const isDigital = fulfillment.productKind === "digital_only";
  const units: UnitRow[] = lead.fulfillmentUnitIds.map((unitId, index) => ({
    id: unitId,
    order_id: orderId,
    venue_id: isDigital ? null : lead.venueId,
    label: isDigital
      ? "Registro digital"
      : `${venue.tradeName} POS ${index + 1}`,
    serial_number: null,
    payment_url: null,
    payment_proof_file_asset_id: null,
    payment_validated: false,
    service_a_ref: null,
    created_at: createdAt,
  }));

  const fileAssets: FileAssetRow[] = [];
  const documents: DocumentRow[] = [];

  // Steps strictly before targetIndex are already resolved; targetIndex
  // itself is the current, still-pending step (or, when it's COMPLETED, every
  // real step has already been resolved -- COMPLETED itself needs no action).
  for (const [offset, step] of sequence.slice(1, targetIndex).entries()) {
    const index = offset + 1;
    const def = stepDefinition(step);
    const atMs = stepAtMs(index);

    switch (def.kind) {
      case "document": {
        const uploadedBy =
          def.owner === "back_office"
            ? (spec.review?.by ?? spec.executiveId)
            : spec.executiveId;
        const { row, id } = buildFileAsset({
          leadKey: spec.key,
          docKind: def.docKind,
          index,
          uploadedBy,
          atMs,
        });
        fileAssets.push(row);
        documents.push(
          buildDocumentRow({
            orderId,
            docKind: def.docKind,
            fileAssetId: id,
            uploadedBy,
            atMs,
          }),
        );
        break;
      }
      case "confirm":
        for (const unit of units) {
          unit.payment_validated = true;
        }
        break;
      case "per_unit":
        units.forEach((unit, unitIndex) => {
          applyUnitField({
            unit,
            field: def.unitField,
            spec,
            fulfillment,
            unitIndex,
            orderId,
            atMs,
            fileAssets,
            documents,
          });
        });
        break;
      case "choose":
      case "terminal":
        // Never reached: the loop starts after CHOOSE_PRODUCT (index 0) and
        // stops before targetIndex, which excludes the terminal COMPLETED
        // step even when targetStep itself is COMPLETED.
        break;
      default:
        def satisfies never;
    }
  }

  return { order, units, fileAssets, documents };
}

function applyUnitField(input: {
  unit: UnitRow;
  field: UnitField;
  spec: LeadSpec;
  fulfillment: FulfillmentSpec;
  unitIndex: number;
  orderId: string;
  atMs: number;
  fileAssets: FileAssetRow[];
  documents: DocumentRow[];
}): void {
  const { unit, field, spec, fulfillment, unitIndex } = input;
  switch (field) {
    case "serial_number":
      unit.serial_number =
        fulfillment.unitSerials?.[unitIndex] ?? autoSerial(spec.key, unitIndex);
      return;
    case "payment_url":
      unit.payment_url = autoPaymentUrl(spec.key, unitIndex);
      return;
    case "service_a_ref":
      unit.service_a_ref = autoServiceRef(spec.key, unitIndex);
      return;
    case "payment_proof_file_asset_id": {
      const { row, id } = buildFileAsset({
        leadKey: spec.key,
        docKind: "payment_proof",
        index: unitIndex,
        uploadedBy: spec.executiveId,
        atMs: input.atMs,
      });
      input.fileAssets.push(row);
      input.documents.push(
        buildDocumentRow({
          orderId: input.orderId,
          docKind: "payment_proof",
          fileAssetId: id,
          uploadedBy: spec.executiveId,
          atMs: input.atMs,
        }),
      );
      unit.payment_proof_file_asset_id = id;
      return;
    }
    default:
      field satisfies never;
  }
}

function autoSerial(leadKey: string, unitIndex: number): string {
  const digits = stableSeedId(`fulfillment-serial:${leadKey}:${unitIndex}`)
    .replace(/-/g, "")
    .slice(0, 10)
    .toUpperCase();
  return `P3C325${digits}`;
}

function autoPaymentUrl(leadKey: string, unitIndex: number): string {
  const slug = stableSeedId(`fulfillment-payment:${leadKey}:${unitIndex}`)
    .replace(/-/g, "")
    .slice(0, 10);
  return `https://pay.culqi.com/pos/${slug}`;
}

function autoServiceRef(leadKey: string, unitIndex: number): string {
  const ref = stableSeedId(`fulfillment-sale:${leadKey}:${unitIndex}`)
    .replace(/-/g, "")
    .slice(0, 8)
    .toUpperCase();
  return `VTA-${ref}`;
}

function buildFileAsset(input: {
  leadKey: string;
  docKind: FulfillmentDocKind;
  index: number;
  uploadedBy: string;
  atMs: number;
}): { row: FileAssetRow; id: string } {
  const extension = input.docKind === "addendum_signed_pdf" ? "pdf" : "jpg";
  const mime = extension === "pdf" ? "application/pdf" : "image/jpeg";
  const filename = `${input.docKind}-${input.leadKey}-${input.index}.${extension}`;
  const id = stableSeedId(
    `file-asset:${input.leadKey}:${input.docKind}:${input.index}`,
  );
  const hashPart = (suffix: string) =>
    stableSeedId(
      `file-hash${suffix}:${input.leadKey}:${input.docKind}:${input.index}`,
    ).replace(/-/g, "");

  return {
    id,
    row: {
      id,
      storage_key: `seed/fulfillment/${input.leadKey}/${input.docKind}-${input.index}.${extension}`,
      purpose: input.docKind,
      original_filename: filename,
      safe_display_filename: filename,
      detected_mime: mime,
      extension,
      size_bytes: 180_000 + input.index * 4_096,
      sha256_hex: `${hashPart("1")}${hashPart("2")}`,
      signature_kind: null,
      scan_status: "clean",
      scan_engine: null,
      scan_reference: null,
      created_by_user_id: input.uploadedBy,
      created_at: new Date(input.atMs),
    },
  };
}

function buildDocumentRow(input: {
  orderId: string;
  docKind: FulfillmentDocKind;
  fileAssetId: string;
  uploadedBy: string;
  atMs: number;
}): DocumentRow {
  return {
    // Keyed off the file asset, not (orderId, docKind): a "payment_proof"
    // document repeats per unit on the same order, so (orderId, docKind)
    // alone is not unique.
    id: stableSeedId(`fulfillment-document:${input.fileAssetId}`),
    order_id: input.orderId,
    doc_kind: input.docKind,
    file_asset_id: input.fileAssetId,
    uploaded_by_user_id: input.uploadedBy,
    created_at: new Date(input.atMs),
  };
}
