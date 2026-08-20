import { resolveImageSourceUrl } from "@crm/images";
import { createMemo, Loading } from "solid-js";

import { HalftoneImageCanvas } from "~/browser/visual/halftone/image-canvas";
import { WebGlMount } from "~/browser/visual/runtime";

import { UpdatesHeroVisualPlaceholder } from "./hero-visual-fallback";
import {
  MILESTONE_IMAGE_FIT,
  MILESTONE_IMAGE_SOURCES,
  MILESTONE_INITIAL_POSE,
  MILESTONE_PREVIEW_DISTANCE,
  buildMilestoneSettings,
} from "./milestone-config";

import styles from "./styles/layout.module.css";

const HERO_VISUAL_RENDER_HEIGHT = 460;
const HERO_VISUAL_MAX_PIXEL_RATIO = 1.5;

const HERO_VISUAL_SETTINGS = buildMilestoneSettings({
  animation: {
    hoverLightEnabled: true,
    hoverLightIntensity: 1.2,
    hoverLightRadius: 0.45,
  },
  background: {
    color: "#777777",
    transparent: false,
  },
  halftone: {
    dashColor: "#F3F3F3",
    hoverDashColor: "#F3F3F3",
    imageContrast: 1,
    power: -0.07,
    scale: 17.8,
    toneTarget: "light",
    width: 0.46,
  },
});

export default function UpdatesHeroVisual() {
  const imageUrl = createMemo(() =>
    resolveImageSourceUrl(MILESTONE_IMAGE_SOURCES),
  );

  return (
    <div aria-hidden="true" class={styles.heroVisual}>
      <WebGlMount fallback={<UpdatesHeroVisualPlaceholder />} priority>
        <Loading fallback={<UpdatesHeroVisualPlaceholder />}>
          <HalftoneImageCanvas
            imageFit={MILESTONE_IMAGE_FIT}
            imageUrl={imageUrl()}
            initialPose={MILESTONE_INITIAL_POSE}
            maxRenderPixelRatio={HERO_VISUAL_MAX_PIXEL_RATIO}
            previewDistance={MILESTONE_PREVIEW_DISTANCE}
            settings={HERO_VISUAL_SETTINGS}
            virtualRenderHeight={HERO_VISUAL_RENDER_HEIGHT}
          />
        </Loading>
      </WebGlMount>
    </div>
  );
}
