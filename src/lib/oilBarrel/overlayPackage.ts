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
  topFadeStart: number;
  topFadeEnd: number;
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
  return {
    ...DEFAULT_OIL_BARREL_FIRE_TUNING,
    ...overlay.tuning,
  };
}
