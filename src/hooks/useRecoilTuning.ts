"use client";

import { useCallback, useState } from "react";
import {
  loadRecoilTuning,
  resetRecoilTuning,
  saveRecoilTuning,
  type RecoilTuning,
} from "@/lib/player/recoilTuning";

export function useRecoilTuning() {
  const [tuning, setTuning] = useState<RecoilTuning>(() => loadRecoilTuning());

  const updateTuning = useCallback((patch: Partial<RecoilTuning>) => {
    setTuning((current) => saveRecoilTuning({ ...current, ...patch }));
  }, []);

  const resetTuning = useCallback(() => {
    setTuning(resetRecoilTuning());
  }, []);

  return { tuning, updateTuning, resetTuning };
}
