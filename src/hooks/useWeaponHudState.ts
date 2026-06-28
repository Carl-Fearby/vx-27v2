"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  resolveActiveAmmoHudState,
  type ActiveAmmoHudState,
} from "@/lib/hud/ammoHud";
import {
  GRENADE_WEAPON_SLOT,
  getVisiblePrimarySlotKeys,
  PRIMARY_SLOT_UI,
} from "@/lib/hud/weaponHud";
import { eventMatchesBinding, type KeyBindingsMap } from "@/lib/keyBindings";
import {
  createArenaAmmoPool,
  createDefaultFireModePool,
  cycleFireMode,
  getPrimaryWeaponConfig,
  resolveFireModeForWeapon,
  type AmmoPool,
  type FireMode,
  type FireModePool,
  type PrimaryWeaponId,
} from "@/lib/weapons/primaryWeapons";
import {
  createArenaSecondaryWeaponStock,
  type SecondaryWeaponStock,
} from "@/lib/weapons/secondaryWeapons";

type UseWeaponHudStateOptions = {
  enabled: boolean;
  bindings?: KeyBindingsMap;
};

function getPrimaryFromKey(code: string): PrimaryWeaponId | null {
  for (const slotKey of getVisiblePrimarySlotKeys()) {
    const slot = PRIMARY_SLOT_UI[slotKey];
    if (slot?.keyCode === code) {
      return slot.weaponId;
    }
  }
  return null;
}

function getSecondarySlotFromKey(code: string): number | null {
  const match = /^Digit([1-4])$/.exec(code) ?? /^Numpad([1-4])$/.exec(code);
  if (!match) {
    return null;
  }
  return Number(match[1]);
}

export function useWeaponHudState({
  enabled,
  bindings,
}: UseWeaponHudStateOptions) {
  const [activePrimaryWeapon, setActivePrimaryWeapon] =
    useState<PrimaryWeaponId>("rifle");
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(
    GRENADE_WEAPON_SLOT,
  );
  const [ammoPool, setAmmoPool] = useState<AmmoPool>(() =>
    createArenaAmmoPool(),
  );
  const [secondaryStock, setSecondaryStock] = useState<SecondaryWeaponStock>(
    () => createArenaSecondaryWeaponStock(),
  );
  const [fireModeByWeapon, setFireModeByWeapon] = useState<FireModePool>(() =>
    createDefaultFireModePool(),
  );
  const [fireMode, setFireMode] = useState<FireMode>(
    () => createDefaultFireModePool().rifle,
  );
  const ammoPoolRef = useRef(ammoPool);
  const fireModeByWeaponRef = useRef(fireModeByWeapon);
  const [activeAmmoHud, setActiveAmmoHud] = useState<ActiveAmmoHudState>(() =>
    resolveActiveAmmoHudState("rifle", createArenaAmmoPool()),
  );

  ammoPoolRef.current = ammoPool;
  fireModeByWeaponRef.current = fireModeByWeapon;

  const applyFireModeForWeapon = useCallback((weaponId: PrimaryWeaponId) => {
    const resolved = resolveFireModeForWeapon(
      weaponId,
      fireModeByWeaponRef.current[weaponId],
    );
    fireModeByWeaponRef.current = {
      ...fireModeByWeaponRef.current,
      [weaponId]: resolved,
    };
    setFireModeByWeapon({ ...fireModeByWeaponRef.current });
    setFireMode(resolved);
  }, []);

  const applyActiveAmmoHud = useCallback((weaponId: PrimaryWeaponId) => {
    setActiveAmmoHud(
      resolveActiveAmmoHudState(weaponId, ammoPoolRef.current),
    );
  }, []);

  const selectPrimaryWeapon = useCallback(
    (weaponId: PrimaryWeaponId) => {
      setActivePrimaryWeapon(weaponId);
      applyActiveAmmoHud(weaponId);
      applyFireModeForWeapon(weaponId);
    },
    [applyActiveAmmoHud, applyFireModeForWeapon],
  );

  const togglePrimaryWeapon = useCallback(() => {
    setActivePrimaryWeapon((current) => {
      const next: PrimaryWeaponId = current === "rifle" ? "pistol" : "rifle";
      setActiveAmmoHud(
        resolveActiveAmmoHudState(next, ammoPoolRef.current),
      );
      const resolved = resolveFireModeForWeapon(
        next,
        fireModeByWeaponRef.current[next],
      );
      fireModeByWeaponRef.current = {
        ...fireModeByWeaponRef.current,
        [next]: resolved,
      };
      setFireModeByWeapon({ ...fireModeByWeaponRef.current });
      setFireMode(resolved);
      return next;
    });
  }, []);

  const cycleFireModeHud = useCallback(() => {
    const weaponId = activePrimaryWeapon;
    const next = cycleFireMode(weaponId, fireModeByWeaponRef.current[weaponId]);
    const resolved = resolveFireModeForWeapon(weaponId, next);
    fireModeByWeaponRef.current = {
      ...fireModeByWeaponRef.current,
      [weaponId]: resolved,
    };
    setFireModeByWeapon({ ...fireModeByWeaponRef.current });
    setFireMode(resolved);
  }, [activePrimaryWeapon]);

  const onKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled || event.repeat) {
        return;
      }

      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (
        bindings &&
        eventMatchesBinding(bindings, "cycleFireMode", event.code)
      ) {
        event.preventDefault();
        cycleFireModeHud();
        return;
      }

      const slotPick = getPrimaryFromKey(event.code);
      if (slotPick) {
        event.preventDefault();
        selectPrimaryWeapon(slotPick);
        return;
      }

      if (event.code === "KeyX" || event.code === "Digit0" || event.code === "Numpad0") {
        event.preventDefault();
        togglePrimaryWeapon();
        return;
      }

      const secondarySlot = getSecondarySlotFromKey(event.code);
      if (secondarySlot != null) {
        event.preventDefault();
        setSelectedWeaponSlot(secondarySlot);
      }
    },
    [bindings, cycleFireModeHud, enabled, selectPrimaryWeapon, togglePrimaryWeapon],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  useEffect(() => {
    applyActiveAmmoHud(activePrimaryWeapon);
  }, [activePrimaryWeapon, ammoPool, applyActiveAmmoHud]);

  const primaryAmmo = {
    rifle: { rounds: ammoPool.rifle.rounds },
    pistol: { rounds: ammoPool.pistol.rounds },
  };

  const activeFireModes = getPrimaryWeaponConfig(activePrimaryWeapon).fireModes;

  return {
    activePrimaryWeapon,
    selectedWeaponSlot,
    grenadeCount: secondaryStock.grenades,
    flashbangCount: secondaryStock.flashbangs,
    ammoPool,
    secondaryStock,
    primaryAmmo,
    roundsInMag: activeAmmoHud.roundsInMag,
    spareMags: activeAmmoHud.spareMags,
    activeMagazineSize: activeAmmoHud.magazineSize,
    activeLowAmmoThreshold: activeAmmoHud.lowAmmoThreshold,
    fireMode,
    activeFireModes,
    cycleFireModeHud,
    selectPrimaryWeapon,
    setAmmoPool,
    setSecondaryStock,
  };
}
