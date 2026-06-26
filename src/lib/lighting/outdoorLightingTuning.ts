import {
  clamp,
  DEFAULT_HEMI_NIGHT,
  MOON_INTENSITY_DEFAULT,
  MOON_TEMPERATURE_DEFAULT,
} from "@/lib/lighting/tuning";

export type HemiTuning = {
  temperature: number;
  intensity: number;
};

export type OutdoorLightingTuning = {
  sunIntensity: number;
  sunTemperature: number;
  moonIntensity: number;
  moonTemperature: number;
  shelteredHemiMul: number;
  /** 0 = no visible shadow, 1 = darkest shadows. */
  shadowDepth: number;
  hemiDay: HemiTuning;
  hemiNight: HemiTuning;
};

export const SUN_INTENSITY_DEFAULT = 8;
export const SUN_INTENSITY_MIN = 0;
export const SUN_INTENSITY_MAX = 10;
export const SUN_INTENSITY_STEP = 0.05;

export const SUN_TEMPERATURE_DEFAULT = 6400;
export const SUN_TEMPERATURE_MIN = 3500;
export const SUN_TEMPERATURE_MAX = 9000;
export const SUN_TEMPERATURE_STEP = 100;

export const MOON_INTENSITY_MIN = 0;
export const MOON_INTENSITY_MAX = 5;
export const MOON_INTENSITY_STEP = 0.01;

export const MOON_TEMPERATURE_MIN = 3500;
export const MOON_TEMPERATURE_MAX = 50000;
export const MOON_TEMPERATURE_STEP = 100;

export const SHELTERED_HEMI_MUL_DEFAULT = 1.26;
export const SHELTERED_HEMI_MUL_MIN = 0.4;
export const SHELTERED_HEMI_MUL_MAX = 3;
export const SHELTERED_HEMI_MUL_STEP = 0.02;

export const SHADOW_DEPTH_DEFAULT = 0.97;
export const SHADOW_DEPTH_MIN = 0;
export const SHADOW_DEPTH_MAX = 1;
export const SHADOW_DEPTH_STEP = 0.01;

export const HEMI_TEMPERATURE_MIN = 0;
export const HEMI_TEMPERATURE_MAX = 50000;
export const HEMI_TEMPERATURE_STEP = 100;

export const HEMI_INTENSITY_MIN = 0;
export const HEMI_INTENSITY_MAX = 5;
export const HEMI_INTENSITY_STEP = 0.01;

export const DEFAULT_HEMI_DAY: HemiTuning = {
  temperature: 7700,
  intensity: 1.2,
};

export const DEFAULT_OUTDOOR_LIGHTING: OutdoorLightingTuning = {
  sunIntensity: SUN_INTENSITY_DEFAULT,
  sunTemperature: SUN_TEMPERATURE_DEFAULT,
  moonIntensity: MOON_INTENSITY_DEFAULT,
  moonTemperature: MOON_TEMPERATURE_DEFAULT,
  shelteredHemiMul: SHELTERED_HEMI_MUL_DEFAULT,
  shadowDepth: SHADOW_DEPTH_DEFAULT,
  hemiDay: { ...DEFAULT_HEMI_DAY },
  hemiNight: { ...DEFAULT_HEMI_NIGHT },
};

let sessionOutdoorLighting: OutdoorLightingTuning = {
  ...DEFAULT_OUTDOOR_LIGHTING,
  hemiDay: { ...DEFAULT_OUTDOOR_LIGHTING.hemiDay },
  hemiNight: { ...DEFAULT_OUTDOOR_LIGHTING.hemiNight },
};

/** Bumps when defaults change — clears stale in-memory session values on hot reload. */
const OUTDOOR_LIGHTING_SCHEMA_VERSION = 5;
let loadedOutdoorLightingVersion = 0;

function ensureOutdoorLightingSchema() {
  if (loadedOutdoorLightingVersion === OUTDOOR_LIGHTING_SCHEMA_VERSION) {
    return;
  }
  sessionOutdoorLighting = {
    ...DEFAULT_OUTDOOR_LIGHTING,
    hemiDay: { ...DEFAULT_OUTDOOR_LIGHTING.hemiDay },
    hemiNight: { ...DEFAULT_OUTDOOR_LIGHTING.hemiNight },
  };
  loadedOutdoorLightingVersion = OUTDOOR_LIGHTING_SCHEMA_VERSION;
}

