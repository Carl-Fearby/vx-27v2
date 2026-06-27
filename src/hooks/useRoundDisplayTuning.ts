"use client";

import { useCallback, useState } from "react";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import {
  loadRoundDisplayTuning,
  resetRoundDisplayTuning,
  saveRoundDisplayTuning,
  type RoundDisplayPoseMode,
  type RoundDisplayTuning,
  type WeaponRoundDisplayPose,
} from "@/lib/weapons/weaponRoundDisplayTuning";

export function useRoundDisplayTuning() {
  const [tuning, setTuning] = useState<RoundDisplayTuning>(() =>
    loadRoundDisplayTuning(),
  );

  const updatePose = useCallback(
    (
      weapon: PrimaryWeaponId,
      mode: RoundDisplayPoseMode,
      patch: Partial<WeaponRoundDisplayPose>,
    ) => {
      setTuning((current) =>
        saveRoundDisplayTuning({
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
    setTuning(resetRoundDisplayTuning());
  }, []);

  return { tuning, updatePose, resetTuning };
}
