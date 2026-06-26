import { PBRMaterial, RawTexture, Scene, Texture } from "@babylonjs/core";
import { DEFAULT_PILLAR_TUNING } from "@/lib/materialEdit/defaults";
import { applyPillarSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";
import {
  PILLAR_PBR_MAPS,
  PILLAR_UV_U,
  PILLAR_UV_V,
} from "@/lib/pillar/pillarAssets";

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

function configurePillarTexture(texture: Texture) {
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.uScale = PILLAR_UV_U;
  texture.vScale = PILLAR_UV_V;
  texture.anisotropicFilteringLevel = 8;
}

function loadPillarTexture(
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
    configurePillarTexture(texture);
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
  configurePillarTexture(texture);
  texture.gammaSpace = false;
  return texture;
}

export async function createHazardPillarMaterial(
  scene: Scene,
): Promise<PBRMaterial> {
  const [albedo, normal, metallicRoughness] = await Promise.all([
    loadPillarTexture(PILLAR_PBR_MAPS.albedo, scene, true),
    loadPillarTexture(PILLAR_PBR_MAPS.normal, scene, false),
    createRoughnessMetallicTexture(PILLAR_PBR_MAPS.roughness, scene),
  ]);

  const material = new PBRMaterial("pillarMat", scene);
  material.maxSimultaneousLights = 8;
  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = metallicRoughness;
  applyPillarSurfaceTuning(material, DEFAULT_PILLAR_TUNING);

  return material;
}
