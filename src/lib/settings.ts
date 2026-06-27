export type GameSettings = {
  musicEnabled: boolean;
  hudVisible: boolean;
  rainEnabled: boolean;
  rainIntensity: number;
  invertLookX: boolean;
  invertLookY: boolean;
  mouseLookEase: number;
  keyboardLookEase: number;
  mouseLookSpeed: number;
  keyboardLookSpeed: number;
  maxLookRate: number;
  walkBobEnabled: boolean;
  walkBobAmplitudeCm: number;
  walkBobDurationSec: number;
  /** Dev: draw the player's floor collision footprint in the world. */
  showPlayerCollisionFootprint: boolean;
};

export const DEFAULT_SETTINGS: GameSettings = {
  musicEnabled: true,
  hudVisible: true,
  rainEnabled: false,
  rainIntensity: 1.25,
  invertLookX: false,
  invertLookY: false,
  mouseLookEase: 1,
  keyboardLookEase: 0,
  mouseLookSpeed: 7,
  keyboardLookSpeed: 5,
  maxLookRate: 10,
  walkBobEnabled: true,
  walkBobAmplitudeCm: 18.6,
  walkBobDurationSec: 0.41,
  showPlayerCollisionFootprint: false,
};

const CONTROLS_STORAGE_KEY = "vx27-controls";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseBooleanSetting(
  value: unknown,
  fallback: boolean,
): boolean {
  if (typeof value === "boolean") {
    return value;
  }
  return fallback;
}

function sanitizeSettings(value: Partial<GameSettings>): GameSettings {
  const legacy = value as Partial<GameSettings> & {
    invertMouseX?: boolean;
    invertMouseY?: boolean;
    invert_mouse_x?: boolean;
    invert_mouse_y?: boolean;
  };

  return {
    musicEnabled: parseBooleanSetting(
      value.musicEnabled,
      DEFAULT_SETTINGS.musicEnabled,
    ),
    hudVisible: parseBooleanSetting(
      value.hudVisible,
      DEFAULT_SETTINGS.hudVisible,
    ),
    rainEnabled: parseBooleanSetting(
      value.rainEnabled,
      DEFAULT_SETTINGS.rainEnabled,
    ),
    rainIntensity: clamp(
      value.rainIntensity ?? DEFAULT_SETTINGS.rainIntensity,
      0.05,
      5,
    ),
    invertLookX: parseBooleanSetting(
      value.invertLookX ?? legacy.invertMouseX ?? legacy.invert_mouse_x,
      DEFAULT_SETTINGS.invertLookX,
    ),
    invertLookY: parseBooleanSetting(
      value.invertLookY ?? legacy.invertMouseY ?? legacy.invert_mouse_y,
      DEFAULT_SETTINGS.invertLookY,
    ),
    mouseLookEase: clamp(
      value.mouseLookEase ?? DEFAULT_SETTINGS.mouseLookEase,
      0,
      10,
    ),
    keyboardLookEase: clamp(
      value.keyboardLookEase ?? DEFAULT_SETTINGS.keyboardLookEase,
      0,
      10,
    ),
    mouseLookSpeed: clamp(
      value.mouseLookSpeed ?? DEFAULT_SETTINGS.mouseLookSpeed,
      0.5,
      10,
    ),
    keyboardLookSpeed: clamp(
      value.keyboardLookSpeed ?? DEFAULT_SETTINGS.keyboardLookSpeed,
      0.5,
      10,
    ),
    maxLookRate: clamp(
      value.maxLookRate ?? DEFAULT_SETTINGS.maxLookRate,
      0.5,
      20,
    ),
    walkBobEnabled: parseBooleanSetting(
      value.walkBobEnabled,
      DEFAULT_SETTINGS.walkBobEnabled,
    ),
    walkBobAmplitudeCm: clamp(
      value.walkBobAmplitudeCm ?? DEFAULT_SETTINGS.walkBobAmplitudeCm,
      0,
      20,
    ),
    walkBobDurationSec: clamp(
      value.walkBobDurationSec ?? DEFAULT_SETTINGS.walkBobDurationSec,
      0.25,
      1.2,
    ),
    showPlayerCollisionFootprint: parseBooleanSetting(
      value.showPlayerCollisionFootprint,
      DEFAULT_SETTINGS.showPlayerCollisionFootprint,
    ),
  };
}

export function loadSettings(): GameSettings {
  if (typeof window === "undefined") {
    return { ...DEFAULT_SETTINGS };
  }

  try {
    let raw = window.localStorage.getItem(CONTROLS_STORAGE_KEY);
    if (!raw) {
      raw = window.localStorage.getItem("vx27-settings");
      if (raw) {
        window.localStorage.setItem(CONTROLS_STORAGE_KEY, raw);
        window.localStorage.removeItem("vx27-settings");
      }
    }
    if (!raw) {
      return { ...DEFAULT_SETTINGS };
    }
    return sanitizeSettings(JSON.parse(raw) as Partial<GameSettings>);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: GameSettings): void {
  if (typeof window === "undefined") {
    return;
  }

  const sanitized = sanitizeSettings(settings);
  window.localStorage.setItem(CONTROLS_STORAGE_KEY, JSON.stringify(sanitized));
}
