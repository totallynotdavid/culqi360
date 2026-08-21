import { useAction } from "@solidjs/router";
import { createSignal, Show } from "solid-js";

import Moneybag from "~/components/icons/moneybag";
import Package from "~/components/icons/package";
import Target from "~/components/icons/target";
import { Button } from "~/components/ui/input/button";
import {
  InlineFieldEditor,
  InlineOptionsEditor,
} from "~/components/ui/input/inline-field-editor";
import { actionErrorMessage } from "~/contracts/errors";
import type { EditRateProposalInput } from "~/contracts/workflow/inputs";
import type {
  LeadDetailRateProposalView,
  LeadDetailRateRevisionView,
} from "~/contracts/workflow/views";
import { CURRENCIES } from "~/contracts/workflow/vocabulary";
import { formatAppDate } from "~/domain/time/app-time";
import {
  FieldTable,
  FieldTextValue,
  RecordInlineCell,
} from "~/features/widgets/field-table";
import {
  WidgetCard,
  WidgetCardActions,
  WidgetCardContent,
  WidgetCardHeader,
  WidgetCardTitle,
} from "~/features/widgets/widget-card";
import {
  formatAmount,
  formatRate,
} from "~/features/workflow/presentation/format";

import {
  acceptRateMutation,
  editRateProposalMutation,
} from "../../../data/command-mutations";
import { revalidateWorkflowLead } from "../../../data/revalidate-workflow";
import { RateRevisionRequestForm } from "./rate-revision-request-form";

import styles from "../quoted.module.css";

type RateProposalSectionProps = {
  leadId: string;
  proposal: LeadDetailRateProposalView;
  reservationExpiresAt: number | null;
  evaluatedAt: number;
  rateRevisions: LeadDetailRateRevisionView[];
  canRequestRevision: boolean;
  canAccept: boolean;
  canEdit: boolean;
};

