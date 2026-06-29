export const OIL_BARREL_MODEL_URL = "/models/assets/oil-barrel.glb";
export const OIL_BARREL_OVERLAY_URL = "/models/assets/oil-barrel.overlay.json";

export function isOilBarrelModelPath(modelPath: string): boolean {
  return /oil[-_]barrel(?:[._-]|$)/i.test(modelPath);
}

export const OIL_BARREL_FIRE_VIDEO_URLS = [
  "/textures/oil_barrel/inside/oil_can_interior_color.mp4?v=fire-alpha-looped",
  "/textures/oil_barrel/inside/oil_can_interior_alpha.mp4?v=fire-alpha-looped",
] as const;
