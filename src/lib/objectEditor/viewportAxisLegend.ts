import {
  Matrix,
  Vector3,
  type ArcRotateCamera,
  type Scene,
} from "@babylonjs/core";

export type ViewportAxisLegendArm = {
  dx: number;
  dy: number;
};

export type ViewportAxisLegendState = {
  x: ViewportAxisLegendArm;
  y: ViewportAxisLegendArm;
  z: ViewportAxisLegendArm;
};

function projectWorldAxisOnScreen(
  worldAxis: Vector3,
  camera: ArcRotateCamera,
  scene: Scene,
  canvasWidth: number,
  canvasHeight: number,
): ViewportAxisLegendArm {
  const engine = camera.getEngine();
  const renderWidth = engine.getRenderWidth();
  const renderHeight = engine.getRenderHeight();
  const transform = scene.getTransformMatrix();
  const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
  const project = (world: Vector3) => {
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
  };

  const origin = project(Vector3.Zero());
  const axisEnd = project(worldAxis);
  const dx = axisEnd.x - origin.x;
  const dy = axisEnd.y - origin.y;
  const length = Math.hypot(dx, dy);
  if (length < 1e-6) {
    return { dx: 0, dy: 0 };
  }
  return { dx: dx / length, dy: dy / length };
}

export function createViewportAxisLegendState(
  camera: ArcRotateCamera,
  scene: Scene,
  canvasWidth: number,
  canvasHeight: number,
): ViewportAxisLegendState | null {
  if (canvasWidth <= 0 || canvasHeight <= 0) {
    return null;
  }

  return {
    x: projectWorldAxisOnScreen(Vector3.Right(), camera, scene, canvasWidth, canvasHeight),
    y: projectWorldAxisOnScreen(Vector3.Up(), camera, scene, canvasWidth, canvasHeight),
    z: projectWorldAxisOnScreen(Vector3.Forward(), camera, scene, canvasWidth, canvasHeight),
  };
}