export function RateProposalSection(props: RateProposalSectionProps) {
  const accept = useAction(acceptRateMutation);
  const edit = useAction(editRateProposalMutation);

  const [accepting, setAccepting] = createSignal(false);
  const [showRevisionForm, setShowRevisionForm] = createSignal(false);
  const [acceptErrorMessage, setAcceptErrorMessage] = createSignal<
    string | null
  >(null);

  const currentRound = () => props.rateRevisions.length;
  const isRenegotiation = () => currentRound() > 0;
  const isExpired = () =>
    props.proposal.outcome === "pending" &&
    props.reservationExpiresAt !== null &&
    props.reservationExpiresAt <= props.evaluatedAt;

  async function handleAccept() {
    setAcceptErrorMessage(null);
    setAccepting(true);

    try {
      await accept({
        leadId: props.leadId,
        proposalId: props.proposal.id,
      });

      revalidateWorkflowLead(props.leadId);
    } catch (error) {
      setAcceptErrorMessage(actionErrorMessage(error));
    } finally {
      setAccepting(false);
    }
  }

  async function submitProposalPatch(
    patch: Partial<EditRateProposalInput>,
  ): Promise<void> {
    try {
      await edit({
        leadId: props.leadId,
        proposalId: props.proposal.id,
        proposedDebitRate: props.proposal.proposedDebitRate,
        proposedCreditRate: props.proposal.proposedCreditRate,
        proposedForeignRate: props.proposal.proposedForeignRate,
        fee: props.proposal.fee,
        paybackPricing: props.proposal.paybackPricing,
        currency: props.proposal.currency,
        ...patch,
      });

      revalidateWorkflowLead(props.leadId);
    } catch (error) {
      throw new Error(actionErrorMessage(error), { cause: error });
    }
  }

  const numberFieldEdit = (
    label: string,
    current: number,
    toPatch: (value: number) => Partial<EditRateProposalInput>,
  ) =>
    props.canEdit
      ? {
          ariaLabel: `Editar ${label}`,
          renderEditor: (onClose: () => void) => (
            <InlineFieldEditor
              initialValue={String(current)}
              ariaLabel={label}
              type="number"
              step="0.01"
              min="0"
              onSubmit={(value) => submitProposalPatch(toPatch(Number(value)))}
              onClose={onClose}
            />
          ),
        }
      : undefined;

  const currencyFieldEdit = () =>
    props.canEdit
      ? {
          ariaLabel: "Editar moneda",
          renderEditor: (onClose: () => void) => (
            <InlineOptionsEditor
              options={CURRENCIES}
              selected={props.proposal.currency}
              ariaLabel="Moneda"
              onSubmit={(value) => submitProposalPatch({ currency: value })}
              onClose={onClose}
            />
          ),
        }
      : undefined;

  return (
    <WidgetCard variant="side-column">
      <WidgetCardHeader>
        <WidgetCardTitle text="Tarifa propuesta" />

        <Show when={isRenegotiation()}>
          <span class={styles.roundBadge}>Ronda {currentRound() + 1}</span>
        </Show>
      </WidgetCardHeader>

      <WidgetCardContent>
        <FieldTable>
          <RecordInlineCell
            label="Payback"
            icon={Moneybag}
            edit={numberFieldEdit(
              "Payback",
              props.proposal.paybackPricing,
              (value) => ({ paybackPricing: value }),
            )}
          >
            <FieldTextValue>
              {formatAmount(props.proposal.paybackPricing)}
            </FieldTextValue>
          </RecordInlineCell>

          <RecordInlineCell
            label="T. débito"
            icon={Target}
            edit={numberFieldEdit(
              "T. débito",
              props.proposal.proposedDebitRate,
              (value) => ({ proposedDebitRate: value }),
            )}
          >
            <FieldTextValue>
              {formatRate(props.proposal.proposedDebitRate)}
            </FieldTextValue>
          </RecordInlineCell>

          <RecordInlineCell
            label="T. crédito"
            icon={Target}
            edit={numberFieldEdit(
              "T. crédito",
              props.proposal.proposedCreditRate,
              (value) => ({ proposedCreditRate: value }),
            )}
          >
            <FieldTextValue>
              {formatRate(props.proposal.proposedCreditRate)}
            </FieldTextValue>
          </RecordInlineCell>

          <RecordInlineCell
            label="T. foráneo"
            icon={Target}
            edit={numberFieldEdit(
              "T. foráneo",
              props.proposal.proposedForeignRate,
              (value) => ({ proposedForeignRate: value }),
            )}
          >
            <FieldTextValue>
              {formatRate(props.proposal.proposedForeignRate)}
            </FieldTextValue>
          </RecordInlineCell>

          <RecordInlineCell
            label="Fee"
            icon={Moneybag}
            edit={numberFieldEdit("Fee", props.proposal.fee, (value) => ({
              fee: value,
            }))}
          >
            <FieldTextValue>{formatAmount(props.proposal.fee)}</FieldTextValue>
          </RecordInlineCell>

          <RecordInlineCell
            label="Moneda"
            icon={Package}
            edit={currencyFieldEdit()}
          >
            <FieldTextValue>{props.proposal.currency}</FieldTextValue>
          </RecordInlineCell>

          <Show when={props.reservationExpiresAt}>
            {(expiresAt) => (
              <RecordInlineCell label="Vigencia" icon={Package}>
                <FieldTextValue>
                  {isExpired()
                    ? `Venció el ${formatAppDate(expiresAt())}`
                    : `Hasta el ${formatAppDate(expiresAt())}`}
                </FieldTextValue>
              </RecordInlineCell>
            )}
          </Show>
        </FieldTable>

        <Show
          when={
            !showRevisionForm() && (props.canAccept || props.canRequestRevision)
          }
        >
          <WidgetCardActions stack>
            <Show when={props.canAccept}>
              <Button
                type="button"
                variant="primary"
                size="sm"
                loading={accepting()}
                onClick={() => void handleAccept()}
              >
                Aceptar tarifa
              </Button>
            </Show>

            <Show when={props.canRequestRevision}>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  setAcceptErrorMessage(null);
                  setShowRevisionForm(true);
                }}
              >
                Solicitar revisión de tarifa
              </Button>
            </Show>
          </WidgetCardActions>
        </Show>

        <Show when={showRevisionForm()}>
          <RateRevisionRequestForm
            leadId={props.leadId}
            onCancel={() => setShowRevisionForm(false)}
            onSubmitted={() => setShowRevisionForm(false)}
          />
        </Show>

        <Show when={acceptErrorMessage()}>
          {(message) => <p class={styles.error}>{message()}</p>}
        </Show>
      </WidgetCardContent>
    </WidgetCard>
  );
}
