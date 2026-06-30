import {
  Color3,
  DynamicTexture,
  LinesMesh,
  Matrix,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  type ArcRotateCamera,
} from "@babylonjs/core";

import { resolveSupplementalMeasurementGuides } from "@/lib/objectEditor/modelMeasurements";
import { modelDimensionShort } from "@/lib/objectEditor/viewportRuler";

/** On-screen label height in CSS pixels — constant regardless of zoom or depth. */
export const DIMENSION_LABEL_SCREEN_HEIGHT_PX = 28;

export type ModelDimensionGuideSet = {
  syncLabels: (camera: ArcRotateCamera, scene: Scene) => void;
  dispose: () => void;
};

const AXIS_COLORS = {
  x: new Color3(0.95, 0.32, 0.32),
  y: new Color3(0.34, 0.9, 0.48),
  z: new Color3(0.32, 0.58, 1),
} as const;

type DimensionLabelEntry = {
  mesh: Mesh;
  aspect: number;
};

function colorToCss(color: Color3): string {
  const channel = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255);
  return `rgb(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)})`;
}

function worldLabelHeightForScreenPixels(
  camera: ArcRotateCamera,
  scene: Scene,
  worldPosition: Vector3,
  screenHeightCssPx: number,
): number {
  const engine = camera.getEngine();
  const renderWidth = engine.getRenderWidth();
  const renderHeight = engine.getRenderHeight();
  const canvas = engine.getRenderingCanvas();
  const cssHeight = canvas?.clientHeight ?? renderHeight;
  const targetRenderPx = screenHeightCssPx * (renderHeight / Math.max(cssHeight, 1));

  const transform = scene.getTransformMatrix();
  const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
  const identity = Matrix.IdentityReadOnly;

  const screenBase = Vector3.Project(
    worldPosition,
    identity,
    transform,
    viewport,
  );
  const worldUp = Vector3.TransformNormal(
    Vector3.UpReadOnly,
    camera.getWorldMatrix(),
  ).normalize();
  const probeWorld = Math.max(
    Vector3.Distance(camera.position, worldPosition) * 0.001,
    0.00001,
  );
  const screenProbe = Vector3.Project(
    worldPosition.add(worldUp.scale(probeWorld)),
    identity,
    transform,
    viewport,
  );
  const pixelsPerWorldUnit = Math.abs(screenProbe.y - screenBase.y) / probeWorld;
  if (pixelsPerWorldUnit < 1e-6) {
    return targetRenderPx * 0.001;
  }
  return targetRenderPx / pixelsPerWorldUnit;
}

function syncLabelEntries(
  labels: DimensionLabelEntry[],
  camera: ArcRotateCamera,
  scene: Scene,
): void {
  for (const { mesh } of labels) {
    const worldHeight = worldLabelHeightForScreenPixels(
      camera,
      scene,
      mesh.getAbsolutePosition(),
      DIMENSION_LABEL_SCREEN_HEIGHT_PX,
    );
    // Plane geometry is already `width: aspect, height: 1` — scale uniformly.
    mesh.scaling.set(worldHeight, worldHeight, 1);
  }
}

function createGuideLine(
  scene: Scene,
  name: string,
  color: Color3,
  start: Vector3,
  end: Vector3,
): LinesMesh {
  const mesh = MeshBuilder.CreateLines(
    name,
    { points: [start, end], updatable: false },
    scene,
  );
  mesh.color = color;
  mesh.alpha = 0.92;
  mesh.isPickable = false;
  mesh.renderingGroupId = 0;
  return mesh;
}

function createDimensionLabel(
  scene: Scene,
  name: string,
  text: string,
  color: Color3,
  position: Vector3,
): DimensionLabelEntry {
  const fontSize = 56;
  const padding = 18;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Could not create dimension label canvas");
  }

  ctx.font = `700 ${fontSize}px Orbitron, "Eurostile", "Rajdhani", sans-serif`;
  const metrics = ctx.measureText(text);
  canvas.width = Math.ceil(metrics.width + padding * 2);
  canvas.height = Math.ceil(fontSize + padding * 2);
  const aspect = canvas.width / canvas.height;

  ctx.font = `700 ${fontSize}px Orbitron, "Eurostile", "Rajdhani", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(5, 10, 16, 0.72)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = colorToCss(color);
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);
  ctx.fillStyle = colorToCss(color);
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const texture = new DynamicTexture(
    `${name}Tex`,
    { width: canvas.width, height: canvas.height },
    scene,
    false,
  );
  texture.hasAlpha = true;
  texture.getContext().drawImage(canvas, 0, 0);
  texture.update();

  const material = new StandardMaterial(`${name}Mat`, scene);
  material.diffuseTexture = texture;
  material.emissiveColor = color;
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;

  const plane = MeshBuilder.CreatePlane(
    name,
    { width: aspect, height: 1 },
    scene,
  );
  plane.material = material;
  plane.position = position;
  plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
  plane.isPickable = false;
  plane.renderingGroupId = 0;
  return { mesh: plane, aspect };
}

export function createModelDimensionGuides(
  scene: Scene,
  root: TransformNode,
): ModelDimensionGuideSet | null {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const min = bounds.min.clone();
  const max = bounds.max.clone();
  const size = max.subtract(min);
  const longestSide = Math.max(size.x, size.y, size.z);
  if (!Number.isFinite(longestSide) || longestSide <= 0.00001) {
    return null;
  }

  const labelOffset = Math.max(longestSide * 0.04, 0.008);
  const disposables: { dispose: () => void }[] = [];
  const labels: DimensionLabelEntry[] = [];

  const addGuide = (
    id: string,
    color: Color3,
    start: Vector3,
    end: Vector3,
    labelPosition: Vector3,
    labelText: string,
  ) => {
    const line = createGuideLine(scene, `objectEditorDim_${id}`, color, start, end);
    disposables.push(line);

    const labelEntry = createDimensionLabel(
      scene,
      `objectEditorDim_${id}_label`,
      labelText,
      color,
      labelPosition,
    );
    disposables.push(labelEntry.mesh);
    labels.push(labelEntry);
  };

  addGuide(
    "x",
    AXIS_COLORS.x,
    new Vector3(min.x, min.y, min.z),
    new Vector3(max.x, min.y, min.z),
    new Vector3((min.x + max.x) / 2, min.y - labelOffset, min.z - labelOffset),
    modelDimensionShort(size.x),
  );
  addGuide(
    "y",
    AXIS_COLORS.y,
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, max.y, min.z),
    new Vector3(min.x - labelOffset, (min.y + max.y) / 2, min.z - labelOffset),
    modelDimensionShort(size.y),
  );
  addGuide(
    "z",
    AXIS_COLORS.z,
    new Vector3(min.x, min.y, min.z),
    new Vector3(min.x, min.y, max.z),
    new Vector3(min.x - labelOffset, min.y - labelOffset, (min.z + max.z) / 2),
    modelDimensionShort(size.z),
  );

  for (const guide of resolveSupplementalMeasurementGuides(root, min, max)) {
    addGuide(
      guide.id,
      guide.color,
      guide.start,
      guide.end,
      guide.start.clone().addInPlace(guide.end).scaleInPlace(0.5),
      guide.label,
    );
  }

  return {
    syncLabels: (camera, scene) => {
      syncLabelEntries(labels, camera, scene);
    },
    dispose: () => {
      for (const disposable of disposables) {
        disposable.dispose();
      }
    },
  };
}
