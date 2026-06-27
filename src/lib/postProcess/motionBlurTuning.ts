export type MotionBlurTuning = {
  enabled: boolean;
  /** Screen-space blur amount when the camera moves. */
  motionStrength: number;
  /** Sample count — higher = smoother, more GPU cost. */
  motionBlurSamples: number;
};

export const MOTION_STRENGTH_MIN = 0;
export const MOTION_STRENGTH_MAX = 2;
export const MOTION_STRENGTH_STEP = 0.05;

export const MOTION_BLUR_SAMPLES_MIN = 4;
export const MOTION_BLUR_SAMPLES_MAX = 64;
export const MOTION_BLUR_SAMPLES_STEP = 4;

export const DEFAULT_MOTION_BLUR_TUNING: MotionBlurTuning = {
  enabled: true,
  motionStrength: 0.15,
  motionBlurSamples: 32,
};

const DEV_STORAGE_KEY = "vx27-dev-motion-blur-tuning-v2";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function sanitizeMotionBlurTuning(
  value: Partial<MotionBlurTuning>,
  fallback: MotionBlurTuning = DEFAULT_MOTION_BLUR_TUNING,
): MotionBlurTuning {
  return {
    enabled:
      typeof value.enabled === "boolean" ? value.enabled : fallback.enabled,
    motionStrength: clamp(
      typeof value.motionStrength === "number"
        ? value.motionStrength
        : fallback.motionStrength,
      MOTION_STRENGTH_MIN,
      MOTION_STRENGTH_MAX,
    ),
    motionBlurSamples: clamp(
      typeof value.motionBlurSamples === "number"
        ? value.motionBlurSamples
        : fallback.motionBlurSamples,
      MOTION_BLUR_SAMPLES_MIN,
      MOTION_BLUR_SAMPLES_MAX,
    ),
  };
}

let sessionMotionBlurTuning: MotionBlurTuning = {
  ...DEFAULT_MOTION_BLUR_TUNING,
};

const MOTION_BLUR_TUNING_SCHEMA_VERSION = 2;
let loadedMotionBlurTuningVersion = 0;

function loadDevMotionBlurTuning(): MotionBlurTuning | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DEV_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    return sanitizeMotionBlurTuning(JSON.parse(raw) as Partial<MotionBlurTuning>);
  } catch {
    return null;
  }
}

function persistDevMotionBlurTuning(tuning: MotionBlurTuning) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DEV_STORAGE_KEY, JSON.stringify(tuning));
  } catch {
    // ignore quota / private mode
  }
}

function ensureMotionBlurTuningSchema() {
  if (loadedMotionBlurTuningVersion === MOTION_BLUR_TUNING_SCHEMA_VERSION) {
    return;
  }

  sessionMotionBlurTuning = {
    ...DEFAULT_MOTION_BLUR_TUNING,
    ...loadDevMotionBlurTuning(),
  };
  loadedMotionBlurTuningVersion = MOTION_BLUR_TUNING_SCHEMA_VERSION;
}

export function loadMotionBlurTuning(): MotionBlurTuning {
  ensureMotionBlurTuningSchema();
  return { ...sessionMotionBlurTuning };
}

export function saveMotionBlurTuning(
  patch: Partial<MotionBlurTuning>,
): MotionBlurTuning {
  ensureMotionBlurTuningSchema();
  sessionMotionBlurTuning = sanitizeMotionBlurTuning({
    ...sessionMotionBlurTuning,
    ...patch,
  });
  persistDevMotionBlurTuning(sessionMotionBlurTuning);
  return loadMotionBlurTuning();
}

export function resetMotionBlurTuning(): MotionBlurTuning {
  sessionMotionBlurTuning = { ...DEFAULT_MOTION_BLUR_TUNING };
  persistDevMotionBlurTuning(sessionMotionBlurTuning);
  loadedMotionBlurTuningVersion = MOTION_BLUR_TUNING_SCHEMA_VERSION;
  return loadMotionBlurTuning();
}

export function formatMotionBlurTuningJson(
  tuning: MotionBlurTuning = loadMotionBlurTuning(),
): string {
  return JSON.stringify(tuning, null, 2);
}

ensureMotionBlurTuningSchema();
