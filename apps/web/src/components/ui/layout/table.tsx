import { type JSX } from "@solidjs/web";
import { clsx } from "clsx";
import { omit } from "solid-js";

import styles from "./table.module.css";

type TableProps = JSX.HTMLAttributes<HTMLTableElement> & {
  variant?: "default" | "list";
};

export const Table = (props: TableProps) => {
  const tableProps = omit(props, "class", "variant");
  return (
    <div class={styles.wrapper}>
      <table
        class={clsx(
          styles.table,
          props.variant === "list" && styles.list,
          props.class,
        )}
        {...tableProps}
      />
    </div>
  );
};

export const TableHeader = (
  props: JSX.HTMLAttributes<HTMLTableSectionElement>,
) => <thead {...props} />;

export const TableBody = (
  props: JSX.HTMLAttributes<HTMLTableSectionElement>,
) => <tbody {...props} />;

type TableRowProps = JSX.HTMLAttributes<HTMLTableRowElement> & {
  clickable?: boolean;
};

export const TableRow = (props: TableRowProps) => {
  const rowProps = omit(props, "class", "clickable");
  return (
    <tr
      class={clsx(styles.row, props.class)}
      data-clickable={props.clickable ? "true" : undefined}
      {...rowProps}
    />
  );
};

type TableHeadProps = JSX.ThHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "center" | "right";
};

export const TableHead = (props: TableHeadProps) => {
  const headProps = omit(props, "align", "class");
  return (
    <th
      class={clsx(styles.head, props.class)}
      data-align={props.align ?? "left"}
      {...headProps}
    />
  );
};

type TableCellProps = JSX.TdHTMLAttributes<HTMLTableCellElement> & {
  align?: "left" | "center" | "right";
  ellipsis?: boolean;
};

export const TableCell = (props: TableCellProps) => {
  const cellProps = omit(props, "align", "class", "ellipsis");
  return (
    <td
      class={clsx(styles.cell, props.ellipsis && styles.ellipsis, props.class)}
      data-align={props.align ?? "left"}
      {...cellProps}
    />
  );
};
