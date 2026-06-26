import {
  Color3,
  SpotLight,
  TransformNode,
  Vector3,
  type Camera,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import type { GameCoreInstance } from "@/lib/gameCore";
import { createFlashlightRingProjectionTexture } from "@/lib/lighting/celestialTextures";
import {
  DEFAULT_FLASHLIGHT_TUNING,
  type FlashlightTuning,
} from "@/lib/lighting/flashlightTuning";

/** Mirrors GameEngine2 `WeaponFlashlight.js`. */
const HOTSPOT_COLOR = new Color3(1, 0.949, 0.863); // 0xfff2dc
const HOTSPOT_DISTANCE = 22;
const HOTSPOT_TARGET_DISTANCE = HOTSPOT_DISTANCE * 0.85;
const MUZZLE_FORWARD = 0.12;
const HIP_FORWARD_EXTRA = 0.32;

export type PlayerFlashlight = {
  syncFromGameCore(
    gameCore: GameCoreInstance,
    camera: Camera,
    nightness: number,
  ): void;
  applyTuning(tuning: FlashlightTuning): void;
  dispose(): void;
};

export function createPlayerFlashlight(
  scene: Scene,
  worldMeshes: Mesh[],
): PlayerFlashlight {
  const target = new TransformNode("flashlightTarget", scene);
  const light = new SpotLight(
    "flashlight",
    Vector3.Zero(),
    Vector3.Forward(),
    (DEFAULT_FLASHLIGHT_TUNING.spreadAngleDeg * Math.PI) / 180,
    2,
    scene,
  );
  light.diffuse = HOTSPOT_COLOR.clone();
  light.specular = Color3.Black();
  light.intensity = 0;
  light.range = HOTSPOT_DISTANCE;
  light.shadowEnabled = false;
  light.includedOnlyMeshes = worldMeshes;
  light.projectionTextureLightNear = 0.04;
  light.projectionTextureLightFar = HOTSPOT_DISTANCE;

  let tuning: FlashlightTuning = { ...DEFAULT_FLASHLIGHT_TUNING };
  let projectionTexture!: ReturnType<typeof createFlashlightRingProjectionTexture>;

  const applySpotAngles = () => {
    const angleRad = (tuning.spreadAngleDeg * Math.PI) / 180;
    light.angle = angleRad;
    light.innerAngle = angleRad * (1 - tuning.penumbra);
  };

  const applyRingProjection = () => {
    projectionTexture?.dispose();
    projectionTexture = createFlashlightRingProjectionTexture(
      tuning.ringThickness,
      tuning.haloWidth,
      tuning.haloBrightness,
    );
    const projectionScale = 1 / Math.max(0.3, tuning.haloWidth * 0.42);
    projectionTexture.uScale = projectionScale;
    projectionTexture.vScale = projectionScale;
    light.projectionTexture = projectionTexture;
  };

  applySpotAngles();
  applyRingProjection();

  const beam = new Float32Array(2);
  const forward = new Vector3();
  const origin = new Vector3();
  const targetPosition = new Vector3();
  const forwardOffset = MUZZLE_FORWARD + HIP_FORWARD_EXTRA;

  const aimBeam = (camera: Camera) => {
    camera.getDirectionToRef(Vector3.Forward(), forward);
    origin.copyFrom(camera.position).addInPlace(forward.scale(forwardOffset));
    targetPosition.copyFrom(origin).addInPlace(
      forward.scale(HOTSPOT_TARGET_DISTANCE),
    );
    light.position.copyFrom(origin);
    target.position.copyFrom(targetPosition);
    light.setDirectionToTarget(target.position);
  };

  return {
    applyTuning(next) {
      const ringChanged =
        next.ringThickness !== tuning.ringThickness ||
        next.haloWidth !== tuning.haloWidth ||
        next.haloBrightness !== tuning.haloBrightness;
      tuning = next;
      applySpotAngles();
      if (ringChanged) {
        applyRingProjection();
      }
    },
    syncFromGameCore(gameCore, camera, _nightness) {
      gameCore.write_flashlight_beam(_nightness, beam);
      light.intensity = beam[0] * tuning.intensityMultiplier;

      if (beam[0] <= 0.05) {
        return;
      }

      aimBeam(camera);
    },
    dispose() {
      light.projectionTexture = null;
      projectionTexture?.dispose();
      light.dispose();
      target.dispose();
    },
  };
}
