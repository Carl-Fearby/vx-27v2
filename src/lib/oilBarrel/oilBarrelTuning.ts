export type OilBarrelFireTuning = {
  interiorFire: boolean;
  interiorVideoWidthScale: number;
  interiorVideoHeightScale: number;
  interiorVideoCenterOffsetX: number;
  interiorVideoCenterOffsetY: number;
  interiorFireOffsetX: number;
  interiorFlameTexBottom: number;
  interiorFlameTexTop: number;
  /** Plane height (0=bottom, 1=top) where smoke fade begins. */
  interiorFireTopFadeStart: number;
  /** Plane height where smoke is fully dissolved. */
  interiorFireTopFadeEnd: number;
  interiorFireLightIntensity: number;
  interiorFireLightLeftX: number;
  interiorFireLightRightX: number;
  interiorFireLightLeftY: number;
  interiorFireLightRightY: number;
};

export const OIL_BARREL_FIRE_TOP_FADE_LIMITS = {
  interiorFireTopFadeStart: { min: 0, max: 0.98, step: 0.01, nudge: 0.02 },
  interiorFireTopFadeEnd: { min: 0.02, max: 1, step: 0.01, nudge: 0.02 },
} as const;

export const OIL_BARREL_FIRE_TUNING_LIMITS = {
  interiorVideoWidthScale: { min: 0.5, max: 24, step: 0.1, nudge: 0.5 },
  interiorVideoHeightScale: { min: 0.5, max: 24, step: 0.1, nudge: 0.5 },
  interiorVideoCenterOffsetX: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorVideoCenterOffsetY: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorFireOffsetX: { min: -0.2, max: 0.2, step: 0.005, nudge: 0.01 },
  interiorFlameTexBottom: { min: 0, max: 0.98, step: 0.01, nudge: 0.02 },
  interiorFlameTexTop: { min: 0.02, max: 1, step: 0.01, nudge: 0.02 },
  interiorFireLightIntensity: { min: 0, max: 40, step: 0.5, nudge: 1 },
  interiorFireLightLeftX: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightRightX: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightLeftY: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  interiorFireLightRightY: { min: -0.15, max: 0.15, step: 0.005, nudge: 0.01 },
  ...OIL_BARREL_FIRE_TOP_FADE_LIMITS,
} as const;

export type OilBarrelFireTuningNumericKey = keyof typeof OIL_BARREL_FIRE_TUNING_LIMITS;

