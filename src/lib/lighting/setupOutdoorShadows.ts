import {
  DirectionalLight,
  ShadowGenerator,
  type Mesh,
  type Scene,
} from "@babylonjs/core";
import "@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent";
import { FLOOR_PLATFORM_SIZE } from "@/lib/floor/floorAssets";

/** Mirrors GameEngine2 SceneEnvironment.configureSunShadowMap. */
const SUN_SHADOW_MAP_SIZE = 2048;
const SUN_SHADOW_BIAS = 0.00005;
const SUN_SHADOW_NORMAL_BIAS = 0.015;
const SUN_SHADOW_BLUR_KERNEL = 2;
const SUN_SHADOW_PADDING = 1;

/** Mirrors GameEngine2 MoonLightTuning.configureMoonShadow. */
const MOON_SHADOW_MAP_SIZE = 1536;
const MOON_SHADOW_BIAS = -0.00012;
const MOON_SHADOW_NORMAL_BIAS = 0;
const MOON_SHADOW_BLUR_KERNEL = 4;
const MOON_SHADOW_PADDING = 1;

/** Babylon darkness: 0 = full shadow, 1 = no shadow. */
function shadowDepthToDarkness(shadowDepth: number): number {
  return 1 - Math.min(1, Math.max(0, shadowDepth));
}

export type OutdoorShadows = {
  addCaster: (mesh: Mesh) => void;
  addReceiver: (mesh: Mesh) => void;
  /** Pre-compile PBR shadow variants once scene meshes exist. */
  prepareReceiverShaders: (meshes: Mesh[]) => Promise<void>;
  applyDirectionalShadows: (
    sunOn: boolean,
    moonOn: boolean,
    shadowDepth?: number,
  ) => void;
  syncFrusta: (sun: DirectionalLight, moon: DirectionalLight) => void;
  dispose: () => void;
};

function fitDirectionalShadowFrustum(
  light: DirectionalLight,
  platformSize: number,
  padding: number,
): void {
  const half = (platformSize / 2) * Math.SQRT2 + padding;
  light.autoUpdateExtends = false;
  light.autoCalcShadowZBounds = true;
  light.orthoLeft = -half;
  light.orthoRight = half;
  light.orthoTop = half;
  light.orthoBottom = -half;
}

function createDirectionalShadowGenerator(
  light: DirectionalLight,
  mapSize: number,
  darkness: number,
  bias: number,
  normalBias: number,
  blurKernel: number,
): ShadowGenerator {
  const generator = new ShadowGenerator(mapSize, light);
  generator.useBlurExponentialShadowMap = false;
  generator.useKernelBlur = blurKernel > 0;
  generator.blurKernel = blurKernel;
  generator.filter = ShadowGenerator.FILTER_PCF;
  generator.bias = bias;
  generator.normalBias = normalBias;
  generator.darkness = darkness;
  generator.transparencyShadow = true;
  generator.forceBackFacesOnly = false;
  return generator;
}

export function setupOutdoorShadows(
  scene: Scene,
  sun: DirectionalLight,
  moon: DirectionalLight,
): OutdoorShadows {
  scene.shadowsEnabled = true;

  // Keep both enabled so PBR shadow shader defines never change mid-transition.
  sun.shadowEnabled = true;
  moon.shadowEnabled = true;

  fitDirectionalShadowFrustum(sun, FLOOR_PLATFORM_SIZE, SUN_SHADOW_PADDING);
  fitDirectionalShadowFrustum(moon, FLOOR_PLATFORM_SIZE, MOON_SHADOW_PADDING);

  const sunShadow = createDirectionalShadowGenerator(
    sun,
    SUN_SHADOW_MAP_SIZE,
    shadowDepthToDarkness(1),
    SUN_SHADOW_BIAS,
    SUN_SHADOW_NORMAL_BIAS,
    SUN_SHADOW_BLUR_KERNEL,
  );
  const moonShadow = createDirectionalShadowGenerator(
    moon,
    MOON_SHADOW_MAP_SIZE,
    shadowDepthToDarkness(1),
    MOON_SHADOW_BIAS,
    MOON_SHADOW_NORMAL_BIAS,
    MOON_SHADOW_BLUR_KERNEL,
  );

  return {
    addCaster(mesh) {
      sunShadow.addShadowCaster(mesh, true);
      moonShadow.addShadowCaster(mesh, true);
    },
    addReceiver(mesh) {
      mesh.receiveShadows = true;
    },
    async prepareReceiverShaders(meshes) {
      await Promise.all([
        sunShadow.forceCompilationAsync(),
        moonShadow.forceCompilationAsync(),
      ]);
      const compiledMaterials = new Set<Mesh["material"]>();
      for (const mesh of meshes) {
        if (!mesh.receiveShadows) {
          continue;
        }
        const material = mesh.material;
        if (!material || compiledMaterials.has(material)) {
          continue;
        }
        compiledMaterials.add(material);
        await material.forceCompilationAsync(mesh, { clipPlane: false });
      }
    },
    applyDirectionalShadows(sunOn, moonOn, shadowDepth = 1) {
      const darkness = shadowDepthToDarkness(shadowDepth);
      sunShadow.setDarkness(sunOn ? darkness : 1);
      moonShadow.setDarkness(moonOn ? darkness : 1);
    },
    syncFrusta(sunLight, moonLight) {
      fitDirectionalShadowFrustum(sunLight, FLOOR_PLATFORM_SIZE, SUN_SHADOW_PADDING);
      fitDirectionalShadowFrustum(moonLight, FLOOR_PLATFORM_SIZE, MOON_SHADOW_PADDING);
    },
    dispose() {
      sunShadow.dispose();
      moonShadow.dispose();
    },
  };
}
