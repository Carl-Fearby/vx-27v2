export type OilBarrelFireTuning = {
  interiorFire: boolean;
  interiorVideoWidthScale: number;
  interiorVideoHeightScale: number;
  interiorVideoCenterOffsetX: number;
  interiorVideoCenterOffsetY: number;
  interiorFireOffsetX: number;
  interiorFlameTexBottom: number;
  interiorFlameTexTop: number;
  interiorFireLightIntensity: number;
  interiorFireLightLeftX: number;
  interiorFireLightRightX: number;
  interiorFireLightLeftY: number;
  interiorFireLightRightY: number;
};

export const DEFAULT_OIL_BARREL_FIRE_TUNING: OilBarrelFireTuning = {
  interiorFire: true,
  interiorVideoWidthScale: 1.9,
  interiorVideoHeightScale: 2,
  interiorVideoCenterOffsetX: -0.195,
  interiorVideoCenterOffsetY: 0.185,
  interiorFireOffsetX: 0.185,
  interiorFlameTexBottom: 0.15,
  interiorFlameTexTop: 0.92,
  interiorFireLightIntensity: 7,
  interiorFireLightLeftX: -0.042,
  interiorFireLightRightX: 0.042,
  interiorFireLightLeftY: 0,
  interiorFireLightRightY: 0,
};

export function normalizeFlameTexVRange(tuning: OilBarrelFireTuning): {
  sampleV0: number;
  sampleV1: number;
} {
  let v0 = tuning.interiorFlameTexBottom;
  let v1 = tuning.interiorFlameTexTop;
  v0 = Math.min(Math.max(v0, 0), 0.98);
  v1 = Math.min(Math.max(v1, 0.02), 1);
  if (v1 < v0 + 0.02) {
    v1 = Math.min(1, v0 + 0.02);
  }
  return { sampleV0: v0, sampleV1: v1 };
}
