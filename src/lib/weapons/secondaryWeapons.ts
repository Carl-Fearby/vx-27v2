import {
  FLASHBANG_WEAPON_SLOT,
  GRENADE_WEAPON_SLOT,
} from "@/lib/hud/weaponHud";

/** Keep in sync with `GameEngine2/lib/combat/Grenade.js` defaults. */
export const DEFAULT_GRENADE_COUNT = 4;
export const DEFAULT_FLASHBANG_COUNT = 4;

export type SecondaryWeaponStock = {
  grenades: number;
  flashbangs: number;
};

export function createDefaultSecondaryWeaponStock(): SecondaryWeaponStock {
  return {
    grenades: DEFAULT_GRENADE_COUNT,
    flashbangs: DEFAULT_FLASHBANG_COUNT,
  };
}

/** Arena sandbox — full GE2 starting secondary loadout. */
export function createArenaSecondaryWeaponStock(): SecondaryWeaponStock {
  return createDefaultSecondaryWeaponStock();
}

export function getSecondarySlotStock(
  slotId: number,
  stock: SecondaryWeaponStock,
): number | null {
  if (slotId === GRENADE_WEAPON_SLOT) {
    return stock.grenades;
  }
  if (slotId === FLASHBANG_WEAPON_SLOT) {
    return stock.flashbangs;
  }
  return null;
}

export function isThrowableSecondarySlot(slotId: number): boolean {
  return slotId === GRENADE_WEAPON_SLOT || slotId === FLASHBANG_WEAPON_SLOT;
}
