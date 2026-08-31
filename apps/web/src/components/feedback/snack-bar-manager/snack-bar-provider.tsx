import { AnimatePresenceList, motion } from "@crm/solid-motion";
import { Portal, type JSX } from "@solidjs/web";
import { createContext, createMemo, createStore } from "solid-js";

import { useIsMobile } from "~/components/ui/layout/responsive/use-is-mobile";

import { SnackBar } from "./snack-bar";
import type {
  SnackBarContextValue,
  SnackBarItem,
  SnackBarPatch,
  SnackBarSpec,
} from "./types";

import styles from "./snack-bar-provider.module.css";

const DEFAULT_DURATION_MS = 5000;
const SLIDE = { duration: 0.5, ease: [0.22, 1, 0.36, 1] } as const;
const MAX_QUEUE = 3;
const SNACK_BAR_Z_INDEX = 10002;

export const SnackBarContext = createContext<SnackBarContextValue>();

export function SnackBarProvider(props: { children: JSX.Element }) {
  // Toasts enter from the top on mobile and the bottom elsewhere, so this has to
  // follow a resize rather than sample the viewport once at startup.
  const isMobile = useIsMobile();

  const motionVariants = createMemo(() => ({
    out: { opacity: 0, y: isMobile() ? -40 : 40 },
    in: { opacity: 1, y: 0 },
  }));

  const [items, setItems] = createStore<SnackBarItem[]>([]);
  let counter = 0;

  const enqueue = (spec: SnackBarSpec): string => {
    if (spec.dedupeKey) {
      const isDuplicate = items.some(
        (item) => item.dedupeKey === spec.dedupeKey,
      );
      if (isDuplicate) {
        return "";
      }
    }

    counter += 1;
    const id = `snack-bar-${counter}`;

    const item: SnackBarItem = {
      id,
      variant: spec.variant,
      message: spec.message,
      detailedMessage: spec.detailedMessage ?? null,
      duration: spec.duration ?? DEFAULT_DURATION_MS,
      dedupeKey: spec.dedupeKey ?? null,
      buttonLabel: spec.buttonLabel ?? null,
      buttonOnClick: spec.buttonOnClick ?? null,
      buttonTo: spec.buttonTo ?? null,
      onCancel: spec.onCancel ?? null,
      icon: spec.icon ?? null,
      role: spec.role ?? "status",
    };

    setItems((current) =>
      current.length >= MAX_QUEUE
        ? [...current.slice(1), item]
        : [...current, item],
    );

    return id;
  };

  const update = (id: string, patch: SnackBarPatch): void => {
    setItems((draft) => {
      const item = draft.find((candidate) => candidate.id === id);

      if (item) {
        Object.assign(item, patch);
      }
    });
  };

  const dismiss = (id: string): void => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  return (
    <SnackBarContext value={{ enqueue, update, dismiss }}>
      {props.children}
      <Portal>
        <div
          class={styles.container}
          style={{ "z-index": String(SNACK_BAR_Z_INDEX) }}
        >
          <AnimatePresenceList each={items} getKey={(item) => item.id}>
            {(item) => (
              <motion.div
                variants={motionVariants()}
                initial="out"
                animate="in"
                exit="out"
                transition={SLIDE}
              >
                <SnackBar item={item()} onDismiss={() => dismiss(item().id)} />
              </motion.div>
            )}
          </AnimatePresenceList>
        </div>
      </Portal>
    </SnackBarContext>
  );
}
