"use client";

import { useCallback, useState } from "react";
import {
  loadFlashlightTuning,
  resetFlashlightTuning,
  saveFlashlightTuning,
  type FlashlightTuning,
} from "@/lib/lighting/flashlightTuning";

export function useFlashlightTuning() {
  const [tuning, setTuning] = useState<FlashlightTuning>(() => loadFlashlightTuning());

  const updateTuning = useCallback((patch: Partial<FlashlightTuning>) => {
    setTuning((current) =>
      saveFlashlightTuning({
        ...current,
        ...patch,
      }),
    );
  }, []);

  const resetTuning = useCallback(() => {
    setTuning(resetFlashlightTuning());
  }, []);

  return { tuning, updateTuning, resetTuning };
}
