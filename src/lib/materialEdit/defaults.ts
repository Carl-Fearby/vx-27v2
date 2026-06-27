import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";

export const DEFAULT_FLOOR_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 1,
  uvScaleV: 1,
  roughness: 1,
  metallic: 0,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 1.15,
  albedoBrightness: 1,
};

export const DEFAULT_PILLAR_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 4.8,
  uvScaleV: 2.7,
  roughness: 1,
  metallic: 0,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 1.15,
  albedoBrightness: 1.35,
};

export const DEFAULT_WALL_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 0.5,
  uvScaleV: 1.7,
  roughness: 1,
  metallic: 0,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 1.15,
  albedoBrightness: 1,
};

export const DEFAULT_CATWALK_DECK_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 0.5,
  uvScaleV: 0.5,
  roughness: 1,
  metallic: 0.24,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 0.63,
  albedoBrightness: 2,
};

export const DEFAULT_CATWALK_EDGE_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 0.5,
  uvScaleV: 0.5,
  roughness: 0.68,
  metallic: 0.24,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 1.1,
  albedoBrightness: 0.5,
};

export const DEFAULT_SURFACE_TUNING: SurfaceTuningState = {
  floor: { ...DEFAULT_FLOOR_TUNING },
  pillar: { ...DEFAULT_PILLAR_TUNING },
  wall: { ...DEFAULT_WALL_TUNING },
  catwalkDeck: { ...DEFAULT_CATWALK_DECK_TUNING },
  catwalkEdge: { ...DEFAULT_CATWALK_EDGE_TUNING },
};

export const SURFACE_LABELS: Record<EditableSurfaceId, string> = {
  floor: "Floor",
  pillar: "Pillar",
  wall: "Arena wall",
  catwalkDeck: "Catwalk deck",
  catwalkEdge: "Catwalk edge",
};

export function meshNameToSurfaceId(meshName: string): EditableSurfaceId | null {
  if (meshName === "platform") {
    return "floor";
  }
  if (meshName === "pillar") {
    return "pillar";
  }
  if (meshName === "wallNorth" || meshName === "wallEast" || meshName === "wallSouth") {
    return "wall";
  }
  if (meshName === "wallCornerNE" || meshName === "wallCornerSE") {
    return "wall";
  }
  if (meshName === "catwalkDeck") {
    return "catwalkDeck";
  }
  if (meshName.startsWith("catwalkRail")) {
    return "catwalkEdge";
  }
  return null;
}
