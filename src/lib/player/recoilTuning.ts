export type RecoilTuning = {
  aimRecoilPitch: number;
  aimRecoilYaw: number;
  springStiffness: number;
  springDamping: number;
  kickVelScale: number;
  fireRecoilBack: number;
  fireRecoilStiffness: number;
  fireRecoilDamping: number;
  fireRecoilKickVelScale: number;
  fireRecoilPitch: number;
  fireRecoilPitchVelScale: number;
};

export type RecoilTuningKey = keyof RecoilTuning;

export type RecoilTuningLimit = {
  min: number;
  max: number;
  step: number;
  nudge: number;
  decimals: number;
};

const STORAGE_KEY = "vx27-recoil-tuning";
const STORAGE_VERSION = 1;

export const DEFAULT_RECOIL_TUNING: RecoilTuning = {
  aimRecoilPitch: 0.032,
  aimRecoilYaw: 0.001,
  springStiffness: 260,
  springDamping: 14,
  kickVelScale: 10,
  fireRecoilBack: 0.07,
  fireRecoilStiffness: 445,
  fireRecoilDamping: 20.5,
  fireRecoilKickVelScale: 9.7,
  fireRecoilPitch: -0.09,
  fireRecoilPitchVelScale: 9.2,
};

export const RECOIL_TUNING_LIMITS: Record<RecoilTuningKey, RecoilTuningLimit> = {
  aimRecoilPitch: { min: 0.004, max: 0.04, step: 0.001, nudge: 0.001, decimals: 3 },
  aimRecoilYaw: { min: 0.001, max: 0.015, step: 0.001, nudge: 0.001, decimals: 3 },
  springStiffness: { min: 80, max: 500, step: 5, nudge: 10, decimals: 0 },
  springDamping: { min: 5, max: 40, step: 0.5, nudge: 1, decimals: 1 },
  kickVelScale: { min: 1, max: 10, step: 0.1, nudge: 0.25, decimals: 1 },
  fireRecoilBack: { min: 0.01, max: 0.08, step: 0.001, nudge: 0.002, decimals: 3 },
  fireRecoilStiffness: { min: 80, max: 500, step: 5, nudge: 10, decimals: 0 },
  fireRecoilDamping: { min: 5, max: 40, step: 0.5, nudge: 1, decimals: 1 },
  fireRecoilKickVelScale: { min: 1, max: 12, step: 0.1, nudge: 0.25, decimals: 1 },
  fireRecoilPitch: { min: -0.2, max: 0, step: 0.005, nudge: 0.01, decimals: 3 },
  fireRecoilPitchVelScale: { min: 1, max: 12, step: 0.1, nudge: 0.25, decimals: 1 },
};

export const RECOIL_TUNING_KEYS = Object.keys(
  DEFAULT_RECOIL_TUNING,
) as RecoilTuningKey[];

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function normalizeField(value: unknown, key: RecoilTuningKey): number {
  const fallback = DEFAULT_RECOIL_TUNING[key];
  const limit = RECOIL_TUNING_LIMITS[key];
  const next = Number(value);
  return Number.isFinite(next) ? clamp(next, limit.min, limit.max) : fallback;
}

export function normalizeRecoilTuning(
  patch: Partial<RecoilTuning> = {},
): RecoilTuning {
  const next = { ...DEFAULT_RECOIL_TUNING };
  for (const key of RECOIL_TUNING_KEYS) {
    next[key] = normalizeField(patch[key], key);
  }
  return next;
}

export function loadRecoilTuning(): RecoilTuning {
  if (typeof window === "undefined") {
    return { ...DEFAULT_RECOIL_TUNING };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_RECOIL_TUNING };
    }
    const parsed = JSON.parse(raw) as Partial<RecoilTuning> & { version?: number };
    if ((parsed.version ?? 0) < STORAGE_VERSION) {
      return resetRecoilTuning();
    }
    return normalizeRecoilTuning(parsed);
  } catch {
    return { ...DEFAULT_RECOIL_TUNING };
  }
}

export function saveRecoilTuning(tuning: Partial<RecoilTuning>): RecoilTuning {
  const normalized = normalizeRecoilTuning(tuning);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...normalized, version: STORAGE_VERSION }),
    );
  }
  return normalized;
}

export function resetRecoilTuning(): RecoilTuning {
  return saveRecoilTuning(DEFAULT_RECOIL_TUNING);
}

export function formatRecoilTuningJson(tuning: RecoilTuning): string {
  return JSON.stringify(normalizeRecoilTuning(tuning), null, 2);
}

export function resolveAdsRecoilScale(aimBlend: number): number {
  return 1 - Math.min(Math.max(aimBlend, 0), 1) * 0.4;
}
