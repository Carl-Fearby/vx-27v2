import { PBRMaterial, RawTexture, Scene, Texture } from "@babylonjs/core";
import { applyWallSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";
import { DEFAULT_WALL_TUNING } from "@/lib/materialEdit/defaults";
import {
  WALL_NORMAL_STRENGTH,
  WALL_PBR_MAPS,
} from "@/lib/wall/wallAssets";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load ${url}`));
    image.src = url;
  });
}

async function loadImageData(url: string): Promise<ImageData> {
  const image = await loadImage(url);
  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(`Failed to read texture data from ${url}`);
  }
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

function configureTileable(texture: Texture) {
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = 1;
  texture.vScale = 1;
  texture.anisotropicFilteringLevel = 8;
}

function loadTileableTexture(
  url: string,
  scene: Scene,
  gammaSpace: boolean,
): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const texture = new Texture(
      url,
      scene,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      () => resolve(texture),
      (message) => reject(new Error(message ?? `Failed to load ${url}`)),
    );
    configureTileable(texture);
    texture.gammaSpace = gammaSpace;
  });
}

async function createRoughnessMetallicTexture(
  roughnessUrl: string,
  scene: Scene,
): Promise<Texture> {
  const roughness = await loadImageData(roughnessUrl);
  const { width, height } = roughness;
  const pixels = new Uint8Array(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    pixels[offset] = 0;
    pixels[offset + 1] = roughness.data[offset];
    pixels[offset + 2] = 0;
    pixels[offset + 3] = 255;
  }

  const texture = RawTexture.CreateRGBATexture(
    pixels,
    width,
    height,
    scene,
    true,
    false,
    Texture.TRILINEAR_SAMPLINGMODE,
  );
  configureTileable(texture);
  texture.gammaSpace = false;
  return texture;
}

export async function createIndustrialWallMaterial(
  scene: Scene,
): Promise<PBRMaterial> {
  const [albedo, normal, metallicRoughness] = await Promise.all([
    loadTileableTexture(WALL_PBR_MAPS.albedo, scene, true),
    loadTileableTexture(WALL_PBR_MAPS.normal, scene, false),
    createRoughnessMetallicTexture(WALL_PBR_MAPS.roughness, scene),
  ]);

  const material = new PBRMaterial("arenaWallMat", scene);
  material.maxSimultaneousLights = 8;
  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = metallicRoughness;
  material.bumpTexture.level = WALL_NORMAL_STRENGTH;
  applyWallSurfaceTuning(material, {
    ...DEFAULT_WALL_TUNING,
    normalStrength: WALL_NORMAL_STRENGTH,
  });

  return material;
}
