import { createMemo } from "solid-js";
import { useAction } from "@solidjs/router";

import CircleQuestionMark from "~/components/icons/circle-question-mark";
import List from "~/components/icons/list";
import MessageSquare from "~/components/icons/message-square";
import UserRound from "~/components/icons/user-round";
import { Button } from "~/components/ui/input/button";
import type { PendingCapacityRequestView } from "~/contracts/capacity";
import {
  approveCapacityRequestMutation,
  rejectCapacityRequestMutation,
} from "~/features/capacity/data/mutations";
import { DataGrid } from "~/features/data-grid/components/grid";
import type { DataGridSource } from "~/features/data-grid/model/source";
import type { DataGridColumn } from "~/features/data-grid/model/types";
import { pendingCapacityRequestsQuery } from "~/rpc/capacity/pending-capacity-requests";

import styles from "./requests-page.module.css";

export default function TeamRequestsPage() {
  const requests = createMemo(() => pendingCapacityRequestsQuery());
  const approveRequest = useAction(approveCapacityRequestMutation);
  const rejectRequest = useAction(rejectCapacityRequestMutation);

  const source = (): DataGridSource<PendingCapacityRequestView> => {
    const rows = requests();

    if (rows === undefined) {
      return { status: "pending", rows: [] };
    }

    return { status: "ready", rows };
  };

  const columns = [
    {
      key: "names",
      label: "Ejecutivo",
      icon: UserRound,
      minWidth: 240,
      sticky: true,
      renderCell: (request) =>
        [request.names, request.firstSurname, request.secondSurname]
          .filter(Boolean)
          .join(" "),
    },
    {
      key: "kind",
      label: "Tipo",
      icon: List,
      width: 160,
      renderCell: (request) =>
        request.kind === "search_extra" ? "Más búsquedas" : "Más asignaciones",
    },
    {
      key: "requestedAmount",
      label: "Cantidad",
      icon: CircleQuestionMark,
      width: 120,
      renderCell: (request) => request.requestedAmount,
    },
    {
      key: "reason",
      label: "Motivo",
      icon: MessageSquare,
      minWidth: 260,
      grow: true,
      renderCell: (request) => request.reason,
    },
    {
      key: "actions",
      label: "Acciones",
      icon: CircleQuestionMark,
      width: 240,
      renderCell: (request) => (
        <div class={styles.rowActions}>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void approveRequest(request.id)}
          >
            Aprobar
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              void rejectRequest(request.id, "Rechazado desde la cola")
            }
          >
            Rechazar
          </Button>
        </div>
      ),
    },
  ] satisfies ReadonlyArray<DataGridColumn<PendingCapacityRequestView>>;

  return (
    <div class={styles.page}>
      <DataGrid
        ariaLabel="Solicitudes del equipo"
        columns={columns}
        emptyState="No hay solicitudes pendientes."
        rowId={(row) => row.id}
        source={source()}
      />
    </div>
  );
}
