import { createContext, type ParentProps, useContext } from "solid-js";

import type { RecordIndexUiController } from "../model/controller";

const RecordIndexContext = createContext<RecordIndexUiController>();

export function RecordIndexProvider(
  props: ParentProps<{ value: RecordIndexUiController }>,
) {
  return (
    <RecordIndexContext value={props.value}>
      {props.children}
    </RecordIndexContext>
  );
}

export function useRecordIndex(): RecordIndexUiController {
  const controller = useContext(RecordIndexContext);
  if (!controller) {
    throw new Error("useRecordIndex must be used within RecordIndexProvider");
  }

  return controller;
}
