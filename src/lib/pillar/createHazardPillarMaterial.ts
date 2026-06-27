import { PBRMaterial, Scene } from "@babylonjs/core";
import { DEFAULT_PILLAR_TUNING } from "@/lib/materialEdit/defaults";
import { applyPillarSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";
import { PILLAR_ALBEDO_TINT } from "@/lib/pillar/pillarAssets";

export function createHazardPillarMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("pillarMat", scene);
  applyPillarSurfaceTuning(material, DEFAULT_PILLAR_TUNING, PILLAR_ALBEDO_TINT);
  return material;
}
