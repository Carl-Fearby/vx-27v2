import { DEFAULT_SURFACE_TUNING } from "@/lib/materialEdit/defaults";
import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitizeTuning(
  value: Partial<SurfaceMaterialTuning> | undefined,
  fallback: SurfaceMaterialTuning,
): SurfaceMaterialTuning {
  return {
    uvScaleU: clamp(
      typeof value?.uvScaleU === "number" ? value.uvScaleU : fallback.uvScaleU,
      0.5,
      80,
    ),
    uvScaleV: clamp(
      typeof value?.uvScaleV === "number" ? value.uvScaleV : fallback.uvScaleV,
      0.5,
      80,
    ),
    roughness: clamp(
      typeof value?.roughness === "number" ? value.roughness : fallback.roughness,
      0,
      1,
    ),
    metallic: clamp(
      typeof value?.metallic === "number" ? value.metallic : fallback.metallic,
      0,
      1,
    ),
    shininess: clamp(
      typeof value?.shininess === "number" ? value.shininess : fallback.shininess,
      0,
      1,
    ),
    clearCoatRoughness: clamp(
      typeof value?.clearCoatRoughness === "number"
        ? value.clearCoatRoughness
        : fallback.clearCoatRoughness,
      0,
      1,
    ),
    specularIntensity: clamp(
      typeof value?.specularIntensity === "number"
        ? value.specularIntensity
        : fallback.specularIntensity,
      0,
      5,
    ),
    environmentIntensity: clamp(
      typeof value?.environmentIntensity === "number"
        ? value.environmentIntensity
        : fallback.environmentIntensity,
      0,
      4,
    ),
    normalStrength: clamp(
      typeof value?.normalStrength === "number"
        ? value.normalStrength
        : fallback.normalStrength,
      0,
      2,
    ),
    albedoBrightness: clamp(
      typeof value?.albedoBrightness === "number"
        ? value.albedoBrightness
        : fallback.albedoBrightness,
      0.5,
      2,
    ),
  };
}

let sessionSurfaceTuning: SurfaceTuningState = {
  floor: { ...DEFAULT_SURFACE_TUNING.floor },
  pillar: { ...DEFAULT_SURFACE_TUNING.pillar },
};

/** Bumps when defaults change — clears stale in-memory edit-session values on hot reload. */
const TUNING_SCHEMA_VERSION = 11;
let loadedTuningVersion = 0;

function ensureTuningSchema() {
  if (loadedTuningVersion === TUNING_SCHEMA_VERSION) {
    return;
  }
  sessionSurfaceTuning = {
    floor: { ...DEFAULT_SURFACE_TUNING.floor },
    pillar: { ...DEFAULT_SURFACE_TUNING.pillar },
  };
  loadedTuningVersion = TUNING_SCHEMA_VERSION;
}

export function loadSurfaceTuning(): SurfaceTuningState {
  ensureTuningSchema();
  return {
    floor: { ...sessionSurfaceTuning.floor },
    pillar: { ...sessionSurfaceTuning.pillar },
  };
}

export function saveSurfaceTuning(state: SurfaceTuningState): SurfaceTuningState {
  ensureTuningSchema();
  sessionSurfaceTuning = {
    floor: sanitizeTuning(state.floor, DEFAULT_SURFACE_TUNING.floor),
    pillar: sanitizeTuning(state.pillar, DEFAULT_SURFACE_TUNING.pillar),
  };
  return loadSurfaceTuning();
}

ensureTuningSchema();
