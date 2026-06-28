export const SKY_MESH_RADIUS = 180;
export const SUN_BOWL_INSET = 20;
export const SUN_BOWL_RADIUS = SKY_MESH_RADIUS - SUN_BOWL_INSET;
export const SUN_DISC_SIZE = SUN_BOWL_RADIUS * 0.15;
export const SUN_SPIKE_SIZE = SUN_DISC_SIZE * 5;
export const SUN_CORE_SIZE = SUN_DISC_SIZE * 0.45;
export const MOON_DISC_SIZE = SUN_BOWL_RADIUS * 0.176;
export const NIGHT_SKY_LAT_OFFSET = 0.1;
export const DAY_NIGHT_FADE_DURATION = 10;

/** Northwest — tuned for arena wall shading. */
export const SUN_AZIMUTH_DEFAULT = 313;
export const SUN_ELEVATION_DEFAULT = 34;
export const SUN_INTENSITY_DEFAULT = 1.6;
export const SUN_TEMPERATURE_DEFAULT = 9000;

export const MOON_AZIMUTH_DEFAULT = 210;
export const MOON_ELEVATION_DEFAULT = 24;
export const MOON_INTENSITY_DEFAULT = 2.36;
export const MOON_TEMPERATURE_DEFAULT = 23500;
export const MOON_COLOR = { r: 184 / 255, g: 200 / 255, b: 240 / 255 };

export const DEFAULT_HEMI_DAY = { temperature: 13000, intensity: 0.27 };
export const DEFAULT_HEMI_NIGHT = { temperature: 0, intensity: 0 };

/** Transparent canvas; sky dome fills the backdrop (no solid blue wash). */
export const DAY_CLEAR_COLOR = { r: 0, g: 0, b: 0 };
/** Distant atmospheric haze — decoupled from canvas clear colour. */
export const DAY_FOG_COLOR = { r: 0.72, g: 0.85, b: 0.94 };
export const NIGHT_CLEAR_COLOR = { r: 0.024, g: 0.039, b: 0.078 };
export const DAY_FOG_NEAR = 45;
export const DAY_FOG_FAR = 95;
export const NIGHT_FOG_NEAR = 28;
export const NIGHT_FOG_FAR = 68;
export const DAY_TONE_EXPOSURE = 1.0;
export const NIGHT_TONE_EXPOSURE = 0.68;

export const SKY_DAY_URL = "/sky/sky_dome_equirectangular_4k.webp";
export const SKY_NIGHT_URL = "/sky/night_sky_dome_equirectangular_4k.webp";
export const MOON_TEXTURE_URL = "/sky/moon_lroc_color_2k.jpg";

const HEMI_BLUE_SATURATION_START = 12000;
const HEMI_BLUE_SATURATION_END = 25000;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function kelvinToRgb(kelvin: number): { r: number; g: number; b: number } {
  const k = kelvin / 100;
  let r: number;
  let g: number;
  let b: number;

  if (k <= 66) {
    r = 255;
    g = 99.4708025861 * Math.log(k) - 161.1195681661;
    b = k <= 19 ? 0 : 138.5177312231 * Math.log(k - 10) - 305.0447927307;
  } else {
    r = 329.698727446 * (k - 60) ** -0.1332047592;
    g = 288.1221695283 * (k - 60) ** -0.0755148492;
    b = 255;
  }

  if (kelvin > HEMI_BLUE_SATURATION_START) {
    const t = clamp(
      (kelvin - HEMI_BLUE_SATURATION_START) /
        (HEMI_BLUE_SATURATION_END - HEMI_BLUE_SATURATION_START),
      0,
      1,
    );
    const ease = t * t;
    r *= 1 - ease * 0.88;
    g *= 1 - ease * 0.6;
  }

  return {
    r: clamp(r, 0, 255) / 255,
    g: clamp(g, 0, 255) / 255,
    b: clamp(b, 0, 255) / 255,
  };
}

export function hemiGroundColor(
  sky: { r: number; g: number; b: number },
  sheltered = false,
): { r: number; g: number; b: number } {
  const lum = sheltered ? 0.24 : 0.3;
  const grey = sheltered ? 0.42 : 0.34;
  const gr = sky.r * lum;
  const gg = sky.g * lum;
  const gb = sky.b * lum;
  const avg = (gr + gg + gb) / 3;
  return {
    r: gr * (1 - grey) + avg * grey,
    g: gg * (1 - grey) + avg * grey,
    b: gb * (1 - grey) + avg * grey,
  };
}

export function positionFromAngles(
  azimuthDeg: number,
  elevationDeg: number,
  radius = SUN_BOWL_RADIUS,
): { x: number; y: number; z: number } {
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (clamp(elevationDeg, -89, 89) * Math.PI) / 180;
  return {
    x: radius * Math.cos(el) * Math.sin(az),
    y: radius * Math.sin(el),
    z: radius * Math.cos(el) * Math.cos(az),
  };
}

export function computeSkyNightBlend(
  nightness: number,
  sunFactor: number,
  moonFactor: number,
): number {
  const toggleBlend = smoothstep(0.25, 0.75, clamp(nightness, 0, 1));
  const daylightHold = sunFactor * (1 - toggleBlend);
  const moonLift = moonFactor * toggleBlend * 0.15;
  return clamp(toggleBlend * (1 - daylightHold * 0.55) + moonLift, 0, 1);
}

export function lerpColor(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
  t: number,
): { r: number; g: number; b: number } {
  return {
    r: lerp(a.r, b.r, t),
    g: lerp(a.g, b.g, t),
    b: lerp(a.b, b.b, t),
  };
}
