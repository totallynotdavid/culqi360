import { useAction, useNavigate } from "@solidjs/router";
import { createMemo, isPending, latest, Show } from "solid-js";

import CircleQuestionMark from "~/components/icons/circle-question-mark";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import type { RecordContext } from "~/features/record-show/model/record-context";
import { RecordTabs } from "~/features/record-show/tabs/record-tabs";
import { createLeadMutation } from "~/features/workflow/data/command-mutations";
import { leadBootstrapPreviewQuery } from "~/rpc/workflow/lead-bootstrap-preview";

import { SidePanelPage } from "../../components/page";
import { SidePanelFooter } from "../../components/panel-footer";
import { useSidePanel } from "../../state/use-side-panel";
import { createLeadRecordDetailSidePanelPage } from "../../types/side-panel-page";
import { createCreateLeadController } from "./controller";
import { useCreateLeadPageState } from "./state";

import styles from "../record-page/page.module.css";

export function CreateLeadPage() {
  const { currentUser } = useAuthenticatedSession();
  const { navigateTo, closePanel } = useSidePanel();
  const navigate = useNavigate();
  const createLead = useAction(createLeadMutation);

  const {
    draftRuc,
    draftInquiryId,
    draftScope,
    activeTab,
    setScopeField,
    setActiveTab,
  } = useCreateLeadPageState();

  const validRuc = createMemo(() => {
    const value = draftRuc().trim();

    return /^\d{11}$/.test(value) ? value : null;
  });

  const bootstrapPreview = createMemo(() => {
    const ruc = validRuc();

    return ruc ? leadBootstrapPreviewQuery(ruc) : Promise.resolve(null);
  });

  // Reading the memo directly would block on every keystroke that starts a new
  // lookup. latest() keeps the previously resolved preview visible instead, and
  // the ?? null covers the first lookup, where there is nothing committed yet
  // and latest() hands back undefined despite what its return type says.
  const latestBootstrapPreview = createMemo(
    () => latest(bootstrapPreview) ?? null,
  );

  const previewLegalName = createMemo(
    () => latestBootstrapPreview()?.legalName ?? null,
  );

  const { errorMessage, submitting, submit } = createCreateLeadController({
    draftRuc,
    inquiryId: draftInquiryId,
    validRuc,
    scope: draftScope,
    currentUser,
    createLead,
    onLeadCreated: ({ leadId, ruc }) => {
      navigateTo(
        createLeadRecordDetailSidePanelPage({
          leadId,
          title: previewLegalName() ?? `RUC ${ruc}`,
          subtitle: `RUC ${ruc}`,
        }),
        { resetStack: true },
      );
    },
    setActiveTab,
  });

  const engineStatus = createMemo(() => {
    if (!validRuc()) {
      return "";
    }

    // isPending probes the lookup without blocking on it, so a refetch reports
    // itself while the stale preview stays on screen.
    if (isPending(bootstrapPreview)) {
      return "Buscando...";
    }

    const preview = latestBootstrapPreview();

    return preview?.engineStatus === "available"
      ? "Datos encontrados"
      : "Sin datos";
  });

  const recordContext = createMemo<RecordContext>(() => ({
    kind: "draft",
    ruc: draftRuc(),
    legalName: previewLegalName(),
    address: latestBootstrapPreview()?.address ?? null,
    engineStatus: engineStatus(),
    commercialScope: {
      values: draftScope(),
      setField: setScopeField,
    },
  }));

  return (
    <SidePanelPage
      footer={
        <SidePanelFooter
          primary={{
            label: "Crear cliente",
            shortcut: "⏎",
            onClick: () => void submit(),
            disabled: submitting(),
          }}
          options={
            draftInquiryId() === null
              ? [
                  {
                    id: "inquiry-fork",
                    label: "Solo consultar estado",
                    icon: CircleQuestionMark,
                    onSelect: () => {
                      const ruc = draftRuc().trim();

                      closePanel();
                      navigate(
                        ruc
                          ? `/inquiries?ruc=${encodeURIComponent(ruc)}`
                          : "/inquiries",
                      );
                    },
                  },
                ]
              : undefined
          }
        />
      }
    >
      <RecordTabs
        context={recordContext()}
        activeTab={activeTab()}
        onTabSelect={setActiveTab}
      />

      <Show when={errorMessage()}>
        {(message) => <p class={styles.error}>{message()}</p>}
      </Show>
    </SidePanelPage>
  );
}
