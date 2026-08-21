import { BufferGeometry } from "three";

import type { HalftonePose, HalftoneStudioSettings } from "../state";

export type HalftoneRenderStrategy = "continuous" | "static";
export type HalftoneImageFit = "contain" | "cover";

export type HalftonePointerSettings = {
  hoverFadeIn: number;
  hoverFadeOut: number;
  pointerFollow: number;
  pointerVelocityDamping: number;
};

export type HalftoneSnapshotRequest = {
  backgroundColor?: string;
  height: number;
  includeBackground?: boolean;
  width: number;
};

export type HalftoneSnapshotFn = (
  width: number,
  height: number,
  options?: {
    backgroundColor?: string;
    includeBackground?: boolean;
  },
) => Promise<Blob | null>;

export type HalftoneRuntimeConfig = {
  geometry: BufferGeometry | null;
  imageFit: HalftoneImageFit;
  imageInteraction?: Partial<HalftonePointerSettings>;
  initialPose?: Partial<HalftonePose>;
  maxRenderPixelRatio?: number;
  onFirstInteraction: () => void;
  onPoseChange: (pose: HalftonePose) => void;
  previewDistance: number;
  renderStrategy: HalftoneRenderStrategy;
  settings: HalftoneStudioSettings;
  virtualRenderHeight: number;
};

export type HalftoneRuntime = {
  dispose: () => void;
  renderNow: () => void;
  resize: () => void;
  setActive: (active: boolean) => void;
  snapshot: (request: HalftoneSnapshotRequest) => Promise<Blob | null>;
};
