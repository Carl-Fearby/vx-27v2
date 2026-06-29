import type { PointLight } from "@babylonjs/core";

const TWO_PI = Math.PI * 2;

type FlickerConfig = {
  baseFactor: number;
  wobbleAmp: number;
  wobbleSpeed: number;
  dipMinGap: number;
  dipMaxGap: number;
  dipMinStrength: number;
  dipMaxStrength: number;
  dipDuration: number;
  positionDriftAmpY: number;
  positionDriftSpeed: number;
  minFactor: number;
};

type CandleFlickerState = {
  cfg: FlickerConfig;
  wobbleSpeed: number;
  timeOffset: number;
  positionDriftSpeed: number;
  baseIntensity: number;
  basePositionY: number | null;
  seed: number;
  positionSeed: number;
  nextDipTime: number;
  dipEndTime: number;
  dipStrength: number;
};

export const OIL_BARREL_FLICKER_OPTS: FlickerConfig = {
  baseFactor: 0.82,
  wobbleAmp: 0.24,
  wobbleSpeed: 4.2,
  dipMinGap: 0.1,
  dipMaxGap: 0.45,
  dipDuration: 0.04,
  dipMinStrength: 0.3,
  dipMaxStrength: 0.55,
  positionDriftAmpY: 0.06,
  positionDriftSpeed: 2.1,
  minFactor: 0.2,
};

function frac01(n: number): number {
  return n - Math.floor(n);
}

function candleNoise(t: number, seed: number): number {
  return (
    0.45 * Math.sin(t * 7.3 + seed) +
    0.3 * Math.sin(t * 13.1 + seed * 1.7) +
    0.18 * Math.sin(t * 23.7 + seed * 2.3) +
    0.1 * Math.sin(t * 41.2 + seed * 3.1)
  );
}

function candlePositionDriftY(
  t: number,
  seed: number,
  amp: number,
  speed: number,
): number {
  const slow = candleNoise(t * speed * 0.38, seed + 11.7);
  const fast = candleNoise(t * speed * 1.25, seed + 23.4) * 0.38;
  return (slow + fast) * amp;
}

export function deriveBarrelFlickerSeeds(barrelSeed: number, side: -1 | 0 | 1) {
  const sideSalt = side < 0 ? 0.127 : side > 0 ? 0.891 : 0.512;
  const s = barrelSeed;
  const dipSpan = 0.85 - 0.22;

  return {
    flickerSeed:
      frac01(Math.sin(s * 12.9898 + sideSalt) * 43758.5453) * TWO_PI * 50,
    positionSeed:
      frac01(Math.sin(s * 78.233 + sideSalt * 2.1) * 12345.6789) * TWO_PI * 50,
    timeOffset: frac01(Math.sin(s * 0.0173 + sideSalt) * 9999.13) * 24,
    wobbleSpeedScale:
      0.65 + frac01(Math.sin(s * 4.31 + sideSalt) * 2718.28) * 0.7,
    positionDriftSpeedScale:
      0.7 + frac01(Math.sin(s * 9.17 + sideSalt) * 31415.9) * 0.6,
    dipStartOffset: frac01(Math.sin(s * 2.71 + sideSalt) * 1618.03) * dipSpan,
  };
}

function getFlickerState(light: PointLight): CandleFlickerState | null {
  const state = light.metadata?.candleFlicker as CandleFlickerState | undefined;
  return state ?? null;
}

export function attachCandleFlickerLight(
  light: PointLight,
  opts: FlickerConfig,
  overrides: ReturnType<typeof deriveBarrelFlickerSeeds>,
): void {
  const cfg = opts;
  const timeOffset = overrides.timeOffset;
  const wobbleSpeed = cfg.wobbleSpeed * overrides.wobbleSpeedScale;
  const positionDriftSpeed =
    cfg.positionDriftSpeed * overrides.positionDriftSpeedScale;

  light.metadata = {
    ...light.metadata,
    candleFlicker: {
      cfg,
      wobbleSpeed,
      timeOffset,
      positionDriftSpeed,
      baseIntensity: light.intensity,
      basePositionY:
        cfg.positionDriftAmpY > 0 ? light.position.y : null,
      seed: overrides.flickerSeed,
      positionSeed: overrides.positionSeed,
      nextDipTime: timeOffset + cfg.dipMinGap + overrides.dipStartOffset,
      dipEndTime: -1,
      dipStrength: 0,
    } satisfies CandleFlickerState,
  };
}

export function updateCandleFlicker(lights: PointLight[], timeSec: number): void {
  for (const light of lights) {
    const data = getFlickerState(light);
    if (!data || !light.isEnabled()) continue;

    const cfg = data.cfg;
    const t = timeSec + data.timeOffset;
    const wobble = candleNoise(t * data.wobbleSpeed, data.seed);
    let factor = cfg.baseFactor + wobble * cfg.wobbleAmp;

    if (t > data.nextDipTime) {
      data.dipEndTime = t + cfg.dipDuration;
      data.nextDipTime =
        t + cfg.dipMinGap + Math.random() * (cfg.dipMaxGap - cfg.dipMinGap);
      data.dipStrength =
        cfg.dipMinStrength +
        Math.random() * (cfg.dipMaxStrength - cfg.dipMinStrength);
    }
    if (t < data.dipEndTime) {
      const phase = (data.dipEndTime - t) / cfg.dipDuration;
      const env = Math.sin(Math.min(Math.max(phase, 0), 1) * Math.PI);
      factor *= 1 - data.dipStrength * env;
    }

    factor = Math.min(Math.max(factor, cfg.minFactor), 1.05);
    light.intensity = data.baseIntensity * factor;

    if (data.basePositionY != null && cfg.positionDriftAmpY > 0) {
      const yDrift = candlePositionDriftY(
        t,
        data.positionSeed,
        cfg.positionDriftAmpY,
        data.positionDriftSpeed,
      );
      light.position.y = data.basePositionY + yDrift;
    }
  }
}