export const DEFAULT_OIL_BARREL_FIRE_TUNING: OilBarrelFireTuning = {
  interiorFire: true,
  interiorVideoWidthScale: 1.9,
  interiorVideoHeightScale: 2,
  interiorVideoCenterOffsetX: -0.195,
  interiorVideoCenterOffsetY: 0.185,
  interiorFireOffsetX: 0.185,
  interiorFlameTexBottom: 0.15,
  interiorFlameTexTop: 0.92,
  interiorFireTopFadeStart: 0.48,
  interiorFireTopFadeEnd: 0.9,
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

export function normalizeFireTopFadeRange(tuning: OilBarrelFireTuning): {
  topFadeStart: number;
  topFadeEnd: number;
} {
  const limits = OIL_BARREL_FIRE_TOP_FADE_LIMITS;
  let start = tuning.interiorFireTopFadeStart;
  let end = tuning.interiorFireTopFadeEnd;
  if (!Number.isFinite(start)) {
    start = DEFAULT_OIL_BARREL_FIRE_TUNING.interiorFireTopFadeStart;
  }
  if (!Number.isFinite(end)) {
    end = DEFAULT_OIL_BARREL_FIRE_TUNING.interiorFireTopFadeEnd;
  }
  start = Math.min(
    limits.interiorFireTopFadeStart.max,
    Math.max(limits.interiorFireTopFadeStart.min, start),
  );
  end = Math.min(
    limits.interiorFireTopFadeEnd.max,
    Math.max(limits.interiorFireTopFadeEnd.min, end),
  );
  if (end < start + 0.02) {
    end = Math.min(1, start + 0.02);
  }
  return { topFadeStart: start, topFadeEnd: end };
}

function clampTuningNumber(
  value: unknown,
  key: OilBarrelFireTuningNumericKey,
  fallback: number,
): number {
  const limits = OIL_BARREL_FIRE_TUNING_LIMITS[key];
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(limits.max, Math.max(limits.min, parsed));
}

/** Clamp all numeric fire tuning fields (GE2-style editor + overlay save). */
export function normalizeOilBarrelFireTuning(
  tuning: OilBarrelFireTuning,
): OilBarrelFireTuning {
  const defaults = DEFAULT_OIL_BARREL_FIRE_TUNING;
  const normalized: OilBarrelFireTuning = {
    interiorFire: tuning.interiorFire !== false,
    interiorVideoWidthScale: clampTuningNumber(
      tuning.interiorVideoWidthScale,
      "interiorVideoWidthScale",
      defaults.interiorVideoWidthScale,
    ),
    interiorVideoHeightScale: clampTuningNumber(
      tuning.interiorVideoHeightScale,
      "interiorVideoHeightScale",
      defaults.interiorVideoHeightScale,
    ),
    interiorVideoCenterOffsetX: clampTuningNumber(
      tuning.interiorVideoCenterOffsetX,
      "interiorVideoCenterOffsetX",
      defaults.interiorVideoCenterOffsetX,
    ),
    interiorVideoCenterOffsetY: clampTuningNumber(
      tuning.interiorVideoCenterOffsetY,
      "interiorVideoCenterOffsetY",
      defaults.interiorVideoCenterOffsetY,
    ),
    interiorFireOffsetX: clampTuningNumber(
      tuning.interiorFireOffsetX,
      "interiorFireOffsetX",
      defaults.interiorFireOffsetX,
    ),
    interiorFlameTexBottom: clampTuningNumber(
      tuning.interiorFlameTexBottom,
      "interiorFlameTexBottom",
      defaults.interiorFlameTexBottom,
    ),
    interiorFlameTexTop: clampTuningNumber(
      tuning.interiorFlameTexTop,
      "interiorFlameTexTop",
      defaults.interiorFlameTexTop,
    ),
    interiorFireLightIntensity: clampTuningNumber(
      tuning.interiorFireLightIntensity,
      "interiorFireLightIntensity",
      defaults.interiorFireLightIntensity,
    ),
    interiorFireLightLeftX: clampTuningNumber(
      tuning.interiorFireLightLeftX,
      "interiorFireLightLeftX",
      defaults.interiorFireLightLeftX,
    ),
    interiorFireLightRightX: clampTuningNumber(
      tuning.interiorFireLightRightX,
      "interiorFireLightRightX",
      defaults.interiorFireLightRightX,
    ),
    interiorFireLightLeftY: clampTuningNumber(
      tuning.interiorFireLightLeftY,
      "interiorFireLightLeftY",
      defaults.interiorFireLightLeftY,
    ),
    interiorFireLightRightY: clampTuningNumber(
      tuning.interiorFireLightRightY,
      "interiorFireLightRightY",
      defaults.interiorFireLightRightY,
    ),
    interiorFireTopFadeStart: defaults.interiorFireTopFadeStart,
    interiorFireTopFadeEnd: defaults.interiorFireTopFadeEnd,
  };

  const { sampleV0, sampleV1 } = normalizeFlameTexVRange(normalized);
  normalized.interiorFlameTexBottom = sampleV0;
  normalized.interiorFlameTexTop = sampleV1;

  const { topFadeStart, topFadeEnd } = normalizeFireTopFadeRange({
    ...normalized,
    interiorFireTopFadeStart: tuning.interiorFireTopFadeStart,
    interiorFireTopFadeEnd: tuning.interiorFireTopFadeEnd,
  });
  normalized.interiorFireTopFadeStart = topFadeStart;
  normalized.interiorFireTopFadeEnd = topFadeEnd;

  return normalized;
}

export function serializeOilBarrelFireTuningForOverlay(
  tuning: OilBarrelFireTuning,
): Omit<OilBarrelFireTuning, "interiorFire"> & { interiorFire: boolean } {
  const normalized = normalizeOilBarrelFireTuning(tuning);
  return { ...normalized };
}
