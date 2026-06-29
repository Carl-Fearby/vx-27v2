const STORAGE_KEY = "vx27-oil-barrel-editor-interior-fire";

/** Default GE2 open-barrel preview in the object editor. */
export const DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE = true;

export function loadOilBarrelEditorInteriorFire(): boolean {
  if (typeof window === "undefined") {
    return DEFAULT_OIL_BARREL_EDITOR_INTERIOR_FIRE;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
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
  window.localStorage.setItem(STORAGE_KEY, enabled ? "true" : "false");
}
