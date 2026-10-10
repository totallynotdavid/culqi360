import type {
  FulfillmentAction,
  FulfillmentDocKind,
  FulfillmentStep,
  ProductKind,
} from "~/contracts/workflow/vocabulary";
import { FULFILLMENT_STEPS } from "~/contracts/workflow/vocabulary";

export type PendingOwner = "executive" | "back_office";

// The step completes only when every unit on the order carries a non-null
// value for this column.
export type UnitField =
  | "serial_number"
  | "payment_url"
  | "payment_proof_file_asset_id"
  | "service_a_ref";

type StepDefinition =
  | { kind: "choose"; action: "choose_product"; owner: PendingOwner }
  | {
      kind: "document";
      action: FulfillmentAction;
      owner: PendingOwner;
      docKind: FulfillmentDocKind;
    }
  | {
      kind: "per_unit";
      action: FulfillmentAction;
      owner: PendingOwner;
      unitField: UnitField;
    }
  | { kind: "confirm"; action: FulfillmentAction; owner: PendingOwner }
  | { kind: "terminal"; action: null; owner: null };

const STEP_DEFINITIONS: Record<FulfillmentStep, StepDefinition> = {
  CHOOSE_PRODUCT: {
    kind: "choose",
    action: "choose_product",
    owner: "executive",
  },
  AWAITING_TRANSACTIONS_REPORT: {
    kind: "document",
    action: "upload_transactions_report",
    // Executives upload reports prepared offline; back office validates them next.
    owner: "executive",
    docKind: "transactions_report",
  },
  AWAITING_ADDENDUM: {
    kind: "document",
    action: "generate_addendum",
    owner: "back_office",
    docKind: "addendum_unsigned",
  },
  AWAITING_SIGNATURE: {
    kind: "document",
    action: "submit_signed_addendum",
    owner: "executive",
    docKind: "addendum_signed_photo",
  },
  AWAITING_PDF_COMPILE: {
    kind: "document",
    action: "compile_signed_pdf",
    owner: "back_office",
    docKind: "addendum_signed_pdf",
  },
  AWAITING_SERIALS: {
    kind: "per_unit",
    action: "record_serials",
    owner: "back_office",
    unitField: "serial_number",
  },
  AWAITING_SERIAL_ENTRY: {
    kind: "per_unit",
    action: "record_serials",
    owner: "executive",
    unitField: "serial_number",
  },
  AWAITING_PAYMENT_LINK: {
    kind: "per_unit",
    action: "register_payment_link",
    owner: "back_office",
    unitField: "payment_url",
  },
  AWAITING_PAYMENT: {
    kind: "per_unit",
    action: "upload_payment_proof",
    owner: "executive",
    unitField: "payment_proof_file_asset_id",
  },
  AWAITING_PAYMENT_VALIDATION: {
    kind: "confirm",
    action: "validate_payment",
    owner: "back_office",
  },
  AWAITING_SALE_REGISTRATION: {
    kind: "per_unit",
    action: "register_sale",
    owner: "back_office",
    unitField: "service_a_ref",
  },
  COMPLETED: { kind: "terminal", action: null, owner: null },
};

const STEP_SEQUENCE: Record<ProductKind, FulfillmentStep[]> = {
  pos_refurbished: [
    "CHOOSE_PRODUCT",
    "AWAITING_TRANSACTIONS_REPORT",
    "AWAITING_ADDENDUM",
    "AWAITING_SIGNATURE",
    "AWAITING_PDF_COMPILE",
    "AWAITING_SERIALS",
    "AWAITING_SALE_REGISTRATION",
    "COMPLETED",
  ],
  pos_new: [
    "CHOOSE_PRODUCT",
    "AWAITING_SERIAL_ENTRY",
    "AWAITING_PAYMENT_LINK",
    "AWAITING_PAYMENT",
    "AWAITING_PAYMENT_VALIDATION",
    "AWAITING_SALE_REGISTRATION",
    "COMPLETED",
  ],
  digital_only: ["CHOOSE_PRODUCT", "AWAITING_SALE_REGISTRATION", "COMPLETED"],
};

export const INITIAL_FULFILLMENT_STEP: FulfillmentStep = "CHOOSE_PRODUCT";

export function stepDefinition(step: FulfillmentStep): StepDefinition {
  return STEP_DEFINITIONS[step];
}

export function pendingOwnerForStep(
  step: FulfillmentStep,
): PendingOwner | null {
  return STEP_DEFINITIONS[step].owner;
}

// Shared actions are validated against the current step by their command.
function stepForAction(action: FulfillmentAction): FulfillmentStep | null {
  if (action === "choose_product") {
    return "CHOOSE_PRODUCT";
  }
  for (const step of FULFILLMENT_STEPS) {
    if (STEP_DEFINITIONS[step].action === action) {
      return step;
    }
  }
  return null;
}

export function docKindForAction(
  action: FulfillmentAction,
): FulfillmentDocKind | null {
  const step = stepForAction(action);
  if (step === null) {
    return null;
  }
  const def = STEP_DEFINITIONS[step];
  return def.kind === "document" ? def.docKind : null;
}

// digital_only carries no hardware unit, so the per-unit step still runs but
// over a single bookkeeping unit created at product selection.
export function nextStep(
  productKind: ProductKind,
  current: FulfillmentStep,
): FulfillmentStep {
  const sequence = STEP_SEQUENCE[productKind];
  const index = sequence.indexOf(current);
  if (index < 0) {
    return "COMPLETED";
  }
  return sequence[index + 1] ?? "COMPLETED";
}

export function stepsForProduct(productKind: ProductKind): FulfillmentStep[] {
  return STEP_SEQUENCE[productKind];
}

export function backOfficeQueueSteps(): FulfillmentStep[] {
  return FULFILLMENT_STEPS.filter(
    (step) => STEP_DEFINITIONS[step].owner === "back_office",
  );
}

// Rejecting a document returns it to its owner and clears the rejected unit field.
// Data-entry steps are corrected in place.
export type RejectRule = { to: FulfillmentStep; clearField: UnitField | null };

const REJECT_RULES: Partial<Record<FulfillmentStep, RejectRule>> = {
  AWAITING_PAYMENT_VALIDATION: {
    to: "AWAITING_PAYMENT",
    clearField: "payment_proof_file_asset_id",
  },
  AWAITING_PDF_COMPILE: { to: "AWAITING_SIGNATURE", clearField: null },
  AWAITING_ADDENDUM: { to: "AWAITING_TRANSACTIONS_REPORT", clearField: null },
};

export function rejectRuleForStep(step: FulfillmentStep): RejectRule | null {
  return REJECT_RULES[step] ?? null;
}

export type FulfillmentStepStatus = "done" | "current" | "pending";

export type FulfillmentStepProgress = {
  step: FulfillmentStep;
  status: FulfillmentStepStatus;
};

// Before a product is chosen the order sits on CHOOSE_PRODUCT alone.
export function fulfillmentProgress(
  productKind: ProductKind | null,
  currentStep: FulfillmentStep,
): FulfillmentStepProgress[] {
  if (productKind === null) {
    return [{ step: "CHOOSE_PRODUCT", status: "current" }];
  }
  const sequence = STEP_SEQUENCE[productKind].filter(
    (step) => step !== "COMPLETED",
  );
  const currentIndex = sequence.findIndex((step) => step === currentStep);
  return sequence.map((step, index) => ({
    step,
    status:
      currentStep === "COMPLETED" || index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "pending",
  }));
}
