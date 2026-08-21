import { type JSX } from "@solidjs/web";
/* oxlint-disable jsx-a11y/no-noninteractive-element-to-interactive-role */
import { Show } from "solid-js";

import { useDataGrid } from "../context/instance-context";
import {
  REORDER_COLUMN_WIDTH,
  SELECTION_COLUMN_WIDTH,
} from "../model/column-layout";
import type { DataGridProps } from "../model/grid";
import { DataGridBody } from "./body";
import { DataGridEditorLayer } from "./editor-layer";
import { DataGridHeader } from "./header";
import { DataGridLoadMoreSentinel } from "./load-more-sentinel";

import styles from "../styles/table.module.css";

type DataGridSurfaceProps<T> = Omit<
  DataGridProps<T>,
  "reorder" | "selection"
> & {
  gridTemplateColumns: string;
  stickyColumnIndex: number;
};

function SurfaceMessage(props: { content: JSX.Element }) {
  return (
    <Show when={typeof props.content === "string"} fallback={props.content}>
      <p class={styles.surfaceMessage}>{props.content}</p>
    </Show>
  );
}

export function DataGridSurface<T>(props: DataGridSurfaceProps<T>) {
  const grid = useDataGrid();
  const rows = () => props.source.rows;
  const paginationStart = () =>
    (props.pagination?.currentPage ?? 0) * (props.pagination?.pageSize ?? 0) +
    1;
  const paginationEnd = () =>
    Math.min(
      (props.pagination?.currentPage ?? 0) * (props.pagination?.pageSize ?? 0) +
        rows().length,
      props.pagination?.totalCount ?? rows().length,
    );
  const hasPreviousPage = () => (props.pagination?.currentPage ?? 0) > 0;
  const hasNextPage = () =>
    props.pagination !== undefined &&
    paginationEnd() < props.pagination.totalCount;
  const shouldShowPagination = () =>
    props.pagination !== undefined && rows().length > 0;
  const selectionLeft = () => (grid.reorder ? REORDER_COLUMN_WIDTH : 0);
  const stickyLeft = () =>
    selectionLeft() + (grid.selection ? SELECTION_COLUMN_WIDTH : 0);
  const ariaColumnCount = () =>
    props.columns.length +
    Number(!!grid.reorder) +
    Number(!!grid.selection) +
    Number(props.onAddColumn !== undefined);
  const rowIndexOffset = () =>
    (props.pagination?.currentPage ?? 0) * (props.pagination?.pageSize ?? 0);
  const dataRowCount = () =>
    Math.max(
      props.source.totalCount ?? rows().length,
      rowIndexOffset() + rows().length,
    );
  const ariaRowCount = () =>
    dataRowCount() + 1 + Number(props.actionRow !== undefined);

  return (
    <div class={styles.indexContainer}>
      <div class={styles.tableContainer}>
        <div ref={grid.setScrollWrapper} class={styles.scrollWrapper}>
          <section
            ref={grid.setContainer}
            class={styles.table}
            aria-label={props.ariaLabel}
            aria-colcount={ariaColumnCount()}
            aria-rowcount={ariaRowCount()}
            role="grid"
            style={{
              "--data-grid-columns": props.gridTemplateColumns,
              "--data-grid-selection-left": `${selectionLeft()}px`,
              "--data-grid-sticky-left": `${stickyLeft()}px`,
            }}
          >
            <DataGridHeader
              columns={props.columns}
              onAddColumn={props.onAddColumn}
              stickyColumnIndex={props.stickyColumnIndex}
            />

            <Show
              when={rows().length > 0}
              fallback={
                <div class={styles.emptyStateSurface} role="row">
                  <div role="gridcell">
                    <SurfaceMessage content={props.emptyState} />
                  </div>
                </div>
              }
            >
              <DataGridBody
                actionRow={props.actionRow}
                columns={props.columns}
                onRowOpen={props.onRowOpen}
                rowId={props.rowId}
                rowOpenIndicator={props.rowOpenIndicator}
                rowIndexOffset={rowIndexOffset()}
                rows={rows()}
                totalRowCount={dataRowCount()}
                stickyColumnIndex={props.stickyColumnIndex}
              />
              <Show when={props.loadMore}>
                {(loadMore) => <DataGridLoadMoreSentinel config={loadMore()} />}
              </Show>
            </Show>
            <DataGridEditorLayer
              columns={props.columns}
              rowId={props.rowId}
              rows={rows()}
            />
          </section>
        </div>

        <Show when={shouldShowPagination()}>
          <div class={styles.paginationBar}>
            <span class={styles.paginationMeta}>
              {paginationStart()}-{paginationEnd()} de{" "}
              {props.pagination?.totalCount ?? rows().length}
            </span>
            <div class={styles.paginationControls}>
              <button
                type="button"
                class={styles.paginationButton}
                disabled={!hasPreviousPage()}
                onClick={() => props.pagination?.onPreviousPage()}
              >
                Anterior
              </button>
              <button
                type="button"
                class={styles.paginationButton}
                disabled={!hasNextPage()}
                onClick={() => props.pagination?.onNextPage()}
              >
                Siguiente
              </button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
}
