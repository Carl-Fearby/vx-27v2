"use client";

import { useCallback, useEffect, useState } from "react";
import {
  DEFAULT_HUD_WEAPON_TUNING,
  loadHudWeaponTuning,
  saveHudWeaponTuning,
  type HudWeaponTuning,
} from "@/lib/hud/hudWeaponTuning";

export function useHudWeaponTuning() {
  const [tuning, setTuning] = useState<HudWeaponTuning>(DEFAULT_HUD_WEAPON_TUNING);

  useEffect(() => {
    setTuning(loadHudWeaponTuning());

    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "vx27-hud-weapon-tuning") {
        setTuning(loadHudWeaponTuning());
      }
    };

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const updateTuning = useCallback((patch: Partial<HudWeaponTuning>) => {
    setTuning((current) => saveHudWeaponTuning({ ...current, ...patch }));
  }, []);

  const resetTuning = useCallback(() => {
    setTuning(saveHudWeaponTuning({ ...DEFAULT_HUD_WEAPON_TUNING }));
  }, []);

  return { tuning, updateTuning, resetTuning };
}
