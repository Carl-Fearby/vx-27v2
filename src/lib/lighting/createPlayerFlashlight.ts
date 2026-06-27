import {
  Color3,
  Light,
  ShadowGenerator,
  SpotLight,
  TransformNode,
  Vector3,
  type Camera,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
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
/** Right-hand torch anchors in normalized viewport space (0=left, 1=right). */
const TORCH_RAISED_VIEWPORT_X = 0.75;
const TORCH_RAISED_VIEWPORT_Y = 0.54;
/** Lowered torch anchor — same X as raised; only vertical travel on arm. */
const TORCH_LOWERED_VIEWPORT_X = 0.75;
const TORCH_LOWERED_VIEWPORT_Y = 0.82;
const FLICKER_ARM_DURATION_MS = 620;
const FLICKER_SMOOTH_SPEED = 42;
const FLICKER_IDLE_MIN_MS = 10000;
const FLICKER_IDLE_MAX_MS = 20000;
const FLASHLIGHT_SHADOW_MAP_SIZE = 1024;
const FLASHLIGHT_SHADOW_BIAS = 0.0006;
const FLASHLIGHT_SHADOW_NORMAL_BIAS = 0.035;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, blend: number): number {
  return from + (to - from) * blend;
}

function smoothStep(value: number): number {
  const blend = clamp01(value);
  return blend * blend * (3 - 2 * blend);
}

