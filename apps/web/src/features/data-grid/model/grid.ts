import type { JSX } from "@solidjs/web";

import type { DataGridReorderConfig } from "../dnd/types";
import type { DataGridSelectionController } from "./selection";
import type { DataGridSource } from "./source";
import type {
  DataGridActionRowConfig,
  DataGridColumn,
  DataGridLoadMore,
  DataGridRowOpenIndicator,
} from "./types";

export type DataGridPagination = {
  currentPage: number;
  pageSize: number;
  totalCount: number;
  onNextPage: () => void;
  onPreviousPage: () => void;
};

export type DataGridProps<T> = {
  actionRow?: DataGridActionRowConfig;
  ariaLabel: string;
  columns: readonly DataGridColumn<T>[];
  emptyState: JSX.Element;
  loadMore?: DataGridLoadMore;
  onAddColumn?: () => void;
  onRowOpen?: (row: T) => void;
  pagination?: DataGridPagination;
  reorder?: DataGridReorderConfig<T>;
  rowId: (row: T) => string;
  rowOpenIndicator?: DataGridRowOpenIndicator;
  selection?: DataGridSelectionController;
  source: DataGridSource<T>;
};
