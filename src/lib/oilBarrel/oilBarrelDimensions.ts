import { TransformNode } from "@babylonjs/core";

import type { OilBarrelOverlayDimensions } from "@/lib/oilBarrel/overlayPackage";

const FLOOR_LIFT = 0.003;
const RIM_BEVEL = 0.014;

/**
 * Read interior wall / floor meshes baked into the exported GLB so fire placement
 * matches the barrel geometry (GE2 overlay constants drift after export).
 */
export function deriveOilBarrelDimensionsFromBarrelRoot(
  barrelRoot: TransformNode,
): OilBarrelOverlayDimensions | null {
  const wall = barrelRoot
    .getChildMeshes(false)
    .find((mesh) => mesh.name === "oil_interior_wall");
  if (!wall) {
    return null;
  }

  wall.refreshBoundingInfo(true, false);
  const bounds = wall.getBoundingInfo().boundingBox;
  const localMin = bounds.minimum;
  const localMax = bounds.maximum;

  const innerRadius = Math.max(
    Math.max(Math.abs(localMin.x), Math.abs(localMax.x)),
    Math.max(Math.abs(localMin.z), Math.abs(localMax.z)),
  );
  const floorY = localMin.y + FLOOR_LIFT;
  const clipTopY = localMax.y - RIM_BEVEL;
  const innerWallHeight = localMax.y - localMin.y;

  if (
    !Number.isFinite(innerRadius) ||
    innerRadius <= 0 ||
    innerWallHeight <= 0
  ) {
    return null;
  }

  return {
    innerRadius,
    floorY,
    clipTopY,
    innerWallHeight,
  };
}

export function resolveOilBarrelOverlayDimensions(
  barrelRoot: TransformNode,
  fallback: OilBarrelOverlayDimensions,
): OilBarrelOverlayDimensions {
  return deriveOilBarrelDimensionsFromBarrelRoot(barrelRoot) ?? fallback;
}
