import type { JSX } from "@solidjs/web";

export type SnackBarVariant =
  | "default"
  | "error"
  | "success"
  | "info"
  | "warning";

export interface SnackBarSpec {
  variant: SnackBarVariant;
  message: string;
  detailedMessage?: string;
  duration?: number;
  dedupeKey?: string;
  buttonLabel?: string;
  buttonOnClick?: () => void;
  buttonTo?: string;
  onCancel?: () => void;
  icon?: JSX.Element;
  role?: "alert" | "status";
}

export interface SnackBarItem {
  id: string;
  variant: SnackBarVariant;
  message: string;
  detailedMessage: string | null;
  // Zero keeps the toast until something dismisses it.
  duration: number;
  dedupeKey: string | null;
  buttonLabel: string | null;
  buttonOnClick: (() => void) | null;
  buttonTo: string | null;
  onCancel: (() => void) | null;
  icon: JSX.Element | null;
  role: "alert" | "status";
}

export type SnackBarPatch = Partial<
  Pick<SnackBarItem, "message" | "detailedMessage" | "variant" | "duration">
>;

export type SnackBarCallOptions = Omit<SnackBarSpec, "variant" | "message">;

export interface SnackBarContextValue {
  enqueue: (spec: SnackBarSpec) => string;
  update: (id: string, patch: SnackBarPatch) => void;
  dismiss: (id: string) => void;
}
