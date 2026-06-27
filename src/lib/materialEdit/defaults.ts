import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";

/** Shared plain-PBR defaults for every editable surface. */
export const BASE_SURFACE_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 1,
  uvScaleV: 1,
  roughness: 1,
  metallic: 0,
  shininess: 0,
  clearCoatRoughness: 0.44,
  specularIntensity: 1,
  environmentIntensity: 0,
  normalStrength: 1,
  albedoBrightness: 1,
};

export const DEFAULT_FLOOR_TUNING: SurfaceMaterialTuning = {
  ...BASE_SURFACE_TUNING,
};

export const DEFAULT_PILLAR_TUNING: SurfaceMaterialTuning = {
  ...BASE_SURFACE_TUNING,
};

export const DEFAULT_WALL_TUNING: SurfaceMaterialTuning = {
  ...BASE_SURFACE_TUNING,
};

export const DEFAULT_CATWALK_DECK_TUNING: SurfaceMaterialTuning = {
  ...BASE_SURFACE_TUNING,
};

export const DEFAULT_CATWALK_EDGE_TUNING: SurfaceMaterialTuning = {
  ...BASE_SURFACE_TUNING,
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
