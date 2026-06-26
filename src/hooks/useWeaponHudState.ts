"use client";

import { useCallback, useEffect, useState } from "react";
import {
  GRENADE_WEAPON_SLOT,
  getVisiblePrimarySlotKeys,
  PRIMARY_SLOT_UI,
  type PrimaryWeaponId,
} from "@/lib/hud/weaponHud";

type UseWeaponHudStateOptions = {
  enabled: boolean;
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

export function useWeaponHudState({ enabled }: UseWeaponHudStateOptions) {
  const [activePrimaryWeapon, setActivePrimaryWeapon] =
    useState<PrimaryWeaponId>("rifle");
  const [selectedWeaponSlot, setSelectedWeaponSlot] = useState(
    GRENADE_WEAPON_SLOT,
  );

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

      const slotPick = getPrimaryFromKey(event.code);
      if (slotPick) {
        event.preventDefault();
        setActivePrimaryWeapon(slotPick);
        return;
      }

      if (event.code === "KeyX" || event.code === "Digit0" || event.code === "Numpad0") {
        event.preventDefault();
        setActivePrimaryWeapon((current) =>
          current === "rifle" ? "pistol" : "rifle",
        );
        return;
      }

      const secondarySlot = getSecondarySlotFromKey(event.code);
      if (secondarySlot != null) {
        event.preventDefault();
        setSelectedWeaponSlot(secondarySlot);
      }
    },
    [enabled],
  );

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  return {
    activePrimaryWeapon,
    selectedWeaponSlot,
    grenadeCount: 0,
    flashbangCount: 0,
  };
}
