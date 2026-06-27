import { PBRMaterial, Scene } from "@babylonjs/core";
import { FLOOR_ALBEDO_TINT } from "@/lib/floor/floorAssets";
import { DEFAULT_FLOOR_TUNING } from "@/lib/materialEdit/defaults";
import { applyFloorSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";

export function createTileableFloorMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("floorMat", scene);
  applyFloorSurfaceTuning(material, DEFAULT_FLOOR_TUNING, FLOOR_ALBEDO_TINT);
  return material;
}
