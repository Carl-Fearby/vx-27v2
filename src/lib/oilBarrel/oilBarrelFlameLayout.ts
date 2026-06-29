import type { OilBarrelFireTuning } from "@/lib/oilBarrel/oilBarrelTuning";

/** Looped flames — shipped clip is 540×304 (landscape). GE2 OilBarrelInteriorVideo.js */
export const OIL_BARREL_VIDEO_ASPECT = 540 / 304;
/** Bottom edge sits this far above the interior floor (m). */
export const OIL_BARREL_VIDEO_FLOOR_LIFT = 0.04;

export type InteriorFlameLayout = {
  width: number;
  height: number;
  x: number;
  y: number;
  z: number;
  layoutBottomY: number;
  layoutTopY: number;
};

export function computeInteriorFireCenterX(tuning: OilBarrelFireTuning): number {
  return tuning.interiorVideoCenterOffsetX + tuning.interiorFireOffsetX;
}

/** Port of GE2 `computeInteriorFlameLayout`. */
export function computeInteriorFlameLayout(
  innerRadius: number,
  floorY: number,
  rimY: number,
  tuning: OilBarrelFireTuning,
  videoAspect = OIL_BARREL_VIDEO_ASPECT,
  floorLift = OIL_BARREL_VIDEO_FLOOR_LIFT,
): InteriorFlameLayout {
  const widthScale = tuning.interiorVideoWidthScale;
  const heightScale = tuning.interiorVideoHeightScale;
  const maxWidth = innerRadius * 2.08 * widthScale;
  const offsetY = tuning.interiorVideoCenterOffsetY;
  const x = computeInteriorFireCenterX(tuning);

  const bottomY = floorY + floorLift;
  const topY = rimY + 0.03;
  let height = (topY - bottomY) * heightScale;
  let width = height * videoAspect * widthScale;
  if (width > maxWidth) {
    width = maxWidth;
  }

  const layoutBottomY = bottomY;
  const layoutTopY = bottomY + height;

  return {
    width,
    height,
    x,
    y: bottomY + height * 0.5 + offsetY,
    z: 0,
    layoutBottomY,
    layoutTopY,
  };
}
