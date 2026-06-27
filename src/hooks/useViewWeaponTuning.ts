"use client";

import { useCallback, useState } from "react";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import {
  loadViewWeaponTuning,
  resetViewWeaponTuning,
  saveViewWeaponTuning,
  type ViewWeaponPose,
  type ViewWeaponPoseMode,
  type ViewWeaponTuning,
} from "@/lib/weapons/viewWeaponTuning";

export function useViewWeaponTuning() {
  const [tuning, setTuning] = useState<ViewWeaponTuning>(() =>
    loadViewWeaponTuning(),
  );

  const updatePose = useCallback(
    (
      weapon: PrimaryWeaponId,
      mode: ViewWeaponPoseMode,
      patch: Partial<ViewWeaponPose>,
    ) => {
      setTuning((current) =>
        saveViewWeaponTuning({
          ...current,
          [weapon]: {
            ...current[weapon],
            [mode]: {
              ...current[weapon][mode],
              ...patch,
            },
          },
        }),
      );
    },
    [],
  );

  const resetTuning = useCallback(() => {
    setTuning(resetViewWeaponTuning());
  }, []);

  return { tuning, updatePose, resetTuning };
}
