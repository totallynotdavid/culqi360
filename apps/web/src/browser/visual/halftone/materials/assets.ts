import { resolveImageSourceUrl } from "@crm/images";
import {
  CanvasTexture,
  ClampToEdgeWrapping,
  Color,
  type ColorSpace,
  EquirectangularReflectionMapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

import glassEnvironmentSources from "~/assets/images/halftone/glass-environment.jpg?responsive";
import { loadVisualImage } from "~/browser/visual/runtime";

import { asCanvasImageSource, getTextureImageSize, isMesh } from "./guards";

export type HalftoneMaterialAssets = {
  glassBackgroundTexture: Texture;
  glassEnvironmentTexture: Texture;
  glassTransmissionScene: Scene;
  solidEnvironmentTexture: Texture;
};

export const GLASS_TRANSMISSION_BACKGROUND = new Color(0x030303);

const GLASS_ENVIRONMENT_ZOOM = 1.55;
const MAX_TEXTURE_ANISOTROPY = 8;

function setTextureSampling(texture: Texture, renderer: WebGLRenderer) {
  texture.generateMipmaps = true;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.anisotropy = Math.min(
    renderer.capabilities.getMaxAnisotropy(),
    MAX_TEXTURE_ANISOTROPY,
  );
}

function disposeEnvironmentScene(scene: Scene) {
  scene.traverse((object) => {
    if (!isMesh(object)) {
      return;
    }

    object.geometry?.dispose();

    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose());
      return;
    }

    object.material?.dispose();
  });
}

function createZoomedGlassTexture(
  sourceTexture: Texture,
  renderer: WebGLRenderer,
  zoom: number,
) {
  if (zoom <= 1) {
    return sourceTexture;
  }

  const { width, height } = getTextureImageSize(sourceTexture.image);

  if (!width || !height) {
    return sourceTexture;
  }

  const imageSource = asCanvasImageSource(sourceTexture.image);

  if (!imageSource) {
    return sourceTexture;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    return sourceTexture;
  }

  const cropWidth = width / zoom;
  const cropHeight = height / zoom;
  const sourceX = (width - cropWidth) / 2;
  const sourceY = (height - cropHeight) / 2;

  context.drawImage(
    imageSource,
    sourceX,
    sourceY,
    cropWidth,
    cropHeight,
    0,
    0,
    width,
    height,
  );

  const zoomedTexture = new CanvasTexture(canvas);
  zoomedTexture.colorSpace = sourceTexture.colorSpace;
  zoomedTexture.wrapS = ClampToEdgeWrapping;
  zoomedTexture.wrapT = ClampToEdgeWrapping;
  setTextureSampling(zoomedTexture, renderer);
  zoomedTexture.needsUpdate = true;

  return zoomedTexture;
}

function createStudioGlassEnvironmentScene(backdropTexture?: Texture) {
  const scene = new Scene();
  scene.background = backdropTexture ?? GLASS_TRANSMISSION_BACKGROUND;
  scene.backgroundIntensity = backdropTexture ? 1 : 0.4;

  return scene;
}

function wrapImageElementAsTexture(
  image: HTMLImageElement,
  renderer: WebGLRenderer,
  colorSpace: ColorSpace,
) {
  const texture = new Texture(image);
  texture.colorSpace = colorSpace;
  texture.needsUpdate = true;
  setTextureSampling(texture, renderer);

  return texture;
}

async function loadGlassEnvironmentBackgroundTexture(renderer: WebGLRenderer) {
  const url = await resolveImageSourceUrl(glassEnvironmentSources);
  const image = await loadVisualImage(url, {
    label: "halftone glass environment",
  });

  return wrapImageElementAsTexture(image, renderer, SRGBColorSpace);
}

export async function createHalftoneMaterialAssets(
  renderer: WebGLRenderer,
): Promise<HalftoneMaterialAssets> {
  const pmremGenerator = new PMREMGenerator(renderer);

  // Warm the equirectangular shader while the background texture loads.
  const sourceBackgroundTexturePromise =
    loadGlassEnvironmentBackgroundTexture(renderer);

  pmremGenerator.compileEquirectangularShader();

  const solidEnvironmentTexture = pmremGenerator.fromScene(
    new RoomEnvironment(),
    0.04,
  ).texture;

  const sourceBackgroundTexture = await sourceBackgroundTexturePromise;
  const backgroundTexture = createZoomedGlassTexture(
    sourceBackgroundTexture,
    renderer,
    GLASS_ENVIRONMENT_ZOOM,
  );

  if (backgroundTexture !== sourceBackgroundTexture) {
    sourceBackgroundTexture.dispose();
  }

  backgroundTexture.mapping = EquirectangularReflectionMapping;
  backgroundTexture.wrapS = ClampToEdgeWrapping;
  backgroundTexture.wrapT = ClampToEdgeWrapping;
  backgroundTexture.needsUpdate = true;

  const glassTransmissionScene =
    createStudioGlassEnvironmentScene(backgroundTexture);

  const glassEnvironmentTexture =
    pmremGenerator.fromEquirectangular(backgroundTexture).texture;

  pmremGenerator.dispose();

  return {
    glassBackgroundTexture: backgroundTexture,
    glassEnvironmentTexture,
    glassTransmissionScene,
    solidEnvironmentTexture,
  };
}

export function disposeHalftoneMaterialAssets(assets: HalftoneMaterialAssets) {
  assets.glassBackgroundTexture.dispose();

  if (assets.glassEnvironmentTexture !== assets.glassBackgroundTexture) {
    assets.glassEnvironmentTexture.dispose();
  }

  disposeEnvironmentScene(assets.glassTransmissionScene);
  assets.solidEnvironmentTexture.dispose();
}
