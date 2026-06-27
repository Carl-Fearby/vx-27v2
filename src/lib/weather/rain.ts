import {
  Color3,
  LinesMesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  TransformNode,
  Vector3,
  type Camera,
} from "@babylonjs/core";

export const RAIN_INTENSITY_MIN = 0.05;
export const RAIN_INTENSITY_MAX = 5;
export const RAIN_INTENSITY_STEP = 0.05;
export const DEFAULT_RAIN_INTENSITY = 1.25;

const PARTICLE_COUNT = 620;
const PARTICLE_BASE = 420;
const BOX_HALF_W = 18;
const BOX_HALF_H = 14;
const BOX_HALF_D = 18;
const STREAK_LENGTH = 2.25;
const FALL_SPEED = 58;
const WIND_X = -5.4;
const WIND_Z = -2.1;
const WEATHER_FADE_SEC = 5;
const RAIN_RENDERING_GROUP = 2;

export type RainSystem = {
  root: TransformNode;
  mesh: LinesMesh;
  lines: Vector3[][];
  positions: Float32Array;
  fade: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/** Ease rain wetness so highlights grow in gradually, not as a linear pop. */
function wetnessCurve(fade: number): number {
  const t = clamp(fade, 0, 1);
  return t * t * (3 - 2 * t);
}

/** Floor fill lights must stay off while wet so only the sun key lights the gloss. */
export function floorWetnessNeedsFillExclusion(fade: number): boolean {
  return wetnessCurve(fade) > 0.02;
}

function randomSigned(range: number): number {
  return (Math.random() * 2 - 1) * range;
}

function respawnParticle(rain: RainSystem, index: number, nearTop = true) {
  const base = index * 3;
  rain.positions[base] = randomSigned(BOX_HALF_W);
  rain.positions[base + 1] = nearTop
    ? BOX_HALF_H - Math.random() * 4
    : randomSigned(BOX_HALF_H);
  rain.positions[base + 2] = randomSigned(BOX_HALF_D);
}

function syncLineFromPosition(rain: RainSystem, index: number) {
  const base = index * 3;
  const x = rain.positions[base];
  const y = rain.positions[base + 1];
  const z = rain.positions[base + 2];
  const line = rain.lines[index];
  line[0].set(x, y, z);
  line[1].set(x - 0.34, y - STREAK_LENGTH, z - 0.14);
}

export function createRainSystem(scene: Scene): RainSystem {
  const root = new TransformNode("rain_root", scene);
  const positions = new Float32Array(PARTICLE_COUNT * 3);
  const lines: Vector3[][] = [];
  const rain = {
    root,
    mesh: null as unknown as LinesMesh,
    lines,
    positions,
    fade: 0,
  };

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    respawnParticle(rain, i, false);
    const base = i * 3;
    const x = positions[base];
    const y = positions[base + 1];
    const z = positions[base + 2];
    lines.push([
      new Vector3(x, y, z),
      new Vector3(x - 0.34, y - STREAK_LENGTH, z - 0.14),
    ]);
  }

  const mesh = MeshBuilder.CreateLineSystem(
    "rain_streaks",
    { lines, updatable: true },
    scene,
  );
  mesh.parent = root;
  mesh.color = new Color3(0.72, 0.86, 1);
  mesh.alpha = 0;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = RAIN_RENDERING_GROUP;
  root.setEnabled(false);
  rain.mesh = mesh;
  return rain;
}

type FloorWetMetadata = {
  dryAlbedo?: Color3;
};

function cacheDryAlbedo(material: PBRMaterial): Color3 {
  const meta = (material.metadata ?? {}) as FloorWetMetadata;
  if (!meta.dryAlbedo) {
    meta.dryAlbedo = material.albedoColor.clone();
    material.metadata = meta;
  }
  return meta.dryAlbedo;
}

function restoreDryAlbedo(material: PBRMaterial) {
  const dry = (material.metadata as FloorWetMetadata | null)?.dryAlbedo;
  if (dry) {
    material.albedoColor = dry.clone();
  }
}

