import { PBRMaterial, Scene } from "@babylonjs/core";
import {
  applyCatwalkDeckSurfaceTuning,
  applyCatwalkEdgeSurfaceTuning,
} from "@/lib/materialEdit/applySurfaceTuning";
import {
  DEFAULT_CATWALK_DECK_TUNING,
  DEFAULT_CATWALK_EDGE_TUNING,
} from "@/lib/materialEdit/defaults";
import {
  CATWALK_DECK_ALBEDO_TINT,
  CATWALK_EDGE_ALBEDO_TINT,
} from "@/lib/catwalk/catwalkAssets";

export function createCatwalkDeckMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("catwalkDeckMat", scene);
  applyCatwalkDeckSurfaceTuning(
    material,
    DEFAULT_CATWALK_DECK_TUNING,
    CATWALK_DECK_ALBEDO_TINT,
  );
  return material;
}

export function createCatwalkEdgeMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("catwalkEdgeMat", scene);
  applyCatwalkEdgeSurfaceTuning(
    material,
    DEFAULT_CATWALK_EDGE_TUNING,
    CATWALK_EDGE_ALBEDO_TINT,
  );
  return material;
}
