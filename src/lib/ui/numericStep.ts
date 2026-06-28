export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function stepDecimals(step: number): number {
  const [, decimals = ""] = step.toString().split(".");
  return decimals.length;
}

export function steppedValue(
  value: number,
  step: number,
  direction: -1 | 1,
  min: number,
  max: number,
): number {
  const decimals = stepDecimals(step);
  return clampNumber(Number((value + step * direction).toFixed(decimals)), min, max);
}

/** Finer step for +/- buttons — one tenth of the slider step by default. */
export function defaultButtonStep(sliderStep: number): number {
  const fine = sliderStep / 10;
  if (!Number.isFinite(fine) || fine <= 0) {
    return 0.001;
  }
  if (fine < 0.001) {
    return 0.001;
  }
  const decimals =
    fine >= 1 ? 2 : fine >= 0.1 ? 3 : fine >= 0.01 ? 4 : 5;
  return Number(fine.toFixed(decimals));
}
