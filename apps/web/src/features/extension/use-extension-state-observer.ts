import { createEffect } from "solid-js";
import type { Accessor } from "solid-js";

import type { ExecutiveStateSnapshot } from "./runtime";

interface UseExtensionStateObserverOptions {
  extensionState: Accessor<ExecutiveStateSnapshot | null>;
  extensionErrorMessage: Accessor<string | null>;
  onStateChange?: (state: ExecutiveStateSnapshot | null) => void;
  onErrorChange?: (error: string | null) => void;
  onReauthRequired?: () => void;
  onActiveAssignmentChange?: (assignmentId: number | null) => void;
  onSyncError?: () => void;
}

export function useExtensionStateObserver(
  options: UseExtensionStateObserverOptions,
): void {
  createEffect(
    () => ({
      state: options.extensionState(),
      error: options.extensionErrorMessage(),
    }),
    (next, previous) => {
      // Seeding the missing first previous with nulls means an opening snapshot
      // that is already null counts as no change and fires nothing.
      const prev = previous ?? { state: null, error: null };

      if (next.state !== prev.state) {
        options.onStateChange?.(next.state);

        if (
          next.state?.syncHealth === "reauth_required" &&
          prev.state?.syncHealth !== "reauth_required"
        ) {
          options.onReauthRequired?.();
        }

        if (
          next.state?.syncHealth === "error" &&
          prev.state?.syncHealth !== "error"
        ) {
          options.onSyncError?.();
        }

        if (next.state?.assignmentId !== prev.state?.assignmentId) {
          options.onActiveAssignmentChange?.(next.state?.assignmentId ?? null);
        }
      }

      if (next.error !== prev.error) {
        options.onErrorChange?.(next.error);
      }
    },
  );
}
