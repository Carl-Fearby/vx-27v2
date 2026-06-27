"use client";

import { useCallback, useState } from "react";
import {
  loadMotionBlurTuning,
  resetMotionBlurTuning,
  saveMotionBlurTuning,
  type MotionBlurTuning,
} from "@/lib/postProcess/motionBlurTuning";

export function useMotionBlurTuning() {
  const [tuning, setTuning] = useState<MotionBlurTuning>(() => loadMotionBlurTuning());

  const updateTuning = useCallback((patch: Partial<MotionBlurTuning>) => {
    setTuning((current) =>
      saveMotionBlurTuning({
        ...current,
        ...patch,
      }),
    );
  }, []);

  const resetTuning = useCallback(() => {
    setTuning(resetMotionBlurTuning());
  }, []);

  return { tuning, updateTuning, resetTuning };
}
