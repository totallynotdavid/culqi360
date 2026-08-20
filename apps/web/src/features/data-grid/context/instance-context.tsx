import { createContext, type ParentProps, useContext } from "solid-js";

import type { DataGridController } from "../hooks/create-controller";

const DataGridContext = createContext<DataGridController>();

export function DataGridProvider(
  props: ParentProps<{ value: DataGridController }>,
) {
  return (
    <DataGridContext value={props.value}>{props.children}</DataGridContext>
  );
}

export function useDataGrid() {
  const grid = useContext(DataGridContext);
  if (!grid) {
    throw new Error("useDataGrid must be used within DataGridProvider");
  }

  return grid;
}
