import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";

export type WeaponRoundDisplayPose = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
  planeWidth: number;
  planeHeight: number;
  fontSize: number;
};

export type RoundDisplayPoseMode = "hip" | "ads";

export type RoundDisplayTuning = Record<
  PrimaryWeaponId,
  Record<RoundDisplayPoseMode, WeaponRoundDisplayPose>
>;

const STORAGE_KEY = "vx27-round-display-tuning";

export const DEFAULT_HIP_ROUND_DISPLAY: WeaponRoundDisplayPose = {
  posX: 0.465,
  posY: 0.364,
  posZ: 0.181,
  rotX: -0.8356,
  rotY: 0.5274,
  rotZ: -0.0156,
  scale: 2.634,
  planeWidth: 0.087,
  planeHeight: 0.1,
  fontSize: 30,
};

export const DEFAULT_AIM_ROUND_DISPLAY: WeaponRoundDisplayPose = {
  posX: -1.164,
  posY: 0.375,
  posZ: -2,
  rotX: 0.1524,
  rotY: 0.6274,
  rotZ: -0.0446,
  scale: 3.343,
  planeWidth: 0.078,
  planeHeight: 0.077,
  fontSize: 32,
};

export const DEFAULT_PISTOL_HIP_ROUND_DISPLAY: WeaponRoundDisplayPose = {
  posX: 0.341,
  posY: 0.424,
  posZ: 0.22,
  rotX: -0.426,
  rotY: 0.263,
  rotZ: 0.0364,
  scale: 0.504,
  planeWidth: 0.087,
  planeHeight: 0.1,
  fontSize: 88,
};

export const DEFAULT_PISTOL_AIM_ROUND_DISPLAY: WeaponRoundDisplayPose = {
  posX: 0.336,
  posY: 0.429,
  posZ: 0.165,
  rotX: -0.7735,
  rotY: 0.1885,
  rotZ: 0.0264,
  scale: 0.495,
  planeWidth: 0.089,
  planeHeight: 0.118,
  fontSize: 88,
};

export const DEFAULT_ROUND_DISPLAY_TUNING: RoundDisplayTuning = {
  rifle: {
    hip: { ...DEFAULT_HIP_ROUND_DISPLAY },
    ads: { ...DEFAULT_AIM_ROUND_DISPLAY },
  },
  pistol: {
    hip: { ...DEFAULT_PISTOL_HIP_ROUND_DISPLAY },
    ads: { ...DEFAULT_PISTOL_AIM_ROUND_DISPLAY },
  },
};

const POSE_FIELDS: (keyof WeaponRoundDisplayPose)[] = [
  "posX",
  "posY",
  "posZ",
  "rotX",
  "rotY",
  "rotZ",
  "scale",
  "planeWidth",
  "planeHeight",
  "fontSize",
];

function sanitizePose(
  value: unknown,
  fallback: WeaponRoundDisplayPose,
): WeaponRoundDisplayPose {
  const source = value && typeof value === "object" ? value : {};
  const out = { ...fallback };
  for (const field of POSE_FIELDS) {
    const next = (source as Partial<WeaponRoundDisplayPose>)[field];
    if (typeof next === "number" && Number.isFinite(next)) {
      out[field] = field === "fontSize" ? Math.round(next) : next;
    }
  }
  return out;
}

export function sanitizeRoundDisplayTuning(value: unknown): RoundDisplayTuning {
  const source = value && typeof value === "object" ? value : {};
  return {
    rifle: {
      hip: sanitizePose(
        (source as Partial<RoundDisplayTuning>).rifle?.hip,
        DEFAULT_ROUND_DISPLAY_TUNING.rifle.hip,
      ),
      ads: sanitizePose(
        (source as Partial<RoundDisplayTuning>).rifle?.ads,
        DEFAULT_ROUND_DISPLAY_TUNING.rifle.ads,
      ),
    },
    pistol: {
      hip: sanitizePose(
        (source as Partial<RoundDisplayTuning>).pistol?.hip,
        DEFAULT_ROUND_DISPLAY_TUNING.pistol.hip,
      ),
      ads: sanitizePose(
        (source as Partial<RoundDisplayTuning>).pistol?.ads,
        DEFAULT_ROUND_DISPLAY_TUNING.pistol.ads,
      ),
    },
  };
}

export function loadRoundDisplayTuning(): RoundDisplayTuning {
  if (typeof window === "undefined") {
    return sanitizeRoundDisplayTuning(null);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeRoundDisplayTuning(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeRoundDisplayTuning(null);
  }
}

export function saveRoundDisplayTuning(
  tuning: RoundDisplayTuning,
): RoundDisplayTuning {
  const sanitized = sanitizeRoundDisplayTuning(tuning);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function resetRoundDisplayTuning(): RoundDisplayTuning {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return sanitizeRoundDisplayTuning(null);
}

export function formatRoundDisplayTuningJson(tuning: RoundDisplayTuning): string {
  return JSON.stringify(sanitizeRoundDisplayTuning(tuning), null, 2);
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function resolveRoundDisplayPose(
  hip: WeaponRoundDisplayPose,
  aim: WeaponRoundDisplayPose,
  aimBlend: number,
): WeaponRoundDisplayPose {
  const t = clamp01(aimBlend);
  if (t <= 0) return { ...hip };
  if (t >= 1) return { ...aim };
  const out = { ...hip };
  for (const field of POSE_FIELDS) {
    out[field] = lerp(hip[field], aim[field], t);
  }
  out.fontSize = Math.round(out.fontSize);
  return out;
}

export function resolveSnappedRoundDisplayPose(
  hip: WeaponRoundDisplayPose,
  aim: WeaponRoundDisplayPose,
  aimBlend: number,
): WeaponRoundDisplayPose {
  return aimBlend >= 0.5 ? { ...aim } : { ...hip };
}

export function resolveRoundDisplayPoseForWeapon(
  weapon: PrimaryWeaponId,
  tuning: RoundDisplayTuning,
  aimBlend: number,
  preview?: { weapon: PrimaryWeaponId; mode: RoundDisplayPoseMode } | null,
): WeaponRoundDisplayPose {
  const weaponTuning = tuning[weapon];
  if (preview?.weapon === weapon) {
    return { ...weaponTuning[preview.mode] };
  }
  if (weapon === "rifle") {
    return { ...weaponTuning.hip };
  }
  return resolveSnappedRoundDisplayPose(
    weaponTuning.hip,
    weaponTuning.ads,
    aimBlend,
  );
}
