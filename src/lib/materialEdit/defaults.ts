import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";

export const DEFAULT_FLOOR_TUNING: SurfaceMaterialTuning = {
  uvScaleU: 10,
  uvScaleV: 10,
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

export const DEFAULT_SURFACE_TUNING: SurfaceTuningState = {
  floor: { ...DEFAULT_FLOOR_TUNING },
  pillar: { ...DEFAULT_PILLAR_TUNING },
};

export const SURFACE_LABELS: Record<EditableSurfaceId, string> = {
  floor: "Floor",
  pillar: "Pillar",
};

export function meshNameToSurfaceId(meshName: string): EditableSurfaceId | null {
  if (meshName === "platform") {
    return "floor";
  }
  if (meshName === "pillar") {
    return "pillar";
  }
  return null;
}
