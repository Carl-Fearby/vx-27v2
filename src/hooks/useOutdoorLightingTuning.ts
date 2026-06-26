"use client";

import { useCallback, useState } from "react";
import {
  DEFAULT_OUTDOOR_LIGHTING,
  saveOutdoorLightingTuning,
  type OutdoorLightingTuning,
} from "@/lib/lighting/outdoorLightingTuning";

export function useOutdoorLightingTuning() {
  const [tuning, setTuning] = useState<OutdoorLightingTuning>(DEFAULT_OUTDOOR_LIGHTING);

  const updateTuning = useCallback((patch: Partial<OutdoorLightingTuning>) => {
    setTuning((current) => {
      const merged: OutdoorLightingTuning = {
        ...current,
        ...patch,
        hemiDay: patch.hemiDay
          ? { ...current.hemiDay, ...patch.hemiDay }
          : current.hemiDay,
        hemiNight: patch.hemiNight
          ? { ...current.hemiNight, ...patch.hemiNight }
          : current.hemiNight,
      };
      return saveOutdoorLightingTuning(merged);
    });
  }, []);

  const resetHemi = useCallback(() => {
    updateTuning({
      hemiDay: { ...DEFAULT_OUTDOOR_LIGHTING.hemiDay },
      hemiNight: { ...DEFAULT_OUTDOOR_LIGHTING.hemiNight },
    });
  }, [updateTuning]);

  const resetAll = useCallback(() => {
    updateTuning({
      ...DEFAULT_OUTDOOR_LIGHTING,
      hemiDay: { ...DEFAULT_OUTDOOR_LIGHTING.hemiDay },
      hemiNight: { ...DEFAULT_OUTDOOR_LIGHTING.hemiNight },
    });
  }, [updateTuning]);

  return { tuning, updateTuning, resetHemi, resetAll };
}
