import { PBRMaterial, Scene } from "@babylonjs/core";
import { applyWallSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";
import { DEFAULT_WALL_TUNING } from "@/lib/materialEdit/defaults";
import { WALL_ALBEDO_TINT } from "@/lib/wall/wallAssets";

export function createIndustrialWallMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("arenaWallMat", scene);
  applyWallSurfaceTuning(material, DEFAULT_WALL_TUNING, WALL_ALBEDO_TINT);
  return material;
}
