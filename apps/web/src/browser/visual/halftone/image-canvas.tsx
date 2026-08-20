import { createEffect, createMemo, createResource, onCleanup, onSettled } from "solid-js";
import { type JSX } from "@solidjs/web";
import { PlaneGeometry } from "three";

import { createHalftoneRuntime } from "~/browser/visual/halftone/runtime";
import type {
  HalftoneImageFit,
  HalftonePointerSettings,
  HalftoneRuntime,
  HalftoneRuntimeConfig,
  HalftoneSnapshotFn,
} from "~/browser/visual/halftone/runtime/types";
import { loadVisualImage } from "~/browser/visual/runtime";

import type { HalftonePose, HalftoneStudioSettings } from "./state";

type HalftoneImageCanvasProps = {
  crossOrigin?: HTMLImageElement["crossOrigin"];
  imageFit?: HalftoneImageFit;
  imageInteraction?: Partial<HalftonePointerSettings>;
  imageUrl: string;
  initialPose?: Partial<HalftonePose>;
  maxRenderPixelRatio?: number;
  onFirstInteraction?: () => void;
  onPoseChange?: (pose: HalftonePose) => void;
  onSnapshotReady?: (snapshot: HalftoneSnapshotFn) => void;
  previewDistance: number;
  settings: HalftoneStudioSettings;
  virtualRenderHeight?: number;
};

const noopFirstInteraction = () => {};
const noopPoseChange = (_pose: HalftonePose) => {};
const DEFAULT_VIRTUAL_RENDER_HEIGHT = 768;

export function HalftoneImageCanvas(
  props: HalftoneImageCanvasProps,
): JSX.Element {
  const [imageElement] = createResource(
    () => ({
      crossOrigin: props.crossOrigin,
      imageUrl: props.imageUrl,
    }),
    ({ crossOrigin, imageUrl }) =>
      loadVisualImage(imageUrl, {
        crossOrigin,
        label: "halftone image",
      }),
  );

  if (import.meta.env.DEV) {
    createEffect(() => {
      if (imageElement.error) {
        console.error(imageElement.error);
      }
    });
  }

  const geometry = new PlaneGeometry(1, 1);

  onCleanup(() => {
    geometry.dispose();
  });

  const runtimeConfig = createMemo<HalftoneRuntimeConfig>(() => ({
    geometry,
    imageFit: props.imageFit ?? "contain",
    imageInteraction: props.imageInteraction,
    initialPose: props.initialPose,
    maxRenderPixelRatio: props.maxRenderPixelRatio,
    onFirstInteraction: props.onFirstInteraction ?? noopFirstInteraction,
    onPoseChange: props.onPoseChange ?? noopPoseChange,
    previewDistance: props.previewDistance,
    renderStrategy: "continuous",
    settings: props.settings,
    virtualRenderHeight:
      props.virtualRenderHeight ?? DEFAULT_VIRTUAL_RENDER_HEIGHT,
  }));

  let mountRef: HTMLDivElement | undefined;
  let runtime: HalftoneRuntime | null = null;

  onSettled(() => {
    const host = mountRef;

    if (!host) {
      return;
    }

    let cancelled = false;

    void (async () => {
      const createdRuntime = await createHalftoneRuntime({
        host,
        getConfig: () => runtimeConfig(),
        getImageElement: () => imageElement.latest ?? null,
      });

      if (cancelled) {
        createdRuntime.dispose();
        return;
      }

      runtime = createdRuntime;

      if (props.onSnapshotReady) {
        props.onSnapshotReady((width, height, options) =>
          createdRuntime.snapshot({
            backgroundColor: options?.backgroundColor,
            height,
            includeBackground: options?.includeBackground,
            width,
          }),
        );
      }
    })();

    return () => {
      cancelled = true;
      runtime?.dispose();
      runtime = null;
    };
  });

  return (
    <div
      aria-hidden
      ref={(el) => {
        mountRef = el;
      }}
      style={{
        background: props.settings.background.transparent
          ? "transparent"
          : props.settings.background.color,
        display: "block",
        height: "100%",
        "min-width": 0,
        width: "100%",
      }}
    />
  );
}
