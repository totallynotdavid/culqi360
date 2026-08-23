import { useAction } from "@solidjs/router";
import { For, createSignal } from "solid-js";

import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import { Button } from "~/components/ui/input/button";
import { TextInput } from "~/components/ui/input/text-input";
import { actionErrorMessage } from "~/contracts/errors";
import type { LeadDetailRateProposalView } from "~/contracts/workflow/views";
import { CURRENCIES, type Currency } from "~/contracts/workflow/vocabulary";
import {
  FieldInputValue,
  FieldRow,
  FieldTable,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardActions,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";

import { proposeRateMutation } from "../../../data/command-mutations";
import { revalidateWorkflowLead } from "../../../data/revalidate-workflow";

import styles from "../quotation.module.css";

type ProposeRateSectionProps = {
  leadId: string;
  // The latest proposal, when present, seeds the form so back office can adjust
  // the previous round after a revision request.
  latestProposal?: LeadDetailRateProposalView;
};

function isMoneda(value: string): value is Currency {
  return (CURRENCIES as readonly string[]).includes(value);
}

function RateInputRow(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <FieldRow label={props.label} icon={Moneybag}>
      <FieldInputValue>
        <TextInput
          sizeVariant="sm"
          type="number"
          step="0.01"
          min="0"
          value={props.value}
          onChange={props.onChange}
          required
        />
      </FieldInputValue>
    </FieldRow>
  );
}

export function ProposeRateSection(props: ProposeRateSectionProps) {
  const propose = useAction(proposeRateMutation);

  const [paybackPricing, setPaybackPricing] = createSignal(
    props.latestProposal?.paybackPricing?.toString() ?? "",
  );
  const [proposedDebitRate, setProposedDebitRate] = createSignal(
    props.latestProposal?.proposedDebitRate?.toString() ?? "",
  );
  const [proposedCreditRate, setProposedCreditRate] = createSignal(
    props.latestProposal?.proposedCreditRate?.toString() ?? "",
  );
  const [proposedForeignRate, setProposedForeignRate] = createSignal(
    props.latestProposal?.proposedForeignRate?.toString() ?? "",
  );
  const [fee, setFee] = createSignal(
    props.latestProposal?.fee?.toString() ?? "",
  );
  const [currency, setCurrency] = createSignal<Currency>(
    props.latestProposal?.currency ?? "PEN",
  );
  const [submitting, setSubmitting] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    setErrorMessage(null);
    setSubmitting(true);

    try {
      await propose({
        leadId: props.leadId,
        paybackPricing: Number(paybackPricing()),
        proposedDebitRate: Number(proposedDebitRate()),
        proposedCreditRate: Number(proposedCreditRate()),
        proposedForeignRate: Number(proposedForeignRate()),
        fee: Number(fee()),
        currency: currency(),
      });

      revalidateWorkflowLead(props.leadId);
    } catch (caught) {
      setErrorMessage(actionErrorMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Proponer tarifa" />
      </WidgetCardHeader>

      <WidgetCardContent>
        <form onSubmit={(event) => void handleSubmit(event)}>
          <FieldTable>
            <RateInputRow
              label="Payback"
              value={paybackPricing()}
              onChange={setPaybackPricing}
            />

            <RateInputRow
              label="T. débito"
              value={proposedDebitRate()}
              onChange={setProposedDebitRate}
            />

            <RateInputRow
              label="T. crédito"
              value={proposedCreditRate()}
              onChange={setProposedCreditRate}
            />

            <RateInputRow
              label="T. foráneo"
              value={proposedForeignRate()}
              onChange={setProposedForeignRate}
            />

            <RateInputRow label="Fee" value={fee()} onChange={setFee} />

            <FieldRow label="Moneda" icon={Package}>
              <FieldInputValue>
                <select
                  class={styles.select}
                  value={currency()}
                  onChange={(event) => {
                    const value = event.currentTarget.value;

                    if (isMoneda(value)) {
                      setCurrency(value);
                    }
                  }}
                >
                  <For each={CURRENCIES}>
                    {(currencyOption) => (
                      <option value={currencyOption}>{currencyOption}</option>
                    )}
                  </For>
                </select>
              </FieldInputValue>
            </FieldRow>
          </FieldTable>

          {errorMessage() && <p class={styles.error}>{errorMessage()}</p>}

          <WidgetCardActions>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={submitting()}
            >
              Proponer tarifa
            </Button>
          </WidgetCardActions>
        </form>
      </WidgetCardContent>
    </WidgetCard>
  );
}
