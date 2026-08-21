import { createMemo } from "solid-js";

import { DataGridProvider } from "../context/instance-context";
import { DataGridBodyEffects } from "../effects/body";
import { createDataGridController } from "../hooks/create-controller";
import { createDataGridInteractionReady } from "../hooks/use-interaction-ready";
import {
  ADD_COLUMN_WIDTH,
  buildDataGridTemplateColumns,
  getStickyDataGridColumnIndex,
  REORDER_COLUMN_WIDTH,
  SELECTION_COLUMN_WIDTH,
} from "../model/column-layout";
import type { DataGridProps } from "../model/grid";
import { DataGridSurface } from "./surface";

export function DataGrid<T>(props: DataGridProps<T>) {
  const rows = createMemo(() => props.source.rows);
  const isInteractive = createDataGridInteractionReady();
  const controller = createDataGridController({
    rows,
    rowId: props.rowId,
    columns: () => props.columns,
    reorder: props.reorder,
    selection: props.selection,
    isInteractive,
  });
  const gridTemplateColumns = createMemo(() =>
    buildDataGridTemplateColumns(props.columns, {
      leadingTracks: [
        controller.reorder ? REORDER_COLUMN_WIDTH : undefined,
        controller.selection ? SELECTION_COLUMN_WIDTH : undefined,
      ].filter((width): width is number => width !== undefined),
      trailingTracks: props.onAddColumn ? [ADD_COLUMN_WIDTH] : [],
      columnWidths: controller.resize.columnWidths(),
    }),
  );
  const stickyColumnIndex = createMemo(() =>
    getStickyDataGridColumnIndex(props.columns),
  );

  return (
    <DataGridProvider value={controller}>
      <DataGridBodyEffects />
      <DataGridSurface
        actionRow={props.actionRow}
        ariaLabel={props.ariaLabel}
        columns={props.columns}
        emptyState={props.emptyState}
        gridTemplateColumns={gridTemplateColumns()}
        loadMore={props.loadMore}
        onAddColumn={props.onAddColumn}
        onRowOpen={props.onRowOpen}
        pagination={props.pagination}
        rowId={props.rowId}
        rowOpenIndicator={props.rowOpenIndicator}
        source={props.source}
        stickyColumnIndex={stickyColumnIndex()}
      />
    </DataGridProvider>
  );
}
