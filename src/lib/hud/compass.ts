export type CompassMetrics = {
  viewport: HTMLElement | null;
  framesUntilRefresh: number;
  width: number;
  center: number;
  pxPerDeg: number;
  pxPerDegStyle: string;
};

export function createCompassMetricsCache(): CompassMetrics {
  return {
    viewport: null,
    framesUntilRefresh: 0,
    width: 0,
    center: 0,
    pxPerDeg: 0,
    pxPerDegStyle: "",
  };
}

export function readCompassMetrics(
  cache: CompassMetrics,
  viewport: HTMLElement,
): Pick<CompassMetrics, "center" | "pxPerDeg" | "pxPerDegStyle"> {
  cache.framesUntilRefresh -= 1;

  if (
    cache.viewport !== viewport ||
    cache.width <= 0 ||
    cache.framesUntilRefresh <= 0
  ) {
    cache.viewport = viewport;
    cache.framesUntilRefresh = 30;
    const width = viewport.offsetWidth;
    if (width !== cache.width) {
      cache.width = width;
      cache.center = width * 0.5;
      cache.pxPerDeg = width / 105;
      cache.pxPerDegStyle = `${cache.pxPerDeg}px`;
    }
  }

  return cache;
}

/** Update compass tape position from player yaw (radians, game convention). */
export function updateCompassTape(
  yawRadians: number,
  viewport: HTMLElement | null,
  tape: HTMLElement | null,
  cache: CompassMetrics,
): void {
  if (!viewport || !tape) {
    return;
  }

  const yawDeg = (yawRadians * 180) / Math.PI;
  // VX-27 WASM integrates yaw with += on mouse right; GameEngine2 uses -=.
  // Use +yaw here so the tape scroll matches turn direction.
  const bearing = (((yawDeg % 360) + 360) % 360);
  const { center, pxPerDeg, pxPerDegStyle } = readCompassMetrics(cache, viewport);

  if (tape.style.getPropertyValue("--compass-px-per-deg") !== pxPerDegStyle) {
    tape.style.setProperty("--compass-px-per-deg", pxPerDegStyle);
  }

  tape.style.transform = `translateX(${center - bearing * pxPerDeg}px)`;
}
