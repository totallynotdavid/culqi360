export type HalftoneSourceMode = "shape" | "image";
export type HalftoneMaterialSurface = "solid" | "glass";
export type HalftoneToneTarget = "light" | "dark";
export type HalftoneRotateAxis =
  | "x"
  | "y"
  | "z"
  | "xy"
  | "-x"
  | "-y"
  | "-z"
  | "-xy";
export type HalftoneRotatePreset = "axis" | "lissajous" | "orbit" | "tumble";

export interface HalftoneLightingSettings {
  intensity: number;
  fillIntensity: number;
  ambientIntensity: number;
  angleDegrees: number;
  height: number;
}

export interface HalftoneMaterialSettings {
  surface: HalftoneMaterialSurface;
  color: string;
  roughness: number;
  metalness: number;
  thickness: number;
  refraction: number;
  environmentPower: number;
}

export interface HalftonePatternSettings {
  enabled: boolean;
  scale: number;
  power: number;
  toneTarget: HalftoneToneTarget;
  width: number;
  imageContrast: number;
  dashColor: string;
  hoverDashColor: string;
}

export interface HalftoneBackgroundSettings {
  transparent: boolean;
  color: string;
}

export interface HalftoneAnimationSettings {
  autoRotateEnabled: boolean;
  breatheEnabled: boolean;
  cameraParallaxEnabled: boolean;
  followHoverEnabled: boolean;
  followDragEnabled: boolean;
  floatEnabled: boolean;
  hoverHalftoneEnabled: boolean;
  hoverLightEnabled: boolean;
  dragFlowEnabled: boolean;
  lightSweepEnabled: boolean;
  rotateEnabled: boolean;
  autoSpeed: number;
  autoWobble: number;
  breatheAmount: number;
  breatheSpeed: number;
  cameraParallaxAmount: number;
  cameraParallaxEase: number;
  driftAmount: number;
  hoverRange: number;
  hoverEase: number;
  hoverReturn: boolean;
  dragSens: number;
  dragFriction: number;
  dragMomentum: boolean;
  rotateAxis: HalftoneRotateAxis;
  rotatePreset: HalftoneRotatePreset;
  rotateSpeed: number;
  rotatePingPong: boolean;
  floatAmplitude: number;
  floatSpeed: number;
  lightSweepHeightRange: number;
  lightSweepRange: number;
  lightSweepSpeed: number;
  springDamping: number;
  springReturnEnabled: boolean;
  springStrength: number;
  hoverHalftonePowerShift: number;
  hoverHalftoneRadius: number;
  hoverHalftoneWidthShift: number;
  hoverLightIntensity: number;
  hoverLightRadius: number;
  dragFlowDecay: number;
  dragFlowRadius: number;
  dragFlowStrength: number;
  hoverWarpStrength: number;
  hoverWarpRadius: number;
  dragWarpStrength: number;
  waveEnabled: boolean;
  waveSpeed: number;
  waveAmount: number;
}

export interface HalftoneStudioSettings {
  sourceMode: HalftoneSourceMode;
  shapeKey: string;
  lighting: HalftoneLightingSettings;
  material: HalftoneMaterialSettings;
  halftone: HalftonePatternSettings;
  background: HalftoneBackgroundSettings;
  animation: HalftoneAnimationSettings;
}

export type HalftoneStudioSettingsOverrides = Partial<
  Omit<
    HalftoneStudioSettings,
    "lighting" | "material" | "halftone" | "background" | "animation"
  >
> & {
  lighting?: Partial<HalftoneLightingSettings>;
  material?: Partial<HalftoneMaterialSettings>;
  halftone?: Partial<HalftonePatternSettings>;
  background?: Partial<HalftoneBackgroundSettings>;
  animation?: Partial<HalftoneAnimationSettings>;
};

export interface HalftonePose {
  autoElapsed: number;
  rotateElapsed: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  targetRotationX: number;
  targetRotationY: number;
  timeElapsed: number;
}

const DEFAULT_SHAPE_HALFTONE_SETTINGS: HalftonePatternSettings = {
  enabled: true,
  scale: 24.72,
  power: -0.07,
  toneTarget: "light",
  width: 0.46,
  imageContrast: 1,
  dashColor: "#4A38F5",
  hoverDashColor: "#4A38F5",
};

const DEFAULT_IMAGE_HALFTONE_SETTINGS: HalftonePatternSettings = {
  enabled: true,
  scale: 24.72,
  power: -0.07,
  toneTarget: "light",
  width: 0.46,
  imageContrast: 1,
  dashColor: "#4A38F5",
  hoverDashColor: "#4A38F5",
};

const DEFAULT_SOLID_MATERIAL_SETTINGS: HalftoneMaterialSettings = {
  surface: "solid",
  color: "#d4d0c8",
  roughness: 0.42,
  metalness: 0.16,
  thickness: 150,
  refraction: 2,
  environmentPower: 5,
};

