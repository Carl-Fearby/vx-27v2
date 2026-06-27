import { Color3, PBRMaterial } from "@babylonjs/core";
import type { SurfaceMaterialTuning } from "@/lib/materialEdit/types";

export function applySurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  material.roughness = tuning.roughness;
  material.metallic = tuning.metallic;
  material.specularIntensity = tuning.specularIntensity;
  material.environmentIntensity = tuning.environmentIntensity;
  material.directIntensity = 1;

  material.clearCoat.isEnabled = tuning.shininess > 0.01;
  material.clearCoat.intensity = tuning.shininess;
  material.clearCoat.roughness = tuning.clearCoatRoughness;
  material.clearCoat.indexOfRefraction = 1.5;

  material.albedoColor = new Color3(
    tuning.albedoBrightness * albedoTint.r,
    tuning.albedoBrightness * albedoTint.g,
    tuning.albedoBrightness * albedoTint.b,
  );
}

/** Floor: plain PBR — albedo + roughness, no IBL/AO. */
export function applyFloorSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applySurfaceTuning(material, tuning, albedoTint);

  material.clearCoat.isEnabled = false;
  material.reflectionTexture = null;
  material.ambientTexture = null;
  material.albedoTexture = null;
  material.bumpTexture = null;
  material.metallicTexture = null;
  material.maxSimultaneousLights = 8;
  material.metallic = 0;
  material.roughness = tuning.roughness;
  material.environmentIntensity = 0;
  material.directIntensity = 1;
  material.backFaceCulling = false;
  if (material.metadata && "dryAlbedo" in material.metadata) {
    delete (material.metadata as { dryAlbedo?: unknown }).dryAlbedo;
  }
}

/** Arena perimeter walls — sun/moon shadows and directional response on both faces. */
export function applyWallSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applyFloorSurfaceTuning(material, tuning, albedoTint);
  material.twoSidedLighting = true;
}

/** Catwalk deck — double-sided for underside ceiling view. */
export function applyCatwalkDeckSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applyFloorSurfaceTuning(material, tuning, albedoTint);
  material.twoSidedLighting = true;
  material.metallic = tuning.metallic;
  material.roughness = tuning.roughness;
}

/** Catwalk parapet rails. */
export function applyCatwalkEdgeSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applySurfaceTuning(material, tuning, albedoTint);
  material.maxSimultaneousLights = 8;
  material.reflectionTexture = null;
  material.ambientTexture = null;
  material.albedoTexture = null;
  material.bumpTexture = null;
  material.metallicTexture = null;
  material.environmentIntensity = 0;
  material.clearCoat.isEnabled = false;
  material.metallic = tuning.metallic;
  material.roughness = tuning.roughness;
  material.directIntensity = 1;
  material.twoSidedLighting = true;
  material.backFaceCulling = false;
}

/** Pillar — plain PBR, sun/moon direct only. */
export function applyPillarSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applySurfaceTuning(material, tuning, albedoTint);
  material.maxSimultaneousLights = 8;
  material.reflectionTexture = null;
  material.albedoTexture = null;
  material.bumpTexture = null;
  material.metallicTexture = null;
  material.environmentIntensity = 0;
  material.clearCoat.isEnabled = false;
  material.metallic = 0;
  material.roughness = 1;
  material.specularIntensity = 1;
  material.directIntensity = 1;
}

export function formatSurfaceTuningJson(
  surfaceId: string,
  tuning: SurfaceMaterialTuning,
): string {
  return JSON.stringify({ surface: surfaceId, ...tuning }, null, 2);
}
