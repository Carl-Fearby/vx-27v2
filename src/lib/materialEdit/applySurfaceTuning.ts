import { Color3, PBRMaterial, Texture, type BaseTexture } from "@babylonjs/core";
import type { SurfaceMaterialTuning } from "@/lib/materialEdit/types";

function setTextureUv(texture: BaseTexture | null, u: number, v: number) {
  if (!(texture instanceof Texture)) {
    return;
  }
  texture.uScale = u;
  texture.vScale = v;
}

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

  if (material.bumpTexture) {
    material.bumpTexture.level = tuning.normalStrength;
  }

  setTextureUv(material.albedoTexture, tuning.uvScaleU, tuning.uvScaleV);
  setTextureUv(material.bumpTexture, tuning.uvScaleU, tuning.uvScaleV);
  setTextureUv(material.metallicTexture, tuning.uvScaleU, tuning.uvScaleV);
  setTextureUv(material.ambientTexture, tuning.uvScaleU, tuning.uvScaleV);
}

/** Floor: GE2 MeshStandardMaterial parity — albedo + normal + roughness, no IBL/AO. */
export function applyFloorSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applySurfaceTuning(material, tuning, albedoTint);

  material.clearCoat.isEnabled = false;
  material.reflectionTexture = null;
  material.ambientTexture = null;
  material.maxSimultaneousLights = 8;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.useRoughnessFromMetallicTextureGreen = true;
  material.metallic = 0;
  material.roughness = tuning.roughness;
  material.environmentIntensity = 0;
  material.directIntensity = 1;
}

/** Painted hazard stripes — GE2 surface response, sun/moon direct only. */
export function applyPillarSurfaceTuning(
  material: PBRMaterial,
  tuning: SurfaceMaterialTuning,
  albedoTint = { r: 1, g: 1, b: 1 },
) {
  applySurfaceTuning(material, tuning, albedoTint);
  material.maxSimultaneousLights = 8;
  material.reflectionTexture = null;
  material.environmentIntensity = 0;
  material.clearCoat.isEnabled = false;
  material.useMetallnessFromMetallicTextureBlue = false;
  material.useRoughnessFromMetallicTextureGreen = true;
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
