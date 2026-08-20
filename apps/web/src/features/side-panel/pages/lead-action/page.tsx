import { Match, Show, Switch, createEffect, createMemo } from "solid-js";

import { CloseQuotationSection } from "~/features/record-show/workflow/close-quotation";
import { isLeadActionStillRelevant } from "~/features/record-show/workflow/next-action";
import { FulfillmentPanel } from "~/features/workflow/detail/forms/fulfillment/fulfillment-panel";
import { ProposeRateSection } from "~/features/workflow/detail/forms/pricing/propose-rate";
import { RateProposalSection } from "~/features/workflow/detail/forms/pricing/rate-proposal";
import { ExpiredPanel } from "~/features/workflow/detail/forms/review/expired-panel";
import { QualifyForm } from "~/features/workflow/detail/forms/review/qualify-form";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { SidePanelPage } from "../../components/page";
import { useSidePanel } from "../../state/use-side-panel";
import { useLeadActionPageState } from "./state";

import styles from "./page.module.css";

export function LeadActionPage() {
  const { goBack } = useSidePanel();
  const { leadId, action } = useLeadActionPageState();

  const detailData = createMemo(() => leadDetailQuery(leadId()));

  // Leave an action page after the server stage changes.
  createEffect(
    () => ({ detail: detailData(), currentAction: action() }),
    ({ detail, currentAction }) => {
      if (detail && !isLeadActionStillRelevant(currentAction, detail)) {
        goBack();
      }
    },
  );

  return (
    <SidePanelPage>
      <Show
        when={detailData()}
        fallback={<div class={styles.loading}>Cargando...</div>}
      >
        {(detail) => (
          <Switch>
            <Match when={action() === "qualify"}>
              <QualifyForm leadId={detail().lead.id} />
            </Match>

            <Match when={action() === "propose-rate"}>
              <ProposeRateSection
                leadId={detail().lead.id}
                latestProposal={detail().rateProposals.at(-1)}
              />
            </Match>

            <Match when={action() === "decide-rate"}>
              <Show when={detail().rateProposals.at(-1)}>
                {(proposal) => (
                  <RateProposalSection
                    leadId={detail().lead.id}
                    proposal={proposal()}
                    reservationExpiresAt={detail().lead.reservationExpiresAt}
                    evaluatedAt={detail().evaluatedAt}
                    rateRevisions={detail().rateRevisions}
                    canAccept={detail().availableActions.includes(
                      "accept-rate",
                    )}
                    canRequestRevision={detail().availableActions.includes(
                      "request-rate-revision",
                    )}
                    canEdit={detail().availableActions.includes(
                      "edit-rate-proposal",
                    )}
                  />
                )}
              </Show>
            </Match>

            <Match when={action() === "fulfillment"}>
              <FulfillmentPanel data={detail()} />
            </Match>

            <Match when={action() === "expired"}>
              <ExpiredPanel
                leadId={detail().lead.id}
                canRestart={detail().availableActions.includes(
                  "restart-quotation",
                )}
              />
            </Match>

            <Match when={action() === "close"}>
              <CloseQuotationSection leadId={detail().lead.id} />
            </Match>
          </Switch>
        )}
      </Show>
    </SidePanelPage>
  );
}