const DEFAULT_GLASS_MATERIAL_SETTINGS: HalftoneMaterialSettings = {
  surface: "glass",
  color: "#7d7d7d",
  roughness: 0,
  metalness: 0,
  thickness: 15.58,
  refraction: 2,
  environmentPower: 5,
};

const DEFAULT_SOLID_LIGHTING_SETTINGS: HalftoneLightingSettings = {
  intensity: 1.5,
  fillIntensity: 0.15,
  ambientIntensity: 0.08,
  angleDegrees: 45,
  height: 2,
};

const DEFAULT_GLASS_LIGHTING_SETTINGS: HalftoneLightingSettings = {
  intensity: 3,
  fillIntensity: 0,
  ambientIntensity: 0.3,
  angleDegrees: 53,
  height: 2,
};

const DEFAULT_SOLID_BACKGROUND_SETTINGS: HalftoneBackgroundSettings = {
  transparent: true,
  color: "#000000",
};

const DEFAULT_GLASS_BACKGROUND_SETTINGS: HalftoneBackgroundSettings = {
  transparent: true,
  color: "#000000",
};

function getDefaultLightingSettings(
  surface: HalftoneMaterialSurface,
): HalftoneLightingSettings {
  return surface === "glass"
    ? DEFAULT_GLASS_LIGHTING_SETTINGS
    : DEFAULT_SOLID_LIGHTING_SETTINGS;
}

function getDefaultBackgroundSettings(
  surface: HalftoneMaterialSurface,
): HalftoneBackgroundSettings {
  return surface === "glass"
    ? DEFAULT_GLASS_BACKGROUND_SETTINGS
    : DEFAULT_SOLID_BACKGROUND_SETTINGS;
}

const DEFAULT_SOLID_ANIMATION_SETTINGS: HalftoneAnimationSettings = {
  autoRotateEnabled: true,
  breatheEnabled: false,
  cameraParallaxEnabled: false,
  followHoverEnabled: false,
  followDragEnabled: false,
  floatEnabled: false,
  hoverHalftoneEnabled: false,
  hoverLightEnabled: false,
  dragFlowEnabled: false,
  lightSweepEnabled: false,
  rotateEnabled: false,
  autoSpeed: 0.2,
  autoWobble: 0.3,
  breatheAmount: 0.04,
  breatheSpeed: 0.8,
  cameraParallaxAmount: 0.3,
  cameraParallaxEase: 0.08,
  driftAmount: 8,
  hoverRange: 25,
  hoverEase: 0.08,
  hoverReturn: true,
  dragSens: 0.008,
  dragFriction: 0.08,
  dragMomentum: true,
  rotateAxis: "y",
  rotatePreset: "axis",
  rotateSpeed: 0.2,
  rotatePingPong: false,
  floatAmplitude: 0.16,
  floatSpeed: 0.8,
  lightSweepHeightRange: 0.5,
  lightSweepRange: 28,
  lightSweepSpeed: 0.7,
  springDamping: 0.72,
  springReturnEnabled: false,
  springStrength: 0.18,
  hoverHalftonePowerShift: 0.42,
  hoverHalftoneRadius: 0.2,
  hoverHalftoneWidthShift: -0.18,
  hoverLightIntensity: 0.8,
  hoverLightRadius: 0.2,
  dragFlowDecay: 0.08,
  dragFlowRadius: 0.24,
  dragFlowStrength: 1.8,
  hoverWarpStrength: 3,
  hoverWarpRadius: 0.15,
  dragWarpStrength: 5,
  waveEnabled: false,
  waveSpeed: 1,
  waveAmount: 2,
};

const DEFAULT_GLASS_ANIMATION_SETTINGS: HalftoneAnimationSettings = {
  autoRotateEnabled: true,
  breatheEnabled: false,
  cameraParallaxEnabled: false,
  followHoverEnabled: false,
  followDragEnabled: true,
  floatEnabled: false,
  hoverHalftoneEnabled: false,
  hoverLightEnabled: false,
  dragFlowEnabled: false,
  lightSweepEnabled: false,
  rotateEnabled: false,
  autoSpeed: 0.15,
  autoWobble: 0.3,
  breatheAmount: 0.04,
  breatheSpeed: 0.8,
  cameraParallaxAmount: 0.3,
  cameraParallaxEase: 0.08,
  driftAmount: 8,
  hoverRange: 25,
  hoverEase: 0.08,
  hoverReturn: true,
  dragSens: 0.008,
  dragFriction: 0.08,
  dragMomentum: true,
  rotateAxis: "y",
  rotatePreset: "axis",
  rotateSpeed: 0.1,
  rotatePingPong: false,
  floatAmplitude: 0.16,
  floatSpeed: 0.8,
  lightSweepHeightRange: 0.5,
  lightSweepRange: 28,
  lightSweepSpeed: 0.7,
  springDamping: 0.72,
  springReturnEnabled: false,
  springStrength: 0.18,
  hoverHalftonePowerShift: 0.42,
  hoverHalftoneRadius: 0.2,
  hoverHalftoneWidthShift: -0.18,
  hoverLightIntensity: 0.8,
  hoverLightRadius: 0.2,
  dragFlowDecay: 0.08,
  dragFlowRadius: 0.24,
  dragFlowStrength: 1.8,
  hoverWarpStrength: 3,
  hoverWarpRadius: 0.15,
  dragWarpStrength: 5,
  waveEnabled: false,
  waveSpeed: 1,
  waveAmount: 2,
};

