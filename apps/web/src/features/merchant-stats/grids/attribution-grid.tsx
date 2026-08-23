import { useAction } from "@solidjs/router";
import { Errored, Loading } from "solid-js";

import Building2 from "~/components/icons/building-2";
import CalendarDays from "~/components/icons/calendar-days";
import ChartColumn from "~/components/icons/chart-column";
import User from "~/components/icons/user";
import {
  InlineFieldEditor,
  InlineOptionsEditor,
} from "~/components/ui/input/inline-field-editor";
import type { CohortSaleRow } from "~/contracts/merchant-stats/views";
import { DataGrid } from "~/features/data-grid/components/grid";
import type { DataGridColumn } from "~/features/data-grid/model/types";

import {
  adjustMonthCreditMutation,
  setMerchantTargetMutation,
} from "../data/mutations";
import { formatMonth, formatSoles } from "../format";
import type { GpvView } from "../gpv-view";
import { useFilterOptions } from "../use-filter-options";
import { useCohortRowsGrid } from "./use-cohort-rows-grid";

import styles from "./grid-surface.module.css";

const UNASSIGNED = "Sin asignar";

export function AttributionGrid(props: { view: GpvView }) {
  const filterOptions = useFilterOptions();
  const sellers = () => filterOptions().sellers;
  const sellerNames = () => [
    UNASSIGNED,
    ...sellers().map((seller) => seller.name),
  ];

  const adjustMonthCredit = useAction(adjustMonthCreditMutation);
  const setMerchantTarget = useAction(setMerchantTargetMutation);

  const grid = useCohortRowsGrid(props.view);

  const columns: ReadonlyArray<DataGridColumn<CohortSaleRow>> = [
    {
      key: "ruc",
      label: "Comercio",
      icon: Building2,
      minWidth: 200,
      sticky: true,
      grow: true,
      renderCell: (row) => row.tradeName ?? row.ruc,
    },
    {
      key: "saleMonth",
      label: "Mes de venta",
      icon: CalendarDays,
      width: 130,
      renderCell: (row) => formatMonth(row.saleMonth),
    },
    {
      key: "seller",
      label: "Vendedor real",
      icon: User,
      width: 190,
      renderCell: (row) => row.sellerName,
      edit: {
        ariaLabel: "Editar vendedor",
        renderEditor: (row, close) => (
          <InlineOptionsEditor
            ariaLabel="Vendedor real"
            options={sellerNames()}
            selected={row.sellerName ?? UNASSIGNED}
            onSubmit={async (sellerName) => {
              const seller = sellers().find(
                (candidate) => candidate.name === sellerName,
              );

              await adjustMonthCredit({
                ruc: row.ruc,
                month: row.saleMonth,
                sellerUserId: seller?.userId ?? null,
                reason: "Corrección manual desde análisis de GPV",
              });
            }}
            onClose={close}
          />
        ),
      },
    },
    {
      key: "culqiUser",
      label: "Usuario Culqi",
      icon: User,
      width: 170,
      renderCell: (row) => row.culqiUserName,
    },
    {
      key: "branch",
      label: "Zonal",
      icon: Building2,
      width: 150,
      renderCell: (row) => row.branchName,
    },
    {
      key: "projected",
      label: "Proyectado",
      icon: ChartColumn,
      width: 170,
      renderCell: (row) =>
        row.projectedGpv != null ? formatSoles(row.projectedGpv) : null,
      edit: {
        ariaLabel: "Editar proyectado",
        renderEditor: (row, close) => (
          <InlineFieldEditor
            ariaLabel={`Proyectado desde ${formatMonth(row.saleMonth)}`}
            type="number"
            min="0"
            initialValue={row.projectedGpv?.toString() ?? ""}
            onSubmit={async (value) => {
              const trimmed = value.trim();
              const projectedGpv = trimmed === "" ? null : Number(trimmed);

              if (
                projectedGpv !== null &&
                (!Number.isFinite(projectedGpv) || projectedGpv < 0)
              ) {
                throw new Error("Ingresa un proyectado numérico válido");
              }

              await setMerchantTarget({
                ruc: row.ruc,
                effectiveFrom: row.saleMonth,
                projectedGpv,
              });
            }}
            onClose={close}
          />
        ),
      },
    },
  ];

  const renderGrid = (
    rows: ReadonlyArray<CohortSaleRow>,
    emptyState: string,
  ) => (
    <DataGrid
      ariaLabel="Atribución por RUC y mes"
      columns={columns}
      emptyState={emptyState}
      loadMore={{
        hasMore: grid.hasMore(),
        loading: grid.loading(),
        onLoadMore: grid.onLoadMore,
      }}
      rowId={(row) => row.saleId}
      source={{ rows }}
    />
  );

  return (
    <div class={styles.surface}>
      <Loading fallback={renderGrid([], "Cargando ventas...")}>
        <Errored fallback={renderGrid([], "No se pudieron cargar las ventas.")}>
          {renderGrid(grid.rows(), "No hay ventas para los filtros actuales.")}
        </Errored>
      </Loading>
    </div>
  );
}
