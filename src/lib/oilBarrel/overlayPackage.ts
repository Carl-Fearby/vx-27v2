import {
  OIL_BARREL_OVERLAY_URL,
  isOilBarrelModelPath,
} from "@/lib/oilBarrel/oilBarrelAssets";
import {
  DEFAULT_OIL_BARREL_FIRE_TUNING,
  type OilBarrelFireTuning,
} from "@/lib/oilBarrel/oilBarrelTuning";

export type OilBarrelOverlayDimensions = {
  innerRadius: number;
  floorY: number;
  clipTopY: number;
  innerWallHeight: number;
};

export type OilBarrelFireVideoConfig = {
  color: string;
  alpha: string;
  aspect: number;
  floorLift: number;
  clipRadiusFactor: number;
  /** @deprecated Use overlay tuning `interiorFireTopFadeStart` / `interiorFireTopFadeEnd`. */
  topFadeStart?: number;
  /** @deprecated Use overlay tuning `interiorFireTopFadeStart` / `interiorFireTopFadeEnd`. */
  topFadeEnd?: number;
};

export type OilBarrelFireOverlay = {
  id: string;
  type: "oilBarrelFire";
  attachToNode: string;
  dimensions: OilBarrelOverlayDimensions;
  video: OilBarrelFireVideoConfig;
  tuning: Partial<OilBarrelFireTuning>;
};

export type ModelOverlayPackage = {
  packageId: string;
  description?: string;
  targetModel?: string;
  overlays: OilBarrelFireOverlay[];
};

export function overlayPackagePathForModel(modelPath: string): string {
  return modelPath.replace(/\.glb$/i, ".overlay.json");
}

async function fetchOverlayPackage(url: string): Promise<ModelOverlayPackage | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      return null;
    }
    return (await response.json()) as ModelOverlayPackage;
  } catch {
    return null;
  }
}

export async function loadModelOverlayPackage(
  modelPath: string,
): Promise<ModelOverlayPackage | null> {
  const sidecar = await fetchOverlayPackage(overlayPackagePathForModel(modelPath));
  if (sidecar) {
    return sidecar;
  }
  if (isOilBarrelModelPath(modelPath)) {
    return fetchOverlayPackage(OIL_BARREL_OVERLAY_URL);
  }
  return null;
}

export function resolveOilBarrelFireTuning(
  overlay: OilBarrelFireOverlay,
): OilBarrelFireTuning {
  const resolved = {
    ...DEFAULT_OIL_BARREL_FIRE_TUNING,
    ...overlay.tuning,
  };
  if (overlay.video.topFadeStart != null) {
    resolved.interiorFireTopFadeStart = overlay.video.topFadeStart;
  }
  if (overlay.video.topFadeEnd != null) {
    resolved.interiorFireTopFadeEnd = overlay.video.topFadeEnd;
  }
  return resolved;
}

export function resolveOverlayPackagePathForModel(modelPath: string): string {
  if (isOilBarrelModelPath(modelPath)) {
    return OIL_BARREL_OVERLAY_URL;
  }
  return overlayPackagePathForModel(modelPath);
}

export function applyTuningToOilBarrelOverlayPackage(
  overlayPackage: ModelOverlayPackage,
  tuning: OilBarrelFireTuning,
): ModelOverlayPackage {
  return {
    ...overlayPackage,
    overlays: overlayPackage.overlays.map((overlay) => {
      if (overlay.type !== "oilBarrelFire") {
        return overlay;
      }
      const { interiorFire, ...tuningFields } = tuning;
      return {
        ...overlay,
        tuning: {
          ...overlay.tuning,
          interiorFire,
          ...tuningFields,
        },
      };
    }),
  };
}