function sanitizeHemi(value: Partial<HemiTuning> | undefined, fallback: HemiTuning): HemiTuning {
  return {
    temperature: clamp(
      typeof value?.temperature === "number" ? value.temperature : fallback.temperature,
      HEMI_TEMPERATURE_MIN,
      HEMI_TEMPERATURE_MAX,
    ),
    intensity: clamp(
      typeof value?.intensity === "number" ? value.intensity : fallback.intensity,
      HEMI_INTENSITY_MIN,
      HEMI_INTENSITY_MAX,
    ),
  };
}

function sanitizeOutdoorLighting(
  value: Partial<OutdoorLightingTuning>,
  fallback: OutdoorLightingTuning = sessionOutdoorLighting,
): OutdoorLightingTuning {
  return {
    sunIntensity: clamp(
      typeof value.sunIntensity === "number"
        ? value.sunIntensity
        : fallback.sunIntensity,
      SUN_INTENSITY_MIN,
      SUN_INTENSITY_MAX,
    ),
    sunTemperature: clamp(
      typeof value.sunTemperature === "number"
        ? value.sunTemperature
        : fallback.sunTemperature,
      SUN_TEMPERATURE_MIN,
      SUN_TEMPERATURE_MAX,
    ),
    moonIntensity: clamp(
      typeof value.moonIntensity === "number"
        ? value.moonIntensity
        : fallback.moonIntensity,
      MOON_INTENSITY_MIN,
      MOON_INTENSITY_MAX,
    ),
    moonTemperature: clamp(
      typeof value.moonTemperature === "number"
        ? value.moonTemperature
        : fallback.moonTemperature,
      MOON_TEMPERATURE_MIN,
      MOON_TEMPERATURE_MAX,
    ),
    shelteredHemiMul: clamp(
      typeof value.shelteredHemiMul === "number"
        ? value.shelteredHemiMul
        : fallback.shelteredHemiMul,
      SHELTERED_HEMI_MUL_MIN,
      SHELTERED_HEMI_MUL_MAX,
    ),
    shadowDepth: clamp(
      typeof value.shadowDepth === "number"
        ? value.shadowDepth
        : fallback.shadowDepth,
      SHADOW_DEPTH_MIN,
      SHADOW_DEPTH_MAX,
    ),
    hemiDay: sanitizeHemi(value.hemiDay ?? fallback.hemiDay, DEFAULT_HEMI_DAY),
    hemiNight: sanitizeHemi(
      value.hemiNight ?? fallback.hemiNight,
      DEFAULT_HEMI_NIGHT,
    ),
  };
}

export function loadOutdoorLightingTuning(): OutdoorLightingTuning {
  ensureOutdoorLightingSchema();
  return {
    ...sessionOutdoorLighting,
    hemiDay: { ...sessionOutdoorLighting.hemiDay },
    hemiNight: { ...sessionOutdoorLighting.hemiNight },
  };
}

export function saveOutdoorLightingTuning(
  patch: Partial<OutdoorLightingTuning>,
): OutdoorLightingTuning {
  ensureOutdoorLightingSchema();
  sessionOutdoorLighting = sanitizeOutdoorLighting({
    ...sessionOutdoorLighting,
    ...patch,
    hemiDay: patch.hemiDay
      ? { ...sessionOutdoorLighting.hemiDay, ...patch.hemiDay }
      : sessionOutdoorLighting.hemiDay,
    hemiNight: patch.hemiNight
      ? { ...sessionOutdoorLighting.hemiNight, ...patch.hemiNight }
      : sessionOutdoorLighting.hemiNight,
  });
  return loadOutdoorLightingTuning();
}

export function formatOutdoorLightingJson(
  tuning: OutdoorLightingTuning = loadOutdoorLightingTuning(),
): string {
  return JSON.stringify(tuning, null, 2);
}

ensureOutdoorLightingSchema();
