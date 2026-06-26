"use client";

import { useCallback, useState } from "react";
import { DEFAULT_SURFACE_TUNING } from "@/lib/materialEdit/defaults";
import { loadSurfaceTuning, saveSurfaceTuning } from "@/lib/materialEdit/storage";
import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";

export function useMaterialEdit() {
  const [materialEditMode, setMaterialEditMode] = useState(false);
  const [selectedSurface, setSelectedSurface] = useState<EditableSurfaceId | null>(
    null,
  );
  const [surfaceTuning, setSurfaceTuning] =
    useState<SurfaceTuningState>(loadSurfaceTuning);

  const toggleMaterialEditMode = useCallback(() => {
    setMaterialEditMode((current) => {
      if (current) {
        setSelectedSurface(null);
      }
      return !current;
    });
  }, []);

  const updateSurfaceTuning = useCallback(
    (surfaceId: EditableSurfaceId, patch: Partial<SurfaceMaterialTuning>) => {
      setSurfaceTuning((current) => {
        const next: SurfaceTuningState = {
          ...current,
          [surfaceId]: { ...current[surfaceId], ...patch },
        };
        return saveSurfaceTuning(next);
      });
    },
    [],
  );

  const resetSurfaceTuning = useCallback((surfaceId: EditableSurfaceId) => {
    setSurfaceTuning((current) => {
      const next: SurfaceTuningState = {
        ...current,
        [surfaceId]: { ...DEFAULT_SURFACE_TUNING[surfaceId] },
      };
      return saveSurfaceTuning(next);
    });
  }, []);

  const resetAllSurfaceTuning = useCallback(() => {
    const next: SurfaceTuningState = {
      floor: { ...DEFAULT_SURFACE_TUNING.floor },
      pillar: { ...DEFAULT_SURFACE_TUNING.pillar },
    };
    setSurfaceTuning(saveSurfaceTuning(next));
  }, []);

  return {
    materialEditMode,
    selectedSurface,
    surfaceTuning,
    toggleMaterialEditMode,
    setSelectedSurface,
    updateSurfaceTuning,
    resetSurfaceTuning,
    resetAllSurfaceTuning,
  };
}
