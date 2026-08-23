import type { JSX } from "@solidjs/web";
import type { Component } from "solid-js";

export type DataGridIcon = Component<{ size?: number | string }>;

// Editor calls close() on commit; the grid only positions the editor and
// tracks the open cell.
export type DataGridColumnEdit<T> = {
  ariaLabel: string;
  renderEditor: (row: T, close: () => void) => JSX.Element;
};

export type DataGridColumn<T> = {
  key: string;
  label: string;
  icon?: DataGridIcon;
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  grow?: boolean;
  sticky?: boolean;
  renderCell: (row: T) => JSX.Element;
  edit?: DataGridColumnEdit<T>;
};

export type DataGridActionRowConfig = {
  icon: DataGridIcon;
  label: string;
  onClick: () => void;
};

export type DataGridRowOpenIndicator = "panel" | "route";

export type DataGridLoadMore = {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void | Promise<void>;
};
