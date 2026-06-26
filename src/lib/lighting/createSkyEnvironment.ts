import { BaseTexture, Constants, Scene, Texture } from "@babylonjs/core";
import {
  blendCubemapFaces,
  buildSkyMatchedCubemapFaces,
  loadEquirectImageData,
} from "@/lib/lighting/buildSkyMatchedCubemap";
import {
  NIGHT_SKY_LAT_OFFSET,
  SKY_DAY_URL,
  SKY_NIGHT_URL,
} from "@/lib/lighting/tuning";

function skyUrl(base: string): string {
  return base.includes("?") ? base : `${base}?v=seamless-v33-4k-webp`;
}

/**
 * Cubemap IBL texture sampled with the same equirect mapping as vxSkyDome.
 */
export class SkyMatchedCubeTexture extends BaseTexture {
  constructor(name: string, scene: Scene) {
    super(scene);
    this.name = name;
    this._coordinatesMode = Texture.CUBIC_MODE;
    this.gammaSpace = false;
    this.hasAlpha = false;
    this.isCube = true;
  }
}

export type SkyEnvironmentController = {
  texture: SkyMatchedCubeTexture;
  setSkyBlend: (nightBlend: number) => void;
  dispose: () => void;
};

const BLEND_UPDATE_EPSILON = 0.012;

function uploadCubemapFaces(
  scene: Scene,
  texture: SkyMatchedCubeTexture,
  faces: Float32Array[],
  size: number,
): void {
  const engine = scene.getEngine();
  const textureType = engine.getCaps().textureFloat
    ? Constants.TEXTURETYPE_FLOAT
    : Constants.TEXTURETYPE_UNSIGNED_BYTE;

  if (!texture._texture) {
    const internalTexture = engine.createRawCubeTexture(
      faces,
      size,
      Constants.TEXTUREFORMAT_RGB,
      textureType,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      null,
    );
    internalTexture.generateMipMaps = true;
    internalTexture.isReady = true;
    engine._internalTexturesCache.push(internalTexture);
    texture._texture = internalTexture;
    return;
  }

  engine.updateRawCubeTexture(
    texture._texture,
    faces,
    texture._texture.format,
    texture._texture.type,
    texture._texture.invertY,
  );
}

/**
 * Builds a day/night-blended environment cubemap that matches the visible sky dome.
 */
export async function createSkyEnvironmentController(
  scene: Scene,
  size: number,
): Promise<SkyEnvironmentController> {
  const [dayImage, nightImage] = await Promise.all([
    loadEquirectImageData(skyUrl(SKY_DAY_URL)),
    loadEquirectImageData(skyUrl(SKY_NIGHT_URL)),
  ]);

  const dayFaces = buildSkyMatchedCubemapFaces(dayImage, size);
  const nightFaces = buildSkyMatchedCubemapFaces(nightImage, size, {
    nightLatOffset: NIGHT_SKY_LAT_OFFSET,
    softenNightStars: true,
  });

  const texture = new SkyMatchedCubeTexture("skyEnvironment", scene);
  let lastBlend = Number.NaN;

  const setSkyBlend = (nightBlend: number) => {
    const clamped = Math.max(0, Math.min(1, nightBlend));
    // Hold full day cubemap until the sky dome is visibly fading to night.
    const environmentBlend = clamped < 0.04 ? 0 : clamped;
    if (
      Number.isFinite(lastBlend) &&
      Math.abs(environmentBlend - lastBlend) < BLEND_UPDATE_EPSILON
    ) {
      return;
    }
    lastBlend = environmentBlend;
    const faces = blendCubemapFaces(dayFaces, nightFaces, environmentBlend);
    uploadCubemapFaces(scene, texture, faces, size);
    scene.markAllMaterialsAsDirty(1);
  };

  setSkyBlend(0);

  return {
    texture,
    setSkyBlend,
    dispose() {
      texture.dispose();
    },
  };
}

/** @deprecated Use createSkyEnvironmentController for day/night sync. */
export async function createSkyEnvironment(
  scene: Scene,
  size: number,
): Promise<SkyMatchedCubeTexture> {
  const controller = await createSkyEnvironmentController(scene, size);
  return controller.texture;
}
