import { useNavigate } from "@solidjs/router";
import { Show, createMemo, createSignal } from "solid-js";

import { useModKeyLabel } from "~/browser/hotkey/use-mod-key-label";
import ChevronDown from "~/components/icons/chevron-down";
import ChevronUp from "~/components/icons/chevron-up";
import Heart from "~/components/icons/heart";
import Mail from "~/components/icons/mail";
import Trash from "~/components/icons/trash";
import { TopBarActionButton } from "~/components/layout/top-bar-action-button";
import { TopBarCommandButton } from "~/components/layout/top-bar-command-button";
import { TopBarTooltip } from "~/components/layout/top-bar-tooltip";
import { useAuthenticatedSession } from "~/components/providers/authenticated-session-provider";
import { ConfirmDialog } from "~/components/ui/confirm-dialog";
import { actionErrorMessage } from "~/contracts/errors";
import { hasPermission } from "~/domain/auth/access/rbac";
import { useLeadActions } from "~/features/record-show/use-record-actions";
import { PAGE_HEADER_SIDE_PANEL_BUTTON_CLICK_OUTSIDE_ID } from "~/features/side-panel/constants/side-panel-click-outside-id";
import { useSidePanelMenu } from "~/features/side-panel/hooks/use-side-panel-menu";
import { leadDetailQuery } from "~/rpc/workflow/lead-detail";
import { leadListQuery } from "~/rpc/workflow/lead-list";

import {
  RecordShowActionsMenu,
  type RecordShowMenuItem,
} from "./record-show-actions-menu";

import styles from "./record-show-header.module.css";

const LEAD_NAVIGATION_LIMIT = 200;

export function RecordShowHeaderActions(props: { leadId: string }) {
  const navigate = useNavigate();
  const detail = createMemo(() => leadDetailQuery(props.leadId));
  const leadList = createMemo(() =>
    leadListQuery({ limit: LEAD_NAVIGATION_LIMIT, offset: 0 }),
  );

  const { favoriteBusy, setFavorite, deleteBusy, deleteLead } =
    useLeadActions();
  const { currentUser } = useAuthenticatedSession();
  const { isSidePanelOpen, toggleSidePanelMenu } = useSidePanelMenu();
  const modKey = useModKeyLabel();

  const [confirmDeleteOpen, setConfirmDeleteOpen] = createSignal(false);
  const [deleteErrorMessage, setDeleteErrorMessage] = createSignal<
    string | null
  >(null);

  const canDelete = createMemo(
    () =>
      detail()?.lead != null &&
      hasPermission(currentUser().role, "lead:delete"),
  );

  const menuItems = createMemo<RecordShowMenuItem[]>(() => {
    const items: RecordShowMenuItem[] = [];

    if (canDelete()) {
      items.push({
        id: "delete",
        label: "Eliminar empresa",
        icon: Trash,
        danger: true,
        disabled: deleteBusy(),
        onSelect: () => {
          setDeleteErrorMessage(null);
          setConfirmDeleteOpen(true);
        },
      });
    }

    return items;
  });

  const currentIndex = createMemo(() => {
    const rows = leadList()?.rows;

    if (!rows) {
      return -1;
    }

    return rows.findIndex((row) => row.id === props.leadId);
  });

  const previousLeadId = createMemo(() => {
    const rows = leadList()?.rows;
    const index = currentIndex();

    if (!rows || index <= 0) {
      return null;
    }

    return rows[index - 1]?.id ?? null;
  });

  const nextLeadId = createMemo(() => {
    const rows = leadList()?.rows;
    const index = currentIndex();

    if (!rows || index < 0 || index >= rows.length - 1) {
      return null;
    }

    return rows[index + 1]?.id ?? null;
  });

  const isFavorite = () => detail()?.lead.isFavorite ?? false;

  const goToLead = (leadId: string | null) => {
    if (!leadId) {
      return;
    }

    navigate(`/records/${leadId}`);
  };

  const toggleFavorite = () => {
    void setFavorite(props.leadId, isFavorite());
  };

  async function handleConfirmDelete() {
    setDeleteErrorMessage(null);

    try {
      await deleteLead(props.leadId);
      setConfirmDeleteOpen(false);
      navigate("/records");
    } catch (caught) {
      setDeleteErrorMessage(actionErrorMessage(caught));
    }
  }

  return (
    <>
      <TopBarTooltip content="Registro siguiente">
        <TopBarActionButton
          ariaLabel="Navegar al siguiente registro"
          iconOnly
          disabled={!nextLeadId()}
          onClick={() => goToLead(nextLeadId())}
        >
          <ChevronDown size={16} />
        </TopBarActionButton>
      </TopBarTooltip>

      <TopBarTooltip content="Registro anterior">
        <TopBarActionButton
          ariaLabel="Navegar al registro anterior"
          iconOnly
          disabled={!previousLeadId()}
          onClick={() => goToLead(previousLeadId())}
        >
          <ChevronUp size={16} />
        </TopBarActionButton>
      </TopBarTooltip>

      <TopBarTooltip
        content={isFavorite() ? "Quitar de favoritos" : "Agregar a favoritos"}
      >
        <TopBarActionButton
          ariaLabel={
            isFavorite() ? "Quitar de favoritos" : "Agregar a favoritos"
          }
          iconOnly
          disabled={favoriteBusy()}
          pressed={isFavorite()}
          onClick={toggleFavorite}
          class={styles.desktopAction}
        >
          <Heart size={16} color={isFavorite() ? "var(--accent)" : undefined} />
        </TopBarActionButton>
      </TopBarTooltip>

      <TopBarTooltip content="Enviar email estará disponible pronto">
        <TopBarActionButton
          ariaLabel="Enviar email"
          label="Enviar email"
          disabled
          class={styles.desktopAction}
        >
          <Mail size={14} />
        </TopBarActionButton>
      </TopBarTooltip>

      <RecordShowActionsMenu items={menuItems()} />

      <TopBarCommandButton
        isOpen={isSidePanelOpen()}
        modKey={modKey()}
        onClick={toggleSidePanelMenu}
        dataClickOutsideId={PAGE_HEADER_SIDE_PANEL_BUTTON_CLICK_OUTSIDE_ID}
      />

      <ConfirmDialog
        isOpen={confirmDeleteOpen()}
        title="Eliminar empresa"
        description="Se quitará de tus listas de clientes. Esta acción no se puede deshacer desde la aplicación."
        confirmLabel="Eliminar"
        variant="destructive"
        loading={deleteBusy()}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setConfirmDeleteOpen(false)}
      >
        <Show when={deleteErrorMessage()}>
          {(message) => <p class={styles.deleteError}>{message()}</p>}
        </Show>
      </ConfirmDialog>
    </>
  );
}
