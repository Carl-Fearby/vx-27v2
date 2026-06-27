import { Color3, type DirectionalLight, type Scene } from "@babylonjs/core";
import { clamp, lerp, lerpColor } from "@/lib/lighting/tuning";

/** GameEngine2 `createOutdoorLights` open-arena day values. */
const DAY_AMBIENT_COLOR = { r: 0xd0 / 255, g: 0xdc / 255, b: 0xe8 / 255 };
const DAY_AMBIENT_INTENSITY = 0.14;
const DAY_FILL_COLOR = { r: 0xc8 / 255, g: 0xd4 / 255, b: 0xe8 / 255 };
const DAY_FILL_INTENSITY = 0.48;
const DAY_WEST_FILL_COLOR = { r: 0xb8 / 255, g: 0xc8 / 255, b: 0xe0 / 255 };
const DAY_WEST_FILL_INTENSITY = 0.32;

/** GameEngine2 `nightLightStateFromDay` open arena. */
const NIGHT_AMBIENT_COLOR = { r: 0x40 / 255, g: 0x50 / 255, b: 0x68 / 255 };
const NIGHT_FILL_COLOR = { r: 0x28 / 255, g: 0x38 / 255, b: 0x50 / 255 };
const NIGHT_AMB_MULT = 0.12;
const NIGHT_FILL_MULT = 0.06;

function toColor3(rgb: { r: number; g: number; b: number }): Color3 {
  return new Color3(rgb.r, rgb.g, rgb.b);
}

export type OutdoorFillLightsState = {
  fill: DirectionalLight;
  westFill: DirectionalLight;
  applyNightness: (nightness: number, sheltered?: boolean) => void;
};

export function createOutdoorFillLightsState(
  scene: Scene,
  fill: DirectionalLight,
  westFill: DirectionalLight,
): OutdoorFillLightsState {
  fill.specular = Color3.Black();
  westFill.specular = Color3.Black();

  const applyNightness = (nightness: number, sheltered = false) => {
    const t = clamp(nightness, 0, 1);
    const fillMult = sheltered ? 0.035 : NIGHT_FILL_MULT;
    const ambMult = sheltered ? 0.09 : NIGHT_AMB_MULT;

    const ambientColor = lerpColor(DAY_AMBIENT_COLOR, NIGHT_AMBIENT_COLOR, t);
    const ambientIntensity = lerp(
      DAY_AMBIENT_INTENSITY,
      DAY_AMBIENT_INTENSITY * ambMult,
      t,
    );
    scene.ambientColor = toColor3(ambientColor).scale(ambientIntensity);

    const fillColor = lerpColor(DAY_FILL_COLOR, NIGHT_FILL_COLOR, t);
    fill.intensity = lerp(DAY_FILL_INTENSITY, DAY_FILL_INTENSITY * fillMult, t);
    fill.diffuse = toColor3(fillColor);

    const westColor = lerpColor(DAY_WEST_FILL_COLOR, NIGHT_FILL_COLOR, t);
    westFill.intensity = lerp(
      DAY_WEST_FILL_INTENSITY,
      DAY_WEST_FILL_INTENSITY * fillMult,
      t,
    );
    westFill.diffuse = toColor3(westColor);
  };

  applyNightness(0, false);

  return { fill, westFill, applyNightness };
}

/** GameEngine2 FpsGame shadow handoff — one directional key light during overlap. */
let lastDualShadowCaster: "sun" | "moon" = "sun";

export function resolveSunMoonShadowCasters(
  sunIntensity: number,
  moonIntensity: number,
): { sun: boolean; moon: boolean } {
  const sunOn = sunIntensity > 0.001;
  const moonOn = moonIntensity > 0.001;
  if (!sunOn && !moonOn) {
    return { sun: false, moon: false };
  }
  if (sunOn && !moonOn) {
    lastDualShadowCaster = "sun";
    return { sun: true, moon: false };
  }
  if (!sunOn && moonOn) {
    lastDualShadowCaster = "moon";
    return { sun: false, moon: true };
  }

  const ratio = sunIntensity / Math.max(moonIntensity, 1e-6);
  if (ratio > 1.12) {
    lastDualShadowCaster = "sun";
    return { sun: true, moon: false };
  }
  if (ratio < 0.88) {
    lastDualShadowCaster = "moon";
    return { sun: false, moon: true };
  }
  return lastDualShadowCaster === "sun"
    ? { sun: true, moon: false }
    : { sun: false, moon: true };
}
