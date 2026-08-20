import Plus from "~/components/icons/plus";
import { DataGrid } from "~/features/data-grid/components/grid";

import type { RecordIndexController } from "../model/controller";
import { RecordIndexEmpty } from "./empty";

export function RecordIndexTableContainer<T extends { id: string }>(props: {
  controller: RecordIndexController<T>;
}) {
  const source = () => props.controller.source();
  const actionRow = () => {
    const createAction = props.controller.definition.createAction;

    if (!createAction || source().rows.length === 0) {
      return undefined;
    }

    return {
      icon: createAction.icon ?? Plus,
      label: createAction.inlineLabel ?? createAction.label,
      onClick: createAction.onClick,
    };
  };

  return (
    <DataGrid
      actionRow={actionRow()}
      ariaLabel={props.controller.definition.ariaLabel}
      columns={props.controller.visibleColumns()}
      emptyState={<RecordIndexEmpty />}
      onRowOpen={props.controller.definition.onRowOpen}
      pagination={
        props.controller.definition.pagination
          ? {
              currentPage: props.controller.definition.pagination.currentPage(),
              pageSize: props.controller.definition.pagination.pageSize,
              totalCount: props.controller.definition.pagination.totalCount(),
              onNextPage: props.controller.definition.pagination.onNextPage,
              onPreviousPage:
                props.controller.definition.pagination.onPreviousPage,
            }
          : undefined
      }
      reorder={props.controller.definition.reorder}
      rowId={(row) => row.id}
      rowOpenIndicator={props.controller.definition.rowOpenIndicator}
      selection={props.controller.selection}
      source={source()}
    />
  );
}
