import {
  Color3,
  PointLight,
  Scene,
  TransformNode,
  Vector3,
} from "@babylonjs/core";

import {
  attachCandleFlickerLight,
  deriveBarrelFlickerSeeds,
  OIL_BARREL_FLICKER_OPTS,
  updateCandleFlicker,
} from "@/lib/oilBarrel/candleFlicker";
import { computeInteriorFlameLayout } from "@/lib/oilBarrel/oilBarrelFlameLayout";
import type { OilBarrelFireTuning } from "@/lib/oilBarrel/oilBarrelTuning";

const FIRE_LIGHT_COLOR = new Color3(1, 0.6, 0.133);
const FIRE_LIGHT_DISTANCE = 6;
const FIRE_LIGHT_KEY_RIM_LIFT = 0.42;
const FIRE_LIGHT_FILL_RIM_LIFT = 0.1;
const FIRE_LIGHT_SHADOW_SIDE_INTENSITY_FACTOR = 0.55;
const FIRE_LIGHT_OUTDOOR_FILL_SIDE_INTENSITY_FACTOR = 0.36;

export const OIL_BARREL_FIRE_LIGHT_RIG_NAME = "oil_barrel_fire_lights";
const FIRE_LIGHT_NAME_L = "oil_barrel_fire_light_l";
const FIRE_LIGHT_NAME_R = "oil_barrel_fire_light_r";

function perSideFireLightIntensity(tuning: OilBarrelFireTuning, side: -1 | 1): number {
  const total = tuning.interiorFireLightIntensity;
  if (side > 0) {
    return total * FIRE_LIGHT_OUTDOOR_FILL_SIDE_INTENSITY_FACTOR;
  }
  return total * FIRE_LIGHT_SHADOW_SIDE_INTENSITY_FACTOR;
}

function getFireLightSideOffset(
  tuning: OilBarrelFireTuning,
  side: -1 | 1,
): { x: number; y: number; z: number } {
  const darkSide = side < 0;
  return {
    x: darkSide ? tuning.interiorFireLightLeftX : tuning.interiorFireLightRightX,
    y: darkSide ? tuning.interiorFireLightLeftY : tuning.interiorFireLightRightY,
    z: 0,
  };
}

function applyFireLightSidePositions(
  rig: TransformNode,
  tuning: OilBarrelFireTuning,
  layoutTopY: number,
  layoutBottomY: number,
): void {
  const span = Math.max(0.05, layoutTopY - layoutBottomY);
  const keyLift = span * FIRE_LIGHT_KEY_RIM_LIFT;
  const fillLift = span * FIRE_LIGHT_FILL_RIM_LIFT;

  for (const child of rig.getChildren()) {
    if (!(child instanceof PointLight)) continue;
    const side =
      (child.metadata?.fireLightSide as -1 | 1 | undefined) ??
      (child.name === FIRE_LIGHT_NAME_L ? -1 : 1);
    const offset = getFireLightSideOffset(tuning, side);
    const lift = side <= 0 ? keyLift : fillLift;
    child.position.set(offset.x, offset.y + lift, offset.z);
    const flicker = child.metadata?.candleFlicker as
      | { basePositionY: number | null }
      | undefined;
    if (flicker && flicker.basePositionY != null) {
      flicker.basePositionY = child.position.y;
    }
  }
}

function createFireLightSide(
  scene: Scene,
  rig: TransformNode,
  side: -1 | 1,
  intensity: number,
): PointLight {
  const light = new PointLight(
    side < 0 ? FIRE_LIGHT_NAME_L : FIRE_LIGHT_NAME_R,
    Vector3.Zero(),
    scene,
  );
  light.diffuse = FIRE_LIGHT_COLOR.clone();
  light.specular = FIRE_LIGHT_COLOR.clone();
  light.intensity = intensity;
  light.range = FIRE_LIGHT_DISTANCE;
  light.parent = rig;
  light.metadata = {
    ...light.metadata,
    isOilBarrelFireLight: true,
    fireLightSide: side,
  };
  return light;
}

export function addOilBarrelFireLight(
  scene: Scene,
  barrelGroup: TransformNode,
  innerRadius: number,
  floorY: number,
  rimY: number,
  tuning: OilBarrelFireTuning,
  barrelSeed: number,
): TransformNode | null {
  if (!tuning.interiorFire) {
    return null;
  }

  const layout = computeInteriorFlameLayout(innerRadius, floorY, rimY, tuning);
  const rig = new TransformNode(OIL_BARREL_FIRE_LIGHT_RIG_NAME, scene);
  rig.parent = barrelGroup;
  rig.position.set(layout.x, layout.y, layout.z);
  rig.metadata = {
    ...rig.metadata,
    isOilBarrelFireLightRig: true,
  };

  const left = createFireLightSide(
    scene,
    rig,
    -1,
    perSideFireLightIntensity(tuning, -1),
  );
  const right = createFireLightSide(
    scene,
    rig,
    1,
    perSideFireLightIntensity(tuning, 1),
  );

  applyFireLightSidePositions(
    rig,
    tuning,
    layout.layoutTopY,
    layout.layoutBottomY,
  );

  attachCandleFlickerLight(
    left,
    OIL_BARREL_FLICKER_OPTS,
    deriveBarrelFlickerSeeds(barrelSeed, -1),
  );
  attachCandleFlickerLight(
    right,
    OIL_BARREL_FLICKER_OPTS,
    deriveBarrelFlickerSeeds(barrelSeed, 1),
  );

  return rig;
}

export function collectOilBarrelFireLights(root: TransformNode): PointLight[] {
  const lights: PointLight[] = [];
  const visit = (node: TransformNode) => {
    for (const child of node.getChildren()) {
      if (
        child instanceof PointLight &&
        child.metadata?.isOilBarrelFireLight === true
      ) {
        lights.push(child);
      }
      if (child instanceof TransformNode) {
        visit(child);
      }
    }
  };
  visit(root);
  return lights;
}

export function tickOilBarrelFireLights(
  root: TransformNode,
  timeSec: number,
): void {
  updateCandleFlicker(collectOilBarrelFireLights(root), timeSec);
}
