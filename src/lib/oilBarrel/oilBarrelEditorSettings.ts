import {
  DEFAULT_OIL_BARREL_FIRE_TUNING,
  normalizeOilBarrelFireTuning,
  type OilBarrelFireTuning,
} from "@/lib/oilBarrel/oilBarrelTuning";

const INTERIOR_FIRE_KEY = "vx27-oil-barrel-editor-interior-fire";
const FIRE_TUNING_KEY = "vx27-oil-barrel-editor-fire-tuning";

/** Default GE2 open-barrel preview in the object editor. */
export const DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE = true;

export type OilBarrelEditorFireTuningPatch = Partial<OilBarrelFireTuning>;

export function loadOilBarrelEditorInteriorFire(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE;
  }
  try {
    const raw = window.localStorage.getItem(INTERIOR_FIRE_KEY);
    if (raw === null) {
      return DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE;
    }
    return raw === "true";
  } catch {
    return DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE;
  }
}

export function saveOilBarrelEditorInteriorFire(enabled: boolean): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(INTERIOR_FIRE_KEY, enabled ? "true" : "false");
}

export function loadOilBarrelEditorFireTuningPatch(): OilBarrelEditorFireTuningPatch {
  if (typeof window === "undefined") {
    return {};
  }
  try {
    const raw = window.localStorage.getItem(FIRE_TUNING_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as OilBarrelEditorFireTuningPatch;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveOilBarrelEditorFireTuningPatch(
  patch: OilBarrelEditorFireTuningPatch,
): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(FIRE_TUNING_KEY, JSON.stringify(patch));
}

export function mergeOilBarrelEditorFireTuning(
  base: OilBarrelFireTuning,
  patch: OilBarrelEditorFireTuningPatch = loadOilBarrelEditorFireTuningPatch(),
): OilBarrelFireTuning {
  return normalizeOilBarrelEditorFireTuning({
    ...base,
    ...patch,
  });
}

export function normalizeOilBarrelEditorFireTuning(
  tuning: OilBarrelFireTuning,
): OilBarrelFireTuning {
  return normalizeOilBarrelFireTuning(tuning);
}

export function getDefaultOilBarrelEditorFireTuning(): OilBarrelFireTuning {
  return mergeOilBarrelEditorFireTuning(DEFAULT_OIL_BARREL_FIRE_TUNING);
}