function getDefaultAnimationSettings(
  surface: HalftoneMaterialSurface,
): HalftoneAnimationSettings {
  return surface === "glass"
    ? DEFAULT_GLASS_ANIMATION_SETTINGS
    : DEFAULT_SOLID_ANIMATION_SETTINGS;
}

function getDefaultHalftoneSettings(sourceMode: HalftoneSourceMode) {
  return sourceMode === "image"
    ? DEFAULT_IMAGE_HALFTONE_SETTINGS
    : DEFAULT_SHAPE_HALFTONE_SETTINGS;
}

function normalizeHalftonePatternSettings(
  defaults: HalftonePatternSettings,
  settings?: Partial<HalftonePatternSettings>,
): HalftonePatternSettings {
  return {
    enabled: settings?.enabled ?? defaults.enabled,
    scale: settings?.scale ?? defaults.scale,
    power: settings?.power ?? defaults.power,
    toneTarget: settings?.toneTarget ?? defaults.toneTarget,
    width: settings?.width ?? defaults.width,
    imageContrast: settings?.imageContrast ?? defaults.imageContrast,
    dashColor: settings?.dashColor ?? defaults.dashColor,
    hoverDashColor: settings?.hoverDashColor ?? defaults.hoverDashColor,
  };
}

function normalizeMaterialSettings(
  settings?: Partial<HalftoneMaterialSettings>,
): HalftoneMaterialSettings {
  const surface = settings?.surface === "glass" ? "glass" : "solid";
  const defaults =
    surface === "glass"
      ? DEFAULT_GLASS_MATERIAL_SETTINGS
      : DEFAULT_SOLID_MATERIAL_SETTINGS;

  return {
    surface,
    color:
      typeof settings?.color === "string" ? settings.color : defaults.color,
    roughness:
      typeof settings?.roughness === "number"
        ? settings.roughness
        : defaults.roughness,
    metalness:
      typeof settings?.metalness === "number"
        ? settings.metalness
        : defaults.metalness,
    thickness:
      typeof settings?.thickness === "number"
        ? settings.thickness
        : defaults.thickness,
    refraction:
      typeof settings?.refraction === "number"
        ? settings.refraction
        : defaults.refraction,
    environmentPower:
      typeof settings?.environmentPower === "number"
        ? settings.environmentPower
        : defaults.environmentPower,
  };
}

const DEFAULT_HALFTONE_SETTINGS: HalftoneStudioSettings = {
  sourceMode: "shape",
  shapeKey: "torusKnot",
  lighting: { ...DEFAULT_SOLID_LIGHTING_SETTINGS },
  material: {
    ...DEFAULT_SOLID_MATERIAL_SETTINGS,
  },
  halftone: DEFAULT_SHAPE_HALFTONE_SETTINGS,
  background: { ...DEFAULT_SOLID_BACKGROUND_SETTINGS },
  animation: { ...DEFAULT_SOLID_ANIMATION_SETTINGS },
};

export function normalizeHalftoneStudioSettings(
  settings?: HalftoneStudioSettingsOverrides,
): HalftoneStudioSettings {
  const sourceMode =
    settings?.sourceMode ?? DEFAULT_HALFTONE_SETTINGS.sourceMode;
  const material = normalizeMaterialSettings(settings?.material);
  const lightingDefaults = getDefaultLightingSettings(material.surface);
  const backgroundDefaults = getDefaultBackgroundSettings(material.surface);
  const animationDefaults = getDefaultAnimationSettings(material.surface);

  return {
    ...DEFAULT_HALFTONE_SETTINGS,
    ...settings,
    sourceMode,
    lighting: {
      ...lightingDefaults,
      ...settings?.lighting,
    },
    material,
    halftone: normalizeHalftonePatternSettings(
      getDefaultHalftoneSettings(sourceMode),
      settings?.halftone,
    ),
    background: {
      ...backgroundDefaults,
      ...settings?.background,
    },
    animation: {
      ...animationDefaults,
      ...settings?.animation,
    },
  };
}
