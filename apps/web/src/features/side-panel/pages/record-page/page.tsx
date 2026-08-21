import { useNavigate } from "@solidjs/router";
import { Show, createEffect, createMemo } from "solid-js";

import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import BrowserMaximize from "~/components/icons/browser-maximize";
import Export from "~/components/icons/export";
import Heart from "~/components/icons/heart";
import Mail from "~/components/icons/mail";
import Trash from "~/components/icons/trash";
import X from "~/components/icons/x";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { actionErrorMessage } from "~/contracts/errors";
import { RecordTabs } from "~/features/record-show/tabs/record-tabs";
import { useEnrichmentWatch } from "~/features/record-show/use-enrichment-watch";
import { useLeadActions } from "~/features/record-show/use-record-actions";
import {
  nextActionCta,
  type NextActionTarget,
} from "~/features/record-show/workflow/next-action";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";

import { SidePanelPage } from "../../components/page";
import {
  SidePanelFooter,
  type FooterOption,
  type FooterPrimary,
} from "../../components/panel-footer";
import { useSidePanel } from "../../state/use-side-panel";
import { createLeadActionSidePanelPage } from "../../types/side-panel-page";
import { useLeadRecordPageState } from "./state";

import styles from "./page.module.css";

export function RecordPage() {
  const navigate = useNavigate();
  const { setFavorite, exportLead } = useLeadActions();
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar, enqueueInfoSnackBar } =
    useSnackBar();
  const { currentUser } = useAuthenticatedSession();
  const { navigateTo } = useSidePanel();
  const { pageState, leadId, activeTab, setActiveTab, setSubtitle } =
    useLeadRecordPageState();

  const canDeleteCompany = createMemo(() => currentUser().role === "superuser");
  const detailData = createMemo(() => leadDetailQuery(leadId()));

  createEffect(
    () => detailData()?.lead.ruc,
    (ruc) => {
      if (ruc !== undefined) {
        setSubtitle(ruc);
      }
    },
  );

  useEnrichmentWatch(() => detailData()?.lead.ruc);

  async function handleAddToFavorites() {
    const detail = detailData();

    if (!detail) {
      return;
    }

    try {
      const result = await setFavorite(detail.lead.id, detail.lead.isFavorite);

      if (result) {
        enqueueSuccessSnackBar(result.message);
      }
    } catch (caught: unknown) {
      enqueueErrorSnackBar(actionErrorMessage(caught));
    }
  }

  const cta = createMemo(() => {
    const detail = detailData();
    return detail ? nextActionCta(detail) : null;
  });

  function openFullRecord() {
    const detail = detailData();
    if (!detail) {
      return;
    }
    navigate(`/records/${detail.lead.id}`);
  }

  function runCtaTarget(target: NextActionTarget) {
    if (target.kind === "tab") {
      setActiveTab(target.tabId);
      return;
    }

    const detail = detailData();
    if (!detail) {
      return;
    }

    navigateTo(
      createLeadActionSidePanelPage({
        leadId: detail.lead.id,
        action: target.action,
        title: pageState().title,
        subtitle: cta()?.label ?? pageState().title,
      }),
    );
  }

  const primary = createMemo<FooterPrimary>(() => {
    const current = cta();

    if (current) {
      return {
        label: current.label,
        shortcut: "⏎",
        onClick: () => runCtaTarget(current.target),
      };
    }

    return {
      label: "Abrir",
      icon: <BrowserMaximize size={14} />,
      shortcut: "⏎",
      onClick: openFullRecord,
    };
  });

  const options = createMemo<FooterOption[]>(() => {
    const detail = detailData();
    if (!detail) {
      return [];
    }

    const lead = detail.lead;
    const items: FooterOption[] = [];

    // Keep the full record reachable when a stage CTA has taken the primary slot.
    if (cta()) {
      items.push({
        id: "open",
        label: "Abrir ficha completa",
        icon: BrowserMaximize,
        onSelect: openFullRecord,
      });
    }

    items.push({
      id: "favorite",
      label: "Agregar a favoritos",
      icon: Heart,
      disabled: lead.isFavorite,
      onSelect: () => void handleAddToFavorites(),
    });

    items.push({
      id: "export",
      label: "Exportar empresa",
      icon: Export,
      onSelect: () => {
        exportLead(lead);
        enqueueSuccessSnackBar("Empresa exportada");
      },
    });

    items.push({
      id: "mail",
      label: "Enviar correo (próximamente)",
      icon: Mail,
      disabled: true,
      onSelect: () => undefined,
    });

    if (detail.availableActions.includes("close-lead")) {
      items.push({
        id: "close",
        label: "Cerrar cotización",
        icon: X,
        onSelect: () =>
          navigateTo(
            createLeadActionSidePanelPage({
              leadId: lead.id,
              action: "close",
              title: pageState().title,
              subtitle: "Cerrar cotización",
            }),
          ),
      });
    }

    if (canDeleteCompany()) {
      items.push({
        id: "delete",
        label: "Eliminar empresa",
        icon: Trash,
        danger: true,
        onSelect: () =>
          enqueueInfoSnackBar("Eliminar empresa estará disponible pronto"),
      });
    }

    return items;
  });

  return (
    <SidePanelPage
      footer={
        <Show when={detailData()}>
          <SidePanelFooter primary={primary()} options={options()} />
        </Show>
      }
    >
      <Show
        when={detailData()}
        fallback={
          <div class={styles.hiddenTabContent}>Cargando detalle...</div>
        }
      >
        {(detail) => (
          <RecordTabs
            context={{ kind: "lead", data: detail() }}
            activeTab={activeTab()}
            onTabSelect={setActiveTab}
          />
        )}
      </Show>
    </SidePanelPage>
  );
}
