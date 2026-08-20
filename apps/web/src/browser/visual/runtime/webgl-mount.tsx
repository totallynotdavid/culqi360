import { type JSX } from "@solidjs/web";
import {
  Show,
  createEffect,
  createMemo,
  createSignal,
  onSettled,
} from "solid-js";

import { observeElementVisibility } from "~/browser/dom/observe-element-visibility";

import {
  subscribeToWebGlContextCount,
  tryAcquireWebGlContextSlot,
  type WebGlContextHandle,
} from "./active-webgl-context-budget";
import { SITE_WEBGL_CONTEXT_LOST_EVENT } from "./create-site-webgl-renderer";
import { useWebGlPolicy } from "./use-webgl-policy";
import {
  scheduleVisualMount,
  type VisualMountPriority,
} from "./visual-mount-scheduler";

const NON_PRIORITY_ROOT_MARGIN = "50% 0px 50% 0px";
const PRIORITY_ROOT_MARGIN = "125% 0px 125% 0px";
const EAGER_ROOT_MARGIN = "600% 0px 600% 0px";

type WebGlMountLoading = "lazy" | "eager";

type WebGlMountProps = {
  children: JSX.Element;
  fallback?: JSX.Element;
  detachFromLayout?: boolean;
  loading?: WebGlMountLoading;
  priority?: boolean;
};

export function WebGlMount(props: WebGlMountProps) {
  const policy = useWebGlPolicy();

  let rootElement: HTMLDivElement | undefined;

  // Current visibility is used by the context budget for eviction.
  const [isInViewport, setIsInViewport] = createSignal(props.priority ?? false);

  // Once visible, the mount remains eligible for a context.
  const [hasBeenVisible, setHasBeenVisible] = createSignal(
    props.priority ?? false,
  );

  const [isMountReady, setIsMountReady] = createSignal(false);
  const [hasContextSlot, setHasContextSlot] = createSignal(false);
  const [contextEpoch, setContextEpoch] = createSignal(0);

  onSettled(() => {
    const element = rootElement;

    if (!element) {
      return;
    }

    const loading = props.loading ?? "lazy";
    const priority = props.priority ?? false;
    const isEager = loading === "eager";

    const rootMargin = isEager
      ? EAGER_ROOT_MARGIN
      : priority
        ? PRIORITY_ROOT_MARGIN
        : NON_PRIORITY_ROOT_MARGIN;

    const stopObservingVisibility = observeElementVisibility(
      element,
      (isIntersecting) => {
        setIsInViewport(isIntersecting);

        if (isIntersecting) {
          setHasBeenVisible(true);
        }
      },
      {
        root: null,
        rootMargin,
        threshold: 0,
      },
    );

    const handleContextLost = () => {
      setHasContextSlot(false);
      setIsMountReady(false);
      setContextEpoch((epoch) => epoch + 1);
    };

    element.addEventListener(SITE_WEBGL_CONTEXT_LOST_EVENT, handleContextLost);

    return () => {
      stopObservingVisibility();
      element.removeEventListener(
        SITE_WEBGL_CONTEXT_LOST_EVENT,
        handleContextLost,
      );
    };
  });

  const mountPriority = createMemo<VisualMountPriority>(() => {
    const priority = props.priority ?? false;
    const loading = props.loading ?? "lazy";

    return priority || loading === "eager" ? "priority" : "normal";
  });

  const wantsScene = createMemo(() => policy().allowed && hasBeenVisible());
  const wantsContextSlot = createMemo(() => wantsScene() && isMountReady());

  // A new epoch or priority re-schedules the mount from scratch, so both are
  // tracked even though only the priority is used below.
  createEffect(
    () => ({
      epoch: contextEpoch(),
      priority: mountPriority(),
      wanted: wantsScene(),
    }),
    ({ priority, wanted }) => {
      setIsMountReady(false);

      if (!wanted) {
        return;
      }

      return scheduleVisualMount(() => setIsMountReady(true), { priority });
    },
  );

  createEffect(wantsContextSlot, (wanted) => {
    if (!wanted) {
      return;
    }

    let handle: WebGlContextHandle | null = null;
    let unsubscribe: (() => void) | null = null;

    const ensureSubscribed = () => {
      if (unsubscribe !== null) {
        return;
      }

      unsubscribe = subscribeToWebGlContextCount(tryAcquire);
    };

    function tryAcquire() {
      if (handle !== null) {
        return;
      }

      const acquired = tryAcquireWebGlContextSlot(() => {
        // Retry on the next registry notification to avoid re-entering it
        // during the acquisition that evicted this mount.
        handle = null;
        setHasContextSlot(false);
        ensureSubscribed();
      });

      if (acquired === null) {
        ensureSubscribed();
        return;
      }

      handle = acquired;
      unsubscribe?.();
      unsubscribe = null;
      setHasContextSlot(true);
    }

    tryAcquire();

    // hasContextSlot is tracked so the handle is re-synced after acquisition,
    // not only when the viewport changes.
    createEffect(
      () => ({ inViewport: isInViewport(), acquired: hasContextSlot() }),
      ({ inViewport }) => {
        if (!handle) {
          return;
        }

        if (inViewport) {
          handle.markActive();
        } else {
          handle.markInactive();
        }
      },
    );

    return () => {
      unsubscribe?.();
      unsubscribe = null;

      handle?.release();
      handle = null;

      setHasContextSlot(false);
    };
  });

  return (
    <div
      ref={(element) => {
        rootElement = element;
      }}
      style={{
        height: "100%",
        "min-height": "1px",
        "pointer-events": "none",
        position: props.detachFromLayout ? "absolute" : "relative",
        width: "100%",
        ...(props.detachFromLayout ? { inset: "0" } : {}),
      }}
    >
      <Show when={hasContextSlot()} fallback={props.fallback ?? null}>
        <div
          style={{
            "pointer-events": "auto",
            height: "100%",
            width: "100%",
          }}
        >
          {props.children}
        </div>
      </Show>
    </div>
  );
}
