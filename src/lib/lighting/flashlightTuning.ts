export type FlashlightTuning = {
  /** Outer cone half-angle in degrees (GE2 default 22). */
  spreadAngleDeg: number;
  /** Soft edge blend 0 = sharp, 1 = soft (GE2 penumbra 0.48). */
  penumbra: number;
  /** Babylon spot brightness scale (GE2 intensity 32 × ~6). */
  intensityMultiplier: number;
  /** Reflector ring brightness boost on lit surfaces. */
  haloBrightness: number;
  /** Projected ring outer radius on surfaces. */
  haloWidth: number;
  /** Bright annulus band width (normalized texture radius). */
  ringThickness: number;
};

export const SPREAD_ANGLE_MIN = 8;
export const SPREAD_ANGLE_MAX = 45;
export const SPREAD_ANGLE_STEP = 1;

export const PENUMBRA_MIN = 0;
export const PENUMBRA_MAX = 1;
export const PENUMBRA_STEP = 0.01;

export const INTENSITY_MULTIPLIER_MIN = 1;
export const INTENSITY_MULTIPLIER_MAX = 20;
export const INTENSITY_MULTIPLIER_STEP = 0.5;

export const HALO_BRIGHTNESS_MIN = 0;
export const HALO_BRIGHTNESS_MAX = 1;
export const HALO_BRIGHTNESS_STEP = 0.01;

export const HALO_WIDTH_MIN = 1;
export const HALO_WIDTH_MAX = 12;
export const HALO_WIDTH_STEP = 0.1;

export const RING_THICKNESS_MIN = 0.005;
export const RING_THICKNESS_MAX = 0.55;
export const RING_THICKNESS_STEP = 0.005;

export const DEFAULT_FLASHLIGHT_TUNING: FlashlightTuning = {
  spreadAngleDeg: 45,
  penumbra: 1,
  intensityMultiplier: 10,
  haloBrightness: 0.35,
  haloWidth: 7.1,
  ringThickness: 0.01,
};

const DEV_STORAGE_KEY = "vx27-dev-flashlight-tuning";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeFlashlightTuning(
  value: Partial<FlashlightTuning>,
  fallback: FlashlightTuning = DEFAULT_FLASHLIGHT_TUNING,
): FlashlightTuning {
  return {
    spreadAngleDeg: clamp(
      typeof value.spreadAngleDeg === "number"
        ? value.spreadAngleDeg
        : fallback.spreadAngleDeg,
      SPREAD_ANGLE_MIN,
      SPREAD_ANGLE_MAX,
    ),
    penumbra: clamp(
      typeof value.penumbra === "number" ? value.penumbra : fallback.penumbra,
      PENUMBRA_MIN,
      PENUMBRA_MAX,
    ),
    intensityMultiplier: clamp(
      typeof value.intensityMultiplier === "number"
        ? value.intensityMultiplier
        : fallback.intensityMultiplier,
      INTENSITY_MULTIPLIER_MIN,
      INTENSITY_MULTIPLIER_MAX,
    ),
    haloBrightness: clamp(
      typeof value.haloBrightness === "number"
        ? value.haloBrightness
        : fallback.haloBrightness,
      HALO_BRIGHTNESS_MIN,
      HALO_BRIGHTNESS_MAX,
    ),
    haloWidth: clamp(
      typeof value.haloWidth === "number" ? value.haloWidth : fallback.haloWidth,
      HALO_WIDTH_MIN,
      HALO_WIDTH_MAX,
    ),
    ringThickness: clamp(
      typeof value.ringThickness === "number"
        ? value.ringThickness
        : fallback.ringThickness,
      RING_THICKNESS_MIN,
      RING_THICKNESS_MAX,
    ),
  };
}

let sessionFlashlightTuning: FlashlightTuning = {
  ...DEFAULT_FLASHLIGHT_TUNING,
};

const FLASHLIGHT_TUNING_SCHEMA_VERSION = 3;
let loadedFlashlightTuningVersion = 0;

function loadDevFlashlightTuning(): FlashlightTuning | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return sanitizeFlashlightTuning(JSON.parse(raw) as Partial<FlashlightTuning>);
  } catch {
    return null;
  }
}

function persistDevFlashlightTuning(tuning: FlashlightTuning) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    // ignore quota / private mode
  }
}

function ensureFlashlightTuningSchema() {
  if (loadedFlashlightTuningVersion === FLASHLIGHT_TUNING_SCHEMA_VERSION) {
    return;
  }

  sessionFlashlightTuning = {
    ...DEFAULT_FLASHLIGHT_TUNING,
    ...loadDevFlashlightTuning(),
  };
  loadedFlashlightTuningVersion = FLASHLIGHT_TUNING_SCHEMA_VERSION;
}

export function loadFlashlightTuning(): FlashlightTuning {
  ensureFlashlightTuningSchema();
  return { ...sessionFlashlightTuning };
}

export function saveFlashlightTuning(
  patch: Partial<FlashlightTuning>,
): FlashlightTuning {
  ensureFlashlightTuningSchema();
  sessionFlashlightTuning = sanitizeFlashlightTuning({
    ...sessionFlashlightTuning,
    ...patch,
  });
  persistDevFlashlightTuning(sessionFlashlightTuning);
  return loadFlashlightTuning();
}

export function resetFlashlightTuning(): FlashlightTuning {
  sessionFlashlightTuning = { ...DEFAULT_FLASHLIGHT_TUNING };
  persistDevFlashlightTuning(sessionFlashlightTuning);
  loadedFlashlightTuningVersion = FLASHLIGHT_TUNING_SCHEMA_VERSION;
  return loadFlashlightTuning();
}

export function formatFlashlightTuningJson(
  tuning: FlashlightTuning = loadFlashlightTuning(),
): string {
  return JSON.stringify(tuning, null, 2);
}

ensureFlashlightTuningSchema();
