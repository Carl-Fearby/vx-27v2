import {
  Matrix,
  Vector3,
  type ArcRotateCamera,
  type Scene,
  type TransformNode,
  type Viewport,
} from "@babylonjs/core";

export type ViewportRulerTick = {
  position: number;
  label?: string;
  major: boolean;
  isOrigin?: boolean;
};

export type ViewportRulerState = {
  unitLabel: string;
  horizontalTicks: ViewportRulerTick[];
  verticalTicks: ViewportRulerTick[];
};

export type ModelDimensions = {
  width: number;
  height: number;
  depth: number;
};

const TARGET_TICK_SPACING_PX = 88;

export function formatMetricDimension(value: number, unit: "m" | "cm" | "mm"): string {
  if (!Number.isFinite(value)) {
    return `0 ${unit}`;
  }
  const scaled =
    unit === "m" ? value : unit === "cm" ? value * 100 : value * 1000;
  const absolute = Math.abs(scaled);
  const decimals = unit === "mm" ? 0 : absolute >= 10 ? 1 : 2;
  return `${scaled.toFixed(decimals)} ${unit}`;
}

export function formatRulerDistance(value: number): string {
  const absolute = Math.abs(value);
  if (absolute >= 1) {
    return formatMetricDimension(value, "m");
  }
  if (absolute >= 0.01) {
    return formatMetricDimension(value, "cm");
  }
  return formatMetricDimension(value, "mm");
}

export function modelDimensionSummary(value: number): string {
  return [
    formatMetricDimension(value, "m"),
    formatMetricDimension(value, "cm"),
    formatMetricDimension(value, "mm"),
  ].join(" / ");
}

export function modelDimensionShort(value: number): string {
  if (!Number.isFinite(value)) {
    return "0 m";
  }
  const absolute = Math.abs(value);
  if (absolute >= 1) {
    return formatMetricDimension(value, "m");
  }
  if (absolute >= 0.01) {
    return formatMetricDimension(value, "cm");
  }
  return formatMetricDimension(value, "mm");
}

function niceViewportRulerStep(targetWorldSize: number): number {
  const target = Math.max(targetWorldSize, 0.000001);
  const power = 10 ** Math.floor(Math.log10(target));
  const normalized = target / power;
  const multiplier =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;
  return multiplier * power;
}

function rulerUnitForStep(step: number): "m" | "cm" | "mm" {
  if (step >= 1) {
    return "m";
  }
  if (step >= 0.01) {
    return "cm";
  }
  return "mm";
}


function formatRulerTickLabel(
  worldValue: number,
  unit: "m" | "cm" | "mm",
): string {
  const scaled =
    unit === "m" ? worldValue : unit === "cm" ? worldValue * 100 : worldValue * 1000;
  const integer = Math.round(scaled);
  if (integer === 0) {
    return "0";
  }
  return `${integer} ${unit}`;
}

function projectWorldToCanvas(
  world: Vector3,
  transform: Matrix,
  viewport: Viewport,
  canvasWidth: number,
  canvasHeight: number,
  renderWidth: number,
  renderHeight: number,
): { x: number; y: number } {
  const projected = Vector3.Project(
    world,
    Matrix.IdentityReadOnly,
    transform,
    viewport,
  );
  return {
    x: projected.x * (canvasWidth / renderWidth),
    y: projected.y * (canvasHeight / renderHeight),
  };
}

function measureProjectedAxisScale(
  project: (world: Vector3) => { x: number; y: number },
  origin: { x: number; y: number },
  axis: "x" | "z",
  probeWorld: number,
): number {
  const probe =
    axis === "x"
      ? project(new Vector3(probeWorld, 0, 0))
      : project(new Vector3(0, 0, probeWorld));
  const delta =
    axis === "x" ? probe.x - origin.x : origin.y - probe.y;
  return delta / probeWorld;
}

function rulerSubdivisionCount(
  worldStep: number,
  pixelsPerWorldUnit: number,
): number {
  const pixelsPerMajor = Math.abs(worldStep * pixelsPerWorldUnit);
  if (pixelsPerMajor < 14) {
    return 1;
  }
  if (pixelsPerMajor / 5 >= 5) {
    return 5;
  }
  if (pixelsPerMajor / 2 >= 5) {
    return 2;
  }
  return 1;
}