export type PlayerFlashlight = {
  syncFromGameCore(
    gameCore: GameCoreInstance,
    camera: Camera,
    nightness: number,
  ): void;
  applyTuning(tuning: FlashlightTuning): void;
  prepareShadowShaders(meshes: Mesh[]): Promise<void>;
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
  light.falloffType = Light.FALLOFF_GLTF;
  light.range = HOTSPOT_DISTANCE;
  light.shadowEnabled = true;
  light.shadowMinZ = 0.05;
  light.shadowMaxZ = HOTSPOT_DISTANCE;
  light.includedOnlyMeshes = worldMeshes;
  light.projectionTextureLightNear = 0.04;
  light.projectionTextureLightFar = HOTSPOT_DISTANCE;

  const shadowGenerator = new ShadowGenerator(
    FLASHLIGHT_SHADOW_MAP_SIZE,
    light,
  );
  shadowGenerator.useKernelBlur = true;
  shadowGenerator.blurKernel = 2;
  shadowGenerator.filter = ShadowGenerator.FILTER_PCF;
  shadowGenerator.bias = FLASHLIGHT_SHADOW_BIAS;
  shadowGenerator.normalBias = FLASHLIGHT_SHADOW_NORMAL_BIAS;
  shadowGenerator.darkness = 0.42;
  shadowGenerator.transparencyShadow = true;

  for (const mesh of worldMeshes) {
    if (mesh.name === "platform") {
      continue;
    }
    shadowGenerator.addShadowCaster(mesh, true);
  }

  let tuning: FlashlightTuning = { ...DEFAULT_FLASHLIGHT_TUNING };
  let projectionTexture!: ReturnType<typeof createFlashlightRingProjectionTexture>;

  const applySpotAngles = () => {
    const angleRad = (tuning.spreadAngleDeg * Math.PI) / 180;
    const penumbra = Math.min(1, Math.max(0, tuning.penumbra));
    light.angle = angleRad;
    // glTF inner/outer cone — penumbra 0 = sharp rim, 1 = soft spill (PBR needs FALLOFF_GLTF).
    light.innerAngle = angleRad * (1 - penumbra);
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
  let prevRaiseBlend = 0;
  let armFlickerActive = false;
  let armFlickerStartMs = 0;
  let armFlickerEndMs = 0;
  let flickerTarget = 1;
  let flickerDisplay = 1;
  let lastFlickerSmoothMs = 0;
  let nextFlickerFlipMs = 0;
  let nextIdleFlickerMs = 0;
  let wasBeamOff = true;
  let wasFlickerActive = false;
  const forward = new Vector3();
  const right = new Vector3();
  const up = new Vector3();
  const origin = new Vector3();
  const aimPoint = new Vector3();
  const torchDepth = MUZZLE_FORWARD + HIP_FORWARD_EXTRA;

  const aimBeam = (camera: Camera, raiseBlend: number) => {
    camera.getDirectionToRef(Vector3.Forward(), forward);
    camera.getDirectionToRef(Vector3.Right(), right);
    camera.getDirectionToRef(Vector3.Up(), up);

    const raised = smoothStep(raiseBlend);
    const viewportX = lerp(
      TORCH_LOWERED_VIEWPORT_X,
      TORCH_RAISED_VIEWPORT_X,
      raised,
    );
    const viewportY = lerp(
      TORCH_LOWERED_VIEWPORT_Y,
      TORCH_RAISED_VIEWPORT_Y,
      raised,
    );
    const halfHeight = torchDepth * Math.tan(camera.fov / 2);
    const halfWidth = halfHeight * scene.getEngine().getAspectRatio(camera);
    const offsetX = (viewportX - 0.5) * 2 * halfWidth;
    const offsetY = (0.5 - viewportY) * 2 * halfHeight;

    origin
      .copyFrom(camera.position)
      .addInPlace(forward.scale(torchDepth))
      .addInPlace(right.scale(offsetX))
      .addInPlace(up.scale(offsetY));

    aimPoint.copyFrom(camera.position).addInPlace(
      forward.scale(HOTSPOT_TARGET_DISTANCE),
    );

    light.position.copyFrom(origin);
    target.position.copyFrom(aimPoint);
    light.setDirectionToTarget(aimPoint);
  };

  const pickFaultLevel = (): number => {
    const roll = Math.random();
    if (roll < 0.46) return 0;
    if (roll < 0.6) return Math.random() * 0.1;
    if (roll < 0.82) return 0.82 + Math.random() * 0.18;
    return 0.38 + Math.random() * 0.28;
  };

  const pickNextFlipDelayMs = (): number => {
    if (Math.random() < 0.12) {
      return 48 + Math.random() * 28;
    }
    return 22 + Math.random() * 34;
  };

  const pickIdleFlickerDelayMs = (): number =>
    FLICKER_IDLE_MIN_MS +
    Math.random() * (FLICKER_IDLE_MAX_MS - FLICKER_IDLE_MIN_MS);

  const scheduleNextIdleFlicker = (fromMs: number) => {
    nextIdleFlickerMs = fromMs + pickIdleFlickerDelayMs();
  };

  const isBeamStableOn = (intensity: number, raiseBlend: number): boolean =>
    intensity > 0.08 && raiseBlend > 0.92;

  const beginFaultFlicker = (nowMs: number) => {
    armFlickerActive = true;
    armFlickerStartMs = nowMs;
    armFlickerEndMs = nowMs + FLICKER_ARM_DURATION_MS;
    lastFlickerSmoothMs = nowMs;
    nextFlickerFlipMs = nowMs;
    flickerTarget = 0;
    flickerDisplay = 0;
  };

  const applyFaultFlicker = (
    intensity: number,
    raiseBlend: number,
  ): number => {
    prevRaiseBlend = raiseBlend;

    if (intensity <= 0) {
      armFlickerActive = false;
      flickerDisplay = 1;
      flickerTarget = 1;
      return intensity;
    }

    const nowMs = performance.now();
    if (!armFlickerActive || nowMs >= armFlickerEndMs) {
      armFlickerActive = false;
      flickerDisplay = 1;
      flickerTarget = 1;
      return intensity;
    }

    const deltaSec = Math.min(
      0.05,
      (nowMs - lastFlickerSmoothMs) / 1000 || 1 / 60,
    );
    lastFlickerSmoothMs = nowMs;

    if (nowMs >= nextFlickerFlipMs) {
      flickerTarget = pickFaultLevel();
      nextFlickerFlipMs = nowMs + pickNextFlipDelayMs();
    }

    flickerDisplay += (flickerTarget - flickerDisplay) *
      Math.min(1, FLICKER_SMOOTH_SPEED * deltaSec);

    const flickerElapsed =
      (nowMs - armFlickerStartMs) / (armFlickerEndMs - armFlickerStartMs);
    const faultMix = 1 - smoothStep((flickerElapsed - 0.6) / 0.4);
    return intensity * lerp(1, flickerDisplay, faultMix);
  };

  const tickIdleFlicker = (
    nowMs: number,
    baseIntensity: number,
    raiseBlend: number,
  ) => {
    if (!isBeamStableOn(baseIntensity, raiseBlend)) {
      return;
    }

    if (armFlickerActive) {
      return;
    }

    if (nextIdleFlickerMs === 0) {
      scheduleNextIdleFlicker(nowMs);
      return;
    }

    if (nowMs >= nextIdleFlickerMs) {
      beginFaultFlicker(nowMs);
      nextIdleFlickerMs = 0;
    }
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
      const baseIntensity = beam[0] * tuning.intensityMultiplier;
      const beamOff = baseIntensity <= 0.05 && beam[1] <= 0.001;
      const nowMs = performance.now();

      if (wasBeamOff && !beamOff) {
        beginFaultFlicker(nowMs);
        nextIdleFlickerMs = 0;
      }
      wasBeamOff = beamOff;

      light.shadowEnabled = !beamOff;
      light.intensity = applyFaultFlicker(baseIntensity, beam[1]);

      if (!beamOff && wasFlickerActive && !armFlickerActive) {
        scheduleNextIdleFlicker(nowMs);
      }
      wasFlickerActive = armFlickerActive;

      if (beamOff) {
        prevRaiseBlend = 0;
        armFlickerActive = false;
        nextIdleFlickerMs = 0;
        wasBeamOff = true;
        wasFlickerActive = false;
        return;
      }

      tickIdleFlicker(nowMs, baseIntensity, beam[1]);

      aimBeam(camera, beam[1]);
    },
    async prepareShadowShaders(meshes) {
      shadowGenerator.forceCompilation();
      const compiledMaterials = new Set<Mesh["material"]>();
      await Promise.all(
        meshes.map((mesh) => {
          const material = mesh.material;
          if (!material || compiledMaterials.has(material)) {
            return Promise.resolve();
          }
          compiledMaterials.add(material);
          return material.forceCompilationAsync(mesh, { clipPlane: false });
        }),
      );
    },
    dispose() {
      shadowGenerator.dispose();
      light.projectionTexture = null;
      projectionTexture?.dispose();
      light.dispose();
      target.dispose();
    },
  };
}
