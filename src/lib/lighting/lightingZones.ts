/** Mirrors GameEngine2 `LightingZones.js`. */

export type ViewmodelLightingZone = "outdoor" | "room" | "container";

export const VIEWMODEL_AMBIENT_ROOM = Object.freeze({
  color: 0xffcc99,
  intensity: 0.04,
});

export const VIEWMODEL_AMBIENT_CONTAINER = Object.freeze({
  color: 0x8eb8ff,
  intensity: 0.025,
});

export function isEnclosedViewmodelZone(zone: ViewmodelLightingZone): boolean {
  return zone === "room" || zone === "container";
}

export function viewmodelAmbientForZone(
  zone: ViewmodelLightingZone,
): { color: number; intensity: number } | null {
  if (zone === "room") {
    return VIEWMODEL_AMBIENT_ROOM;
  }
  if (zone === "container") {
    return VIEWMODEL_AMBIENT_CONTAINER;
  }
  return null;
}

/** Until rooms/containers ship, the arena is always outdoor for viewmodel lighting. */
export function resolveViewmodelLightingZone(): ViewmodelLightingZone {
  return "outdoor";
}
