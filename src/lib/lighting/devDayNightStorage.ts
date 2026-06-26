const DEV_DAY_NIGHT_STORAGE_KEY = "vx27-dev-day-night";

/** Dev-only: restore last day/night toggle across reloads. */
export function loadDevDayNightMode(): boolean {
  if (typeof window === "undefined") {
    return true;
  }

  try {
    const raw = window.localStorage.getItem(DEV_DAY_NIGHT_STORAGE_KEY);
    if (raw === "night") {
      return false;
    }
    if (raw === "day") {
      return true;
    }
  } catch {
    // ignore quota / private mode
  }

  return true;
}

export function saveDevDayNightMode(isDay: boolean): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(DEV_DAY_NIGHT_STORAGE_KEY, isDay ? "day" : "night");
  } catch {
    // ignore quota / private mode
  }
}
