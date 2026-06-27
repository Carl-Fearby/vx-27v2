/** GE2 level1.json — circular pit in the arena floor. */
export type FloorHole = {
  x: number;
  z: number;
  radius: number;
};

export const FLOOR_HOLES: FloorHole[] = [{ x: -8, z: 2, radius: 1.4 }];

export const FLOOR_FOOT_Y = 0;

/** Meters below foot level before the fall death handler fires (GE2 `DEATH_FALL_DROP`). */
export const DEATH_FALL_DROP = 12;

/** Minimum time the death overlay stays opaque before click-to-respawn (GE2). */
export const DEATH_MIN_DISPLAY_MS = 800;

/** Post-respawn overlay fade duration (GE2 `DEATH_FADE_MS`). */
export const DEATH_FADE_MS = 1200;

export function pointInFloorHole(
  x: number,
  z: number,
  holes: FloorHole[] = FLOOR_HOLES,
  inset = 0,
): boolean {
  for (const hole of holes) {
    const dx = x - hole.x;
    const dz = z - hole.z;
    const r = Math.max(0, hole.radius - inset);
    if (dx * dx + dz * dz < r * r) {
      return true;
    }
  }
  return false;
}
