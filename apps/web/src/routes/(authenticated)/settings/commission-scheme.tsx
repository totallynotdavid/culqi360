import {
  type RouteDefinition,
  useAction,
  useSearchParams,
} from "@solidjs/router";
import {
  Loading,
  Show,
  createMemo,
  createSignal,
  createUniqueId,
} from "solid-js";
import { createStore, reconcile, snapshot } from "solid-js";

import { createActionPending } from "~/browser/ui/action-in-flight";
import { useSnackBar } from "~/components/feedback/snack-bar-manager/use-snack-bar";
import { Spinner } from "~/components/feedback/spinner/spinner";
import Building2 from "~/components/icons/building-2";
import Package from "~/components/icons/package";
import Target from "~/components/icons/target";
import { Button } from "~/components/ui/input/button";
import { actionErrorMessage } from "~/contracts/errors";
import type { CommissionSchemeRules } from "~/domain/merchant-stats/commission";
import { CorporativaTab } from "~/features/merchant-stats/commission/corporativa-tab";
import { EmpresaTab } from "~/features/merchant-stats/commission/empresa-tab";
import { MasivaTab } from "~/features/merchant-stats/commission/masiva-tab";
import { setCommissionSchemeMutation } from "~/features/merchant-stats/data/mutations";
import { SettingsPageLayout } from "~/features/settings-shell/page/settings-page-layout";
import {
  TabStrip,
  type TabItem,
} from "~/features/side-panel/components/tab-strip";
import { commissionSchemeDraftQuery } from "~/rpc/merchant-stats/commission-scheme";

import styles from "./commission-scheme.module.css";

export const route = {
  preload: () => {
    void commissionSchemeDraftQuery();
  },
} satisfies RouteDefinition;

type CommissionTabId = "masiva" | "corporativa" | "empresa";

const DEFAULT_TAB: CommissionTabId = "masiva";

const COMMISSION_TABS: readonly TabItem<CommissionTabId>[] = [
  { id: "masiva", label: "Masiva", pill: "Mesa 2 y 3", icon: Package },
  { id: "corporativa", label: "Corporativa", pill: "Mesa 1", icon: Building2 },
  { id: "empresa", label: "Empresa", icon: Target },
];

function useCommissionTab() {
  const [params, setParams] = useSearchParams<{ tab?: string }>();

  const tab = createMemo<CommissionTabId>(() => {
    const raw = Array.isArray(params.tab) ? params.tab[0] : params.tab;

    return COMMISSION_TABS.find((item) => item.id === raw)?.id ?? DEFAULT_TAB;
  });

  return {
    tab,
    setTab: (id: CommissionTabId) =>
      setParams({ tab: id === DEFAULT_TAB ? null : id }, { scroll: false }),
  };
}

function CommissionSchemeForm(props: { initial: CommissionSchemeRules }) {
  const [draft, setDraft] = createStore<CommissionSchemeRules>(
    structuredClone(props.initial),
  );
  const [baseline, setBaseline] = createSignal(structuredClone(props.initial));

  const save = useAction(setCommissionSchemeMutation);
  const saving = createActionPending(setCommissionSchemeMutation);
  const { enqueueSuccessSnackBar, enqueueErrorSnackBar } = useSnackBar();
  const formId = createUniqueId();
  const { tab, setTab } = useCommissionTab();

  const isDirty = createMemo(
    () => JSON.stringify(snapshot(draft)) !== JSON.stringify(baseline()),
  );

  async function handleSubmit(event: SubmitEvent) {
    event.preventDefault();

    // Solid stores are proxies, so snapshot before cloning.
    const rules = structuredClone(snapshot(draft));
    const effectiveFrom = new Date().toISOString().slice(0, 10);

    try {
      await save({ effectiveFrom, rules });

      setBaseline(rules);
      enqueueSuccessSnackBar("Esquema de comisiones actualizado");
    } catch (error) {
      enqueueErrorSnackBar(actionErrorMessage(error));
    }
  }

  function handleCancel() {
    setDraft(reconcile(structuredClone(baseline())));
  }

  return (
    <SettingsPageLayout
      actionButton={
        <Show when={isDirty()}>
          <div class={styles.actionButtons}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleCancel}
            >
              Cancelar
            </Button>

            <Button type="submit" form={formId} size="sm" loading={saving()}>
              Guardar
            </Button>
          </div>
        </Show>
      }
    >
      <div class={styles.tabStrip}>
        <TabStrip
          tabs={COMMISSION_TABS}
          activeTab={tab()}
          onTabSelect={setTab}
        />
      </div>

      <form
        id={formId}
        class={styles.sectionStack}
        onSubmit={(event) => void handleSubmit(event)}
      >
        <Show when={tab() === "masiva"}>
          <MasivaTab draft={draft} setDraft={setDraft} />
        </Show>

        <Show when={tab() === "corporativa"}>
          <CorporativaTab draft={draft} setDraft={setDraft} />
        </Show>

        <Show when={tab() === "empresa"}>
          <EmpresaTab draft={draft} setDraft={setDraft} />
        </Show>
      </form>
    </SettingsPageLayout>
  );
}

export default function CommissionSchemePage() {
  const draft = createMemo(() => commissionSchemeDraftQuery());

  return (
    <Loading fallback={<Spinner />}>
      <CommissionSchemeForm initial={draft()} />
    </Loading>
  );
}
