export type PrimaryWeaponId = "rifle" | "pistol";

/** GE2/GE3 fire modes — `single` is semi-automatic (one shot per trigger). */
export type FireMode = "auto" | "burst" | "single";

export type PrimaryWeaponConfig = {
  id: PrimaryWeaponId;
  label: string;
  magazineSize: number;
  spareMagazines: number;
  lowAmmoThreshold: number;
  fireModes: FireMode[];
};

export const PRIMARY_WEAPON_CONFIG: Record<PrimaryWeaponId, PrimaryWeaponConfig> =
  {
    rifle: {
      id: "rifle",
      label: "RIFLE",
      magazineSize: 80,
      spareMagazines: 2,
      lowAmmoThreshold: 15,
      fireModes: ["auto", "burst", "single"],
    },
    pistol: {
      id: "pistol",
      label: "PISTOL",
      magazineSize: 12,
      spareMagazines: 2,
      lowAmmoThreshold: 4,
      fireModes: ["single"],
    },
  };

export type FireModePool = Record<PrimaryWeaponId, FireMode>;

export function createDefaultFireModePool(): FireModePool {
  return {
    rifle: "auto",
    pistol: "single",
  };
}

export function resolveFireModeForWeapon(
  id: PrimaryWeaponId,
  mode: FireMode,
): FireMode {
  const cfg = getPrimaryWeaponConfig(id);
  return cfg.fireModes.includes(mode) ? mode : cfg.fireModes[0];
}

export function cycleFireMode(
  weaponId: PrimaryWeaponId,
  currentMode: FireMode,
): FireMode {
  const modes = getPrimaryWeaponConfig(weaponId).fireModes;
  if (modes.length <= 1) {
    return currentMode;
  }
  const index = modes.indexOf(currentMode);
  const nextIndex = index < 0 ? 0 : (index + 1) % modes.length;
  return modes[nextIndex];
}

export type WeaponAmmoStore = {
  rounds: number;
  spare: number;
};

export type AmmoPool = Record<PrimaryWeaponId, WeaponAmmoStore>;

export function getPrimaryWeaponConfig(id: PrimaryWeaponId): PrimaryWeaponConfig {
  return PRIMARY_WEAPON_CONFIG[id] ?? PRIMARY_WEAPON_CONFIG.rifle;
}

/** One loaded mag + spareMagazines spare — e.g. pistol 3 mags / 36 rounds. */
export function getPrimaryWeaponStartingAmmo(id: PrimaryWeaponId): WeaponAmmoStore {
  const cfg = getPrimaryWeaponConfig(id);
  return {
    rounds: cfg.magazineSize,
    spare: cfg.spareMagazines,
  };
}

/** GE2 default — pistol only; rifle empty until unlocked or dev-start. */
export function createDefaultAmmoPool(): AmmoPool {
  return {
    rifle: { rounds: 0, spare: 0 },
    pistol: getPrimaryWeaponStartingAmmo("pistol"),
  };
}

/** Arena sandbox — both primaries at full starting loadout. */
export function createArenaAmmoPool(): AmmoPool {
  return {
    rifle: getPrimaryWeaponStartingAmmo("rifle"),
    pistol: getPrimaryWeaponStartingAmmo("pistol"),
  };
}
