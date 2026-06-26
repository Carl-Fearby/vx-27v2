import { Color3, type HemisphericLight } from "@babylonjs/core";
import { clamp, kelvinToRgb } from "@/lib/lighting/tuning";

export type HemisphereSettings = {
  temperature: number;
  intensity: number;
};

/** GameEngine2 `HemisphereTuning.hemiGroundCoupling` — open arena. */
function hemiGroundCoupling(options: { sheltered?: boolean; indoor?: boolean } = {}) {
  if (options.indoor) {
    return { lum: 0.82, grey: 0.18 };
  }
  if (options.sheltered) {
    return { lum: 0.24, grey: 0.42 };
  }
  return { lum: 0.42, grey: 0.3 };
}

/** GameEngine2 `applyHemisphereSettings`. */
export function applyHemisphereSettings(
  hemi: HemisphericLight,
  settings: HemisphereSettings,
  options: { sheltered?: boolean; indoor?: boolean } = {},
) {
  const rgb = kelvinToRgb(settings.temperature);
  hemi.diffuse = new Color3(rgb.r, rgb.g, rgb.b);

  const { lum, grey } = hemiGroundCoupling(options);
  const gr = rgb.r * lum;
  const gg = rgb.g * lum;
  const gb = rgb.b * lum;
  const avg = (gr + gg + gb) / 3;
  hemi.groundColor = new Color3(
    gr * (1 - grey) + avg * grey,
    gg * (1 - grey) + avg * grey,
    gb * (1 - grey) + avg * grey,
  );
  hemi.intensity = clamp(settings.intensity, 0, 1.5);
}
