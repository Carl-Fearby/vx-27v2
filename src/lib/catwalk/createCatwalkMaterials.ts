import { PBRMaterial, RawTexture, Scene, Texture } from "@babylonjs/core";
import {
  applyCatwalkDeckSurfaceTuning,
  applyCatwalkEdgeSurfaceTuning,
} from "@/lib/materialEdit/applySurfaceTuning";
import {
  DEFAULT_CATWALK_DECK_TUNING,
  DEFAULT_CATWALK_EDGE_TUNING,
} from "@/lib/materialEdit/defaults";
import {
  CATWALK_DECK_PBR_MAPS,
  CATWALK_EDGE_PBR_MAPS,
  CATWALK_NORMAL_STRENGTH,
} from "@/lib/catwalk/catwalkAssets";

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

async function createCatwalkPbrMaterial(
  scene: Scene,
  name: string,
  maps: { albedo: string; normal: string; roughness: string },
  applyTuning: (material: PBRMaterial) => void,
): Promise<PBRMaterial> {
  const [albedo, normal, metallicRoughness] = await Promise.all([
    loadTileableTexture(maps.albedo, scene, true),
    loadTileableTexture(maps.normal, scene, false),
    createRoughnessMetallicTexture(maps.roughness, scene),
  ]);

  const material = new PBRMaterial(name, scene);
  material.maxSimultaneousLights = 8;
  material.albedoTexture = albedo;
  material.bumpTexture = normal;
  material.metallicTexture = metallicRoughness;
  material.bumpTexture.level = CATWALK_NORMAL_STRENGTH;
  applyTuning(material);
  return material;
}

export async function createCatwalkDeckMaterial(scene: Scene): Promise<PBRMaterial> {
  return createCatwalkPbrMaterial(
    scene,
    "catwalkDeckMat",
    CATWALK_DECK_PBR_MAPS,
    (material) =>
      applyCatwalkDeckSurfaceTuning(material, {
        ...DEFAULT_CATWALK_DECK_TUNING,
        normalStrength: CATWALK_NORMAL_STRENGTH,
      }),
  );
}

export async function createCatwalkEdgeMaterial(scene: Scene): Promise<PBRMaterial> {
  return createCatwalkPbrMaterial(
    scene,
    "catwalkEdgeMat",
    CATWALK_EDGE_PBR_MAPS,
    (material) =>
      applyCatwalkEdgeSurfaceTuning(material, {
        ...DEFAULT_CATWALK_EDGE_TUNING,
        normalStrength: CATWALK_NORMAL_STRENGTH,
      }),
  );
}