export function applyRainWetnessToFloor(
  material: PBRMaterial | undefined,
  fade: number,
) {
  if (!material) {
    return;
  }

  const wetness = wetnessCurve(fade);

  if (wetness <= 0.001) {
    cacheDryAlbedo(material);
    restoreDryAlbedo(material);
    material.useRoughnessFromMetallicTextureGreen = true;
    material.roughness = 1;
    material.metallic = 0;
    material.specularIntensity = 1;
    material.environmentIntensity = 0;
    material.clearCoat.isEnabled = false;
    material.clearCoat.intensity = 0;
    return;
  }

  const dryAlbedo = cacheDryAlbedo(material);
  // Wet pavement: darker + broadly glossy — not a clear-coat sun strip.
  material.albedoColor = dryAlbedo.scale(1 - 0.22 * wetness);
  material.useRoughnessFromMetallicTextureGreen = false;
  material.roughness = 1 - 0.84 * wetness;
  material.metallic = 0;
  material.specularIntensity = 0.88;
  material.environmentIntensity = 0;
  material.clearCoat.isEnabled = false;
  material.clearCoat.intensity = 0;
}

export function updateRainSystem(
  rain: RainSystem,
  camera: Camera,
  deltaSeconds: number,
  options: {
    enabled: boolean;
    intensity: number;
  },
) {
  const targetFade = options.enabled ? 1 : 0;
  const fadeStep = Math.max(0, deltaSeconds) / WEATHER_FADE_SEC;
  rain.fade =
    targetFade > rain.fade
      ? Math.min(targetFade, rain.fade + fadeStep)
      : Math.max(targetFade, rain.fade - fadeStep);

  if (rain.fade <= 0.008) {
    rain.root.setEnabled(false);
    rain.mesh.alpha = 0;
    return;
  }

  const intensity = clamp(
    options.intensity,
    RAIN_INTENSITY_MIN,
    RAIN_INTENSITY_MAX,
  );
  const visibleCount = Math.min(
    PARTICLE_COUNT,
    Math.max(1, Math.round(PARTICLE_BASE * intensity * rain.fade)),
  );
  const fallMul = (0.4 + intensity * 0.52) * Math.max(0.12, rain.fade);
  const fall = FALL_SPEED * fallMul * deltaSeconds;
  const windX = WIND_X * fallMul * deltaSeconds;
  const windZ = WIND_Z * fallMul * deltaSeconds;

  rain.root.position.copyFrom(camera.position);
  rain.root.setEnabled(true);
  rain.mesh.alpha = Math.min(0.9, (0.06 + intensity * 0.17) * rain.fade);

  for (let i = 0; i < PARTICLE_COUNT; i += 1) {
    const base = i * 3;
    if (i >= visibleCount) {
      rain.lines[i][0].y = -9999;
      rain.lines[i][1].y = -9999;
      continue;
    }

    let x = rain.positions[base] + windX;
    const y = rain.positions[base + 1] - fall;
    let z = rain.positions[base + 2] + windZ;

    if (x > BOX_HALF_W) x -= BOX_HALF_W * 2;
    else if (x < -BOX_HALF_W) x += BOX_HALF_W * 2;
    if (z > BOX_HALF_D) z -= BOX_HALF_D * 2;
    else if (z < -BOX_HALF_D) z += BOX_HALF_D * 2;

    rain.positions[base] = x;
    rain.positions[base + 1] = y;
    rain.positions[base + 2] = z;

    if (y < -BOX_HALF_H) {
      respawnParticle(rain, i);
    }
    syncLineFromPosition(rain, i);
  }

  MeshBuilder.CreateLineSystem(
    "rain_streaks",
    { lines: rain.lines, instance: rain.mesh },
    rain.mesh.getScene(),
  );
}

export function rainCanvasFilter(fade: number): string {
  const t = clamp(fade, 0, 1);
  if (t <= 0.008) {
    return "";
  }
  const brightness = 1 - 0.32 * t;
  const saturation = 1 - 0.45 * t;
  const contrast = 1 - 0.06 * t;
  return `brightness(${brightness.toFixed(3)}) saturate(${saturation.toFixed(
    3,
  )}) contrast(${contrast.toFixed(3)})`;
}

export function disposeRainSystem(rain: RainSystem | null) {
  if (!rain) {
    return;
  }
  rain.mesh.dispose();
  rain.root.dispose();
}
