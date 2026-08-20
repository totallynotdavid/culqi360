import { Portal, type JSX } from "@solidjs/web";
import { createContext, createStore, onSettled } from "solid-js";

import { AnimatePresence } from "~/components/ui/animation/animate-presence";
import { Animated } from "~/components/ui/animation/animated";

import { SnackBar } from "./snack-bar";
import type {
  SnackBarContextValue,
  SnackBarItem,
  SnackBarPatch,
  SnackBarSpec,
} from "./types";

import styles from "./snack-bar-provider.module.css";

const DEFAULT_DURATION_MS = 5000;
const MAX_QUEUE = 3;
const TICK_MS = 100;
const MOBILE_VIEWPORT = 768;
const SNACK_BAR_Z_INDEX = 10002;

export const SnackBarContext = createContext<SnackBarContextValue>();

export function SnackBarProvider(props: { children: JSX.Element }) {
  const isMobile =
    typeof window !== "undefined"
      ? window.matchMedia(`(max-width: ${MOBILE_VIEWPORT}px)`).matches
      : false;

  const motionVariants = {
    out: { opacity: 0, y: isMobile ? -40 : 40 },
    in: { opacity: 1, y: 0 },
  } as const;

  const [items, setItems] = createStore<SnackBarItem[]>([]);
  let counter = 0;

  onSettled(() => {
    const intervalId = setInterval(() => {
      setItems((draft) => {
        for (const item of draft) {
          if (
            !item.paused &&
            item.duration > 0 &&
            item.elapsed < item.duration
          ) {
            item.elapsed = Math.min(item.duration, item.elapsed + TICK_MS);
          }
        }

        for (let index = draft.length - 1; index >= 0; index -= 1) {
          const item = draft[index]!;

          if (item.duration > 0 && item.elapsed >= item.duration) {
            draft.splice(index, 1);
          }
        }
      });
    }, TICK_MS);
    return () => clearInterval(intervalId);
  });

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
      elapsed: 0,
      paused: false,
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

      if (!item) {
        return;
      }

      if (patch.message !== undefined) {
        item.message = patch.message;
      }
      if (patch.detailedMessage !== undefined) {
        item.detailedMessage = patch.detailedMessage;
      }
      if (patch.variant !== undefined) {
        item.variant = patch.variant;
      }
      if (patch.duration !== undefined) {
        item.duration = patch.duration;
        item.elapsed = 0;
      }
    });
  };

  const dismiss = (id: string): void => {
    setItems((current) => current.filter((item) => item.id !== id));
  };

  const pause = (id: string): void => {
    setItems((draft) => {
      const item = draft.find((candidate) => candidate.id === id);

      if (item) {
        item.paused = true;
      }
    });
  };

  const resume = (id: string): void => {
    setItems((draft) => {
      const item = draft.find((candidate) => candidate.id === id);

      if (item) {
        item.paused = false;
      }
    });
  };

  return (
    <SnackBarContext value={{ enqueue, update, dismiss }}>
      {props.children}
      <Portal>
        <div
          class={styles.container}
          style={{ "z-index": String(SNACK_BAR_Z_INDEX) }}
        >
          <AnimatePresence each={items} getKey={(item) => item.id}>
            {(item) => (
              <Animated
                key={item.id}
                variants={motionVariants}
                initial="out"
                animate="in"
                exit="out"
                transition={{ duration: 0.5 }}
              >
                <SnackBar
                  item={item}
                  onDismiss={() => dismiss(item.id)}
                  onPause={() => pause(item.id)}
                  onResume={() => resume(item.id)}
                />
              </Animated>
            )}
          </AnimatePresence>
        </div>
      </Portal>
    </SnackBarContext>
  );
}
