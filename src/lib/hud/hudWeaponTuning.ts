import type { CSSProperties } from "react";

export type HudWeaponTuning = {
  primaryFrameOpacity: number;
  secondaryFrameOpacity: number;
};

export const HUD_WEAPON_OPACITY_MIN = 0.25;
export const HUD_WEAPON_OPACITY_MAX = 1;
export const HUD_WEAPON_OPACITY_STEP = 0.01;

export const DEFAULT_HUD_WEAPON_TUNING: HudWeaponTuning = {
  primaryFrameOpacity: 1,
  secondaryFrameOpacity: 1,
};

const STORAGE_KEY = "vx27-hud-weapon-tuning";

function clampOpacity(value: number): number {
  return Math.min(
    HUD_WEAPON_OPACITY_MAX,
    Math.max(HUD_WEAPON_OPACITY_MIN, value),
  );
}

export function sanitizeHudWeaponTuning(
  value: Partial<HudWeaponTuning>,
): HudWeaponTuning {
  return {
    primaryFrameOpacity: clampOpacity(
      value.primaryFrameOpacity ?? DEFAULT_HUD_WEAPON_TUNING.primaryFrameOpacity,
    ),
    secondaryFrameOpacity: clampOpacity(
      value.secondaryFrameOpacity ??
        DEFAULT_HUD_WEAPON_TUNING.secondaryFrameOpacity,
    ),
  };
}

export function loadHudWeaponTuning(): HudWeaponTuning {
  if (typeof window === "undefined") {
    return { ...DEFAULT_HUD_WEAPON_TUNING };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { ...DEFAULT_HUD_WEAPON_TUNING };
    }
    return sanitizeHudWeaponTuning(JSON.parse(raw) as Partial<HudWeaponTuning>);
  } catch {
    return { ...DEFAULT_HUD_WEAPON_TUNING };
  }
}

export function saveHudWeaponTuning(
  tuning: HudWeaponTuning,
): HudWeaponTuning {
  const sanitized = sanitizeHudWeaponTuning(tuning);
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  }
  return sanitized;
}

export function buildHudWeaponOpacityStyle(
  tuning: HudWeaponTuning,
): CSSProperties {
  return {
    "--hud-primary-frame-opacity": String(tuning.primaryFrameOpacity),
    "--hud-secondary-frame-opacity": String(tuning.secondaryFrameOpacity),
  } as CSSProperties;
}
