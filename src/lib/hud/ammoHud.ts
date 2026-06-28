import type { PrimaryWeaponId } from "@/lib/weapons/primaryWeapons";
import {
  getPrimaryWeaponConfig,
  type AmmoPool,
  type WeaponAmmoStore,
} from "@/lib/weapons/primaryWeapons";

export type ActiveAmmoHudState = {
  roundsInMag: number;
  spareMags: number;
  magazineSize: number;
  lowAmmoThreshold: number;
};

/** Shrink HUD ammo digits when a stat exceeds two digits (GE2). */
export function hudAmmoValueCompactClass(value: number): string {
  return value >= 100 ? " hud-ammo-value--compact" : "";
}

export function isRoundsLow(
  roundsInMag: number,
  spareMags: number,
  lowAmmoThreshold: number,
): boolean {
  return (
    roundsInMag < lowAmmoThreshold || (roundsInMag === 0 && spareMags === 0)
  );
}

export function isAmmoEmpty(roundsInMag: number, spareMags: number): boolean {
  return roundsInMag === 0 && spareMags === 0;
}

export function resolveActiveAmmoHudState(
  weaponId: PrimaryWeaponId,
  pool: AmmoPool,
): ActiveAmmoHudState {
  const cfg = getPrimaryWeaponConfig(weaponId);
  const store = pool[weaponId];
  return {
    roundsInMag: store.rounds,
    spareMags: store.spare,
    magazineSize: cfg.magazineSize,
    lowAmmoThreshold: cfg.lowAmmoThreshold,
  };
}

export function readAmmoStore(
  pool: AmmoPool,
  weaponId: PrimaryWeaponId,
): WeaponAmmoStore {
  return { ...pool[weaponId] };
}