function createAlignedRulerTicks(
  pixelLength: number,
  originPixel: number,
  pixelsPerWorldUnit: number,
  worldStep: number,
): ViewportRulerTick[] {
  if (
    pixelLength <= 0 ||
    !Number.isFinite(pixelsPerWorldUnit) ||
    Math.abs(pixelsPerWorldUnit) < 0.0001 ||
    !Number.isFinite(worldStep) ||
    worldStep <= 0
  ) {
    return [];
  }

  const subdivisions = rulerSubdivisionCount(worldStep, pixelsPerWorldUnit);
  const step = worldStep / subdivisions;
  const unit = rulerUnitForStep(worldStep);

  const worldAtStart = (0 - originPixel) / pixelsPerWorldUnit;
  const worldAtEnd = (pixelLength - originPixel) / pixelsPerWorldUnit;
  const minWorld = Math.min(worldAtStart, worldAtEnd);
  const maxWorld = Math.max(worldAtStart, worldAtEnd);
  const minIndex = Math.ceil(minWorld / step - 1e-9);
  const maxIndex = Math.floor(maxWorld / step + 1e-9);

  const ticks: ViewportRulerTick[] = [];
  const maxTickCount = 240;
  for (
    let tickIndex = minIndex, count = 0;
    tickIndex <= maxIndex && count < maxTickCount;
    tickIndex += 1, count += 1
  ) {
    const world = tickIndex * step;
    const position = originPixel + world * pixelsPerWorldUnit;
    if (position < -2 || position > pixelLength + 2) {
      continue;
    }

    const isOrigin = tickIndex === 0;
    const isMajor = subdivisions === 1 || tickIndex % subdivisions === 0;

    ticks.push({
      position,
      label: isOrigin
        ? "0"
        : isMajor
          ? formatRulerTickLabel(world, unit)
          : undefined,
      major: isMajor,
      isOrigin,
    });
  }

  if (minIndex <= 0 && maxIndex >= 0) {
    const originPosition = originPixel;
    if (originPosition >= -2 && originPosition <= pixelLength + 2) {
      const existingIndex = ticks.findIndex((tick) => tick.isOrigin);
      const originTick: ViewportRulerTick = {
        position: originPosition,
        label: "0",
        major: true,
        isOrigin: true,
      };
      if (existingIndex >= 0) {
        ticks[existingIndex] = originTick;
      } else {
        ticks.push(originTick);
      }
    }
  }

  ticks.sort((left, right) => left.position - right.position);
  return ticks;
}

export function modelDimensionsFromRoot(root: TransformNode): ModelDimensions {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  return {
    width: Math.abs(size.x),
    height: Math.abs(size.y),
    depth: Math.abs(size.z),
  };
}

export function createViewportRulerState(
  camera: ArcRotateCamera,
  scene: Scene,
  canvas: HTMLCanvasElement,
): ViewportRulerState | null {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  if (width <= 0 || height <= 0 || camera.radius <= 0) {
    return null;
  }

  const engine = camera.getEngine();
  const renderWidth = engine.getRenderWidth();
  const renderHeight = engine.getRenderHeight();
  const transform = scene.getTransformMatrix();
  const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
  const project = (world: Vector3) =>
    projectWorldToCanvas(
      world,
      transform,
      viewport,
      width,
      height,
      renderWidth,
      renderHeight,
    );

  const origin = project(Vector3.Zero());
  const worldHeight = 2 * camera.radius * Math.tan(camera.fov / 2);
  const roughPixelsPerWorld = height / Math.max(worldHeight, 0.000001);
  const scaleProbeWorld = Math.max(
    TARGET_TICK_SPACING_PX / roughPixelsPerWorld,
    0.000001,
  );

  const pixelsPerWorldUnitX = measureProjectedAxisScale(
    project,
    origin,
    "x",
    scaleProbeWorld,
  );
  const pixelsPerWorldUnitZ = measureProjectedAxisScale(
    project,
    origin,
    "z",
    scaleProbeWorld,
  );

  const worldStepX = niceViewportRulerStep(
    TARGET_TICK_SPACING_PX / Math.max(Math.abs(pixelsPerWorldUnitX), 0.000001),
  );
  const worldStepZ = niceViewportRulerStep(
    TARGET_TICK_SPACING_PX / Math.max(Math.abs(pixelsPerWorldUnitZ), 0.000001),
  );

  const horizontalTicks = createAlignedRulerTicks(
    width,
    origin.x,
    pixelsPerWorldUnitX,
    worldStepX,
  );
  const verticalTicks = createAlignedRulerTicks(
    height,
    origin.y,
    pixelsPerWorldUnitZ,
    worldStepZ,
  );

  const unitLabel =
    worldStepX === worldStepZ
      ? formatRulerDistance(worldStepX)
      : `${formatRulerDistance(worldStepX)} × ${formatRulerDistance(worldStepZ)}`;

  return {
    unitLabel,
    horizontalTicks,
    verticalTicks,
  };
}
