import {
  action,
  createOptimistic,
  createSignal,
  type Accessor,
} from "solid-js";

import type { CurrentUserView } from "~/contracts/auth";
import { codeIs } from "~/contracts/error-codes";
import { parseWireError } from "~/contracts/errors";
import type { CreateLeadInput } from "~/contracts/workflow/inputs";
import type { RecordTabId } from "~/features/record-show/model/record-tab-id";
import {
  toCommercialScopePayload,
  type CommercialScopeFormValues,
} from "~/features/workflow/forms/commercial-scope/values";

type CreateLeadControllerInput = {
  draftRuc: Accessor<string>;
  inquiryId: Accessor<string | null>;
  validRuc: Accessor<string | null>;
  currentUser: Accessor<CurrentUserView>;
  scope: Accessor<CommercialScopeFormValues>;
  createLead: (input: CreateLeadInput) => Promise<{ leadId: string }>;
  onLeadCreated: (input: { leadId: string; ruc: string }) => void;
  setActiveTab: (tab: RecordTabId) => void;
};

export function createCreateLeadController(input: CreateLeadControllerInput) {
  // Writable memo: editing the RUC recomputes it back to null, so a stale
  // failure never outlives the input it was about.
  const [errorMessage, setErrorMessage] = createSignal<string | null>(() => {
    input.draftRuc();

    return null;
  });

  // Tentative for the action's lifetime: it reverts to false when the
  // transaction settles, so there is no finally clause to keep in sync.
  const [submitting, setSubmitting] = createOptimistic(false);

  // The explicit Generator signature names what the yield hands back, so the
  // action body reads the created lead without an assertion off `any`.
  const createLead = action(function* (
    payload: CreateLeadInput,
  ): Generator<Promise<{ leadId: string }>, void, { leadId: string }> {
    setSubmitting(true);

    const result = yield input.createLead(payload);

    input.onLeadCreated({ leadId: result.leadId, ruc: payload.ruc });
  });

  // Non-reactive because it only guards re-entry within one turn; the reactive
  // flag above is what the UI renders.
  let inFlight: Promise<unknown> | null = null;

  async function submit(): Promise<void> {
    if (inFlight) {
      return;
    }

    const ruc = input.validRuc();

    if (!ruc) {
      setErrorMessage("El RUC debe tener 11 dígitos.");
      input.setActiveTab("registro");
      return;
    }

    const scopePayload = toCommercialScopePayload(input.scope());

    if (!scopePayload.ok) {
      setErrorMessage(scopePayload.error);
      input.setActiveTab("registro");
      return;
    }

    setErrorMessage(null);

    inFlight = createLead({
      ruc,
      inquiryId: input.inquiryId() ?? undefined,
      ...scopePayload.value,
    });

    try {
      await inFlight;
    } catch (submitError) {
      const wire = parseWireError(submitError);

      setErrorMessage(wire.message);

      if (codeIs(wire, "invalid_ruc") || codeIs(wire, "ruc_required")) {
        input.setActiveTab("registro");
      }
    } finally {
      inFlight = null;
    }
  }

  return {
    errorMessage,
    submitting,
    submit,
  };
}
