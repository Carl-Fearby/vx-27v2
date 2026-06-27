import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";

export type ViewWeaponPose = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  scale: number;
};

export type ViewWeaponPoseMode = "hip" | "ads";

export type ViewWeaponTuning = Record<
  PrimaryWeaponId,
  Record<ViewWeaponPoseMode, ViewWeaponPose>
>;

const STORAGE_KEY = "vx27-view-weapon-tuning";

const RIFLE_HIP_GE2: ViewWeaponPose = {
  posX: -0.039,
  posY: -0.426,
  posZ: -0.931,
  rotX: 0.1284,
  rotY: -0.3916,
  rotZ: -0.0526,
  scale: 1.699,
};

const RIFLE_ADS_GE2: ViewWeaponPose = {
  posX: -0.163,
  posY: -0.304,
  posZ: -0.155,
  rotX: 0.0017,
  rotY: -0.5288,
  rotZ: 0.0489,
  scale: 1.583,
};

const PISTOL_HIP_GE2: ViewWeaponPose = {
  posX: -0.022,
  posY: -0.225,
  posZ: -0.473,
  rotX: 0.1114,
  rotY: -0.0516,
  rotZ: -0.0266,
  scale: 1.39,
};

const PISTOL_ADS_GE2: ViewWeaponPose = {
  posX: -0.098,
  posY: -0.193,
  posZ: -0.525,
  rotX: -0.0052,
  rotY: -0.1745,
  rotZ: -0.0122,
  scale: 1.414,
};

function toBabylonViewPose(pose: ViewWeaponPose): ViewWeaponPose {
  return {
    posX: -pose.posX,
    posY: pose.posY,
    posZ: pose.posZ,
    rotX: pose.rotX,
    rotY: -pose.rotY,
    rotZ: -pose.rotZ,
    scale: pose.scale,
  };
}

export const DEFAULT_VIEW_WEAPON_TUNING: ViewWeaponTuning = {
  rifle: {
    hip: toBabylonViewPose(RIFLE_HIP_GE2),
    ads: { ...toBabylonViewPose(RIFLE_ADS_GE2), posX: RIFLE_ADS_GE2.posX },
  },
  pistol: {
    hip: toBabylonViewPose(PISTOL_HIP_GE2),
    ads: { ...toBabylonViewPose(PISTOL_ADS_GE2), posX: PISTOL_ADS_GE2.posX },
  },
};

const POSE_FIELDS: Array<keyof ViewWeaponPose> = [
  "posX",
  "posY",
  "posZ",
  "rotX",
  "rotY",
  "rotZ",
  "scale",
];

function sanitizePose(value: unknown, fallback: ViewWeaponPose): ViewWeaponPose {
  const source = value && typeof value === "object" ? value : {};
  const out = { ...fallback };
  for (const field of POSE_FIELDS) {
    const next = (source as Partial<ViewWeaponPose>)[field];
    if (typeof next === "number" && Number.isFinite(next)) {
      out[field] = next;
    }
  }
  return out;
}

function near(value: number, target: number): boolean {
  return Math.abs(value - target) < 0.0005;
}

export function sanitizeViewWeaponTuning(value: unknown): ViewWeaponTuning {
  const source = value && typeof value === "object" ? value : {};
  const tuning = {
    rifle: {
      hip: sanitizePose(
        (source as Partial<ViewWeaponTuning>).rifle?.hip,
        DEFAULT_VIEW_WEAPON_TUNING.rifle.hip,
      ),
      ads: sanitizePose(
        (source as Partial<ViewWeaponTuning>).rifle?.ads,
        DEFAULT_VIEW_WEAPON_TUNING.rifle.ads,
      ),
    },
    pistol: {
      hip: sanitizePose(
        (source as Partial<ViewWeaponTuning>).pistol?.hip,
        DEFAULT_VIEW_WEAPON_TUNING.pistol.hip,
      ),
      ads: sanitizePose(
        (source as Partial<ViewWeaponTuning>).pistol?.ads,
        DEFAULT_VIEW_WEAPON_TUNING.pistol.ads,
      ),
    },
  };

  if (near(tuning.rifle.ads.posX, -RIFLE_ADS_GE2.posX)) {
    tuning.rifle.ads.posX = RIFLE_ADS_GE2.posX;
  }
  if (near(tuning.pistol.ads.posX, -PISTOL_ADS_GE2.posX)) {
    tuning.pistol.ads.posX = PISTOL_ADS_GE2.posX;
  }

  return tuning;
}

export function loadViewWeaponTuning(): ViewWeaponTuning {
  if (typeof window === "undefined") {
    return sanitizeViewWeaponTuning(null);
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return sanitizeViewWeaponTuning(raw ? JSON.parse(raw) : null);
  } catch {
    return sanitizeViewWeaponTuning(null);
  }
}

export function saveViewWeaponTuning(tuning: ViewWeaponTuning): ViewWeaponTuning {
  const sanitized = sanitizeViewWeaponTuning(tuning);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function resetViewWeaponTuning(): ViewWeaponTuning {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return sanitizeViewWeaponTuning(null);
}

export function formatViewWeaponTuningJson(tuning: ViewWeaponTuning): string {
  return JSON.stringify(sanitizeViewWeaponTuning(tuning), null, 2);
}
