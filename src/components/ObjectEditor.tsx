"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  LinesMesh,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
  VertexBuffer,
  VertexData,
} from "@babylonjs/core";
import { GizmoManager } from "@babylonjs/core/Gizmos/gizmoManager";
import "@babylonjs/core/Rendering/outlineRenderer";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowsRotate,
  faBorderAll,
  faCrosshairs,
  faCube,
  faExpand,
  faHand,
  faLightbulb,
  faLink,
  faPalette,
  faRotateLeft,
  faRotateRight,
  faRotate,
  faRulerCombined,
  faTags,
  faUpDownLeftRight,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";
import { loadGltfModel, loadGltfModelFromFile } from "@/lib/assets/loadGltfModel";
import {
  applyOilBarrelInteriorFireSetting,
  applyOilBarrelFireTuning,
  attachModelOverlays,
  getOilBarrelFireTuning,
  tickModelOverlays,
} from "@/lib/oilBarrel/attachModelOverlays";
import {
  resetOilBarrelInteriorVideoCache,
  resumeOilBarrelInteriorVideoPlayback,
} from "@/lib/oilBarrel/oilBarrelInteriorVideo";
import { isOilBarrelModelPath } from "@/lib/oilBarrel/oilBarrelAssets";
import {
  getDefaultOilBarrelEditorFireTuning,
  loadOilBarrelEditorFireTuningPatch,
  loadOilBarrelEditorInteriorFire,
  mergeOilBarrelEditorFireTuning,
  normalizeOilBarrelEditorFireTuning,
  saveOilBarrelEditorFireTuningPatch,
  saveOilBarrelEditorInteriorFire,
} from "@/lib/oilBarrel/oilBarrelEditorSettings";
import {
  getOilBarrelFireTuningControlLimits,
  OIL_BARREL_FIRE_TUNING_CONTROL_GROUPS,
  saveOilBarrelFireTuningToOverlay,
} from "@/lib/oilBarrel/oilBarrelEditorFireControls";
import type { OilBarrelFireTuning } from "@/lib/oilBarrel/oilBarrelTuning";
import {
  DEFAULT_MODEL_LIBRARY_FOLDER,
  OBJECT_EDITOR_ASSETS,
  type ObjectEditorAsset,
} from "@/lib/objectEditor/catalog";
import { DEFAULT_OUTDOOR_LIGHTING } from "@/lib/lighting/outdoorLightingTuning";
import { kelvinToRgb } from "@/lib/lighting/tuning";
import {
  defaultFolderFromFileName,
  defaultModelNameFromFileName,
  parseModelPublicPath,
  parseModelSegments,
  titleCaseSegment,
} from "@/lib/objectEditor/modelPath";
import { exportTransformNodeToGlb } from "@/lib/objectEditor/exportEditedGlb";
import {
  applyMaterialUvTransform,
  collectMaterialTextures,
  readMaterialUvTransform,
} from "@/lib/objectEditor/materialUv";
import {
  applyMeshFaceUvSnapshot,
  captureMeshFaceUvSnapshot,
  ensureMeshUvBaseline,
  getFaceUvRotationDeg,
  meshHasFaceUvs,
  normalizeFaceUvRotationDeg,
  setFaceUvRotationDeg,
} from "@/lib/objectEditor/meshFaceUv";
import {
  deleteModelFromServer,
  fetchModelLibrary,
  previewSavedAssetPath,
  saveModelToServer,
} from "@/lib/objectEditor/userCatalog";
import {
  applyObjectEditorViewModes,
  clearObjectEditorMaterialSnapshots,
  type ObjectEditorViewModes,
} from "@/lib/objectEditor/applyViewerModes";
import {
  clampNumber,
  defaultButtonStep,
  steppedValue,
} from "@/lib/ui/numericStep";
import {
  buildModelTree,
  collectFolderIds,
  collectFolderIdsForAsset,
} from "@/lib/objectEditor/buildModelTree";
import {
  createViewportRulerState,
  type ViewportRulerState,
} from "@/lib/objectEditor/viewportRuler";
import {
  createModelDimensionGuides,
  type ModelDimensionGuideSet,
} from "@/lib/objectEditor/modelDimensionGuides";
import {
  createViewportAxisLegendState,
  type ViewportAxisLegendState,
} from "@/lib/objectEditor/viewportAxisLegend";
import {
  detectModelToggleControls,
  setModelToggleOpen,
  snapModelToggleOpen,
  type ModelToggleControl,
  type ModelToggleId,
} from "@/lib/objectEditor/containerDoorAnimations";
import ObjectEditorAxisLegend from "@/components/objectEditor/ObjectEditorAxisLegend";
import ViewportRulerMark from "@/components/objectEditor/ViewportRulerMark";
import ObjectEditorTree from "@/components/objectEditor/ObjectEditorTree";

type ViewerStatus = "idle" | "loading" | "ready" | "error";
type SaveStatus = "idle" | "saving" | "success" | "error";
type GizmoMode = "move" | "rotate" | "scale";
type ViewportMode = "rotate" | "pan";

type EditorSelection =
  | { type: "catalog"; assetId: string }
  | { type: "local"; file: File; loadKey: number };

type DisplayAsset = {
  id: string;
  name: string;
  category: string;
  type: "glb";
  path: string;
  notes?: string;
  animationToggles?: ObjectEditorAsset["animationToggles"];
};

type EditableMaterialKind = "pbr" | "standard" | "unsupported";

type SurfaceSelection = {
  meshId: number;
  faceId: number;
  meshName: string;
  regionMeshCount: number;
  materialName: string;
  materialKind: EditableMaterialKind;
  uvScaleU: number;
  uvScaleV: number;
  uvOffsetU: number;
  uvOffsetV: number;
  faceUvRotationDeg: number;
  geometryWidth: number;
  geometryHeight: number;
  drawOrder: number;
  alpha: number;
  albedoColor: string;
  emissiveColor: string;
  metallic: number;
  roughness: number;
  unlit: boolean;
  twoSided: boolean;
  depthWrite: boolean;
  forceDepthWrite: boolean;
  depthTest: boolean;
  renderBias: number;
  hasEditableTextures: boolean;
  hasEditableFaceUvs: boolean;
};

type GeometryControlRanges = {
  width: { min: number; max: number; step: number };
  height: { min: number; max: number; step: number };
};

type VectorSnapshot = {
  x: number;
  y: number;
  z: number;
};

type TransformSnapshot = {
  position: VectorSnapshot;
  rotation: VectorSnapshot;
  scaling: VectorSnapshot;
};

type MaterialSnapshot = {
  kind: EditableMaterialKind;
  alpha: number;
  albedoColor: string;
  emissiveColor: string;
  metallic: number;
  roughness: number;
  unlit: boolean;
  twoSided: boolean;
  depthWrite: boolean;
  forceDepthWrite: boolean;
  depthTest: boolean;
  renderBias: number;
  uvScaleU: number;
  uvScaleV: number;
  uvOffsetU: number;
  uvOffsetV: number;
};

type MeshFaceUvSnapshot = {
  uvs: number[];
  faceIslands: Record<string, { vertexIndices: number[]; rotationDeg: number }>;
};

type MeshHistorySnapshot = {
  meshId: number;
  transform: TransformSnapshot;
  geometryPositions: number[] | null;
  geometryNormals: number[] | null;
  drawOrder: number;
  material: MaterialSnapshot | null;
  faceUv: MeshFaceUvSnapshot | null;
};

type ObjectEditorHistorySnapshot = {
  root: TransformSnapshot;
  meshes: MeshHistorySnapshot[];
};

type ModelToggleStateMap = Record<string, boolean>;

const objectEditorMaterialClones = new WeakSet<Material>();

function colorFromKelvin(kelvin: number): Color3 {
  const rgb = kelvinToRgb(kelvin);
  return new Color3(rgb.r, rgb.g, rgb.b);
}

const OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY = 1000;
const OBJECT_EDITOR_FRAME_ALPHA = Math.PI * 1.3;
const OBJECT_EDITOR_FRAME_BETA = Math.PI * 0.38;
const OBJECT_EDITOR_FRAME_FILL = 0.8;
const OBJECT_EDITOR_MODEL_PREFIX = "objectEditor_";
const OBJECT_EDITOR_SCALE_GIZMO_SENSITIVITY = 6;
const OBJECT_EDITOR_MIN_SCALE = 0.001;
const OBJECT_EDITOR_VIEWPORT_RULER_SYNC_MS = 40;

function disposeEditorModelRoots(scene: Scene): void {
  for (const node of scene.transformNodes.slice()) {
    if (node.name.startsWith(OBJECT_EDITOR_MODEL_PREFIX)) {
      node.dispose(false, true);
    }
  }
}

function updateObjectEditorPanSensibility(
  camera: ArcRotateCamera,
  objectSize: number,
): void {
  const longestSide = Math.max(objectSize, 0.001);
  camera.metadata = {
    ...camera.metadata,
    objectEditorLongestSide: longestSide,
  };
  syncObjectEditorPanSensibility(camera);
}

function syncObjectEditorPanSensibility(camera: ArcRotateCamera): void {
  const longestSide = camera.metadata?.objectEditorLongestSide;
  if (typeof longestSide !== "number") {
    camera.panningSensibility = OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY;
    return;
  }

  camera.panningSensibility = Math.max(
    OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY,
    3500 / longestSide,
  );
}

function updateCameraDepthLimits(camera: ArcRotateCamera, root: TransformNode) {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const longestSide = Math.max(size.x, size.y, size.z, 0.001);
  camera.minZ = Math.max(longestSide * 0.0005, 0.00001);
  camera.maxZ = Math.max(longestSide * 1000, 1000);
  updateObjectEditorPanSensibility(camera, longestSide);
}

function frameObjectInCamera(
  camera: ArcRotateCamera,
  root: TransformNode,
  canvas: HTMLCanvasElement | null,
): void {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const center = bounds.min.add(size.scale(0.5));
  const boundingRadius = Math.max(size.length() * 0.5, 0.001);
  const aspect =
    canvas && canvas.clientHeight > 0
      ? Math.max(canvas.clientWidth / canvas.clientHeight, 0.001)
      : 1;
  const verticalFov = camera.fov;
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
  const limitingFov = Math.min(verticalFov, horizontalFov);
  const targetHalfAngle = Math.max(
    (limitingFov * OBJECT_EDITOR_FRAME_FILL) / 2,
    0.001,
  );
  const radius = boundingRadius / Math.sin(targetHalfAngle);

  camera.alpha = OBJECT_EDITOR_FRAME_ALPHA;
  camera.beta = OBJECT_EDITOR_FRAME_BETA;
  camera.target = center;
  camera.radius = Math.max(radius, 0.001);
  updateCameraDepthLimits(camera, root);
}

function setObjectEditorCameraInputMap(
  camera: ArcRotateCamera,
  mode: ViewportMode,
): void {
  const input = camera.movement?.input as
    | {
        inputMap: Array<{
          source?: string;
          button?: number;
          modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean };
          interaction?: string;
        }>;
        addEntry: (entry: {
          source: string;
          button?: number;
          modifiers?: { ctrl?: boolean; shift?: boolean; alt?: boolean };
          interaction: string;
        }) => void;
      }
    | undefined;
  if (!input) {
    return;
  }

  input.inputMap = input.inputMap.filter(
    (entry) =>
      !(
        entry.source === "pointer" &&
        entry.button === 0 &&
        (entry.interaction === "pan" || entry.interaction === "rotate")
      ),
  );

  if (mode === "pan") {
    input.addEntry({ source: "pointer", button: 0, interaction: "pan" });
    return;
  }

  input.addEntry({
    source: "pointer",
    button: 0,
    modifiers: { ctrl: true },
    interaction: "pan",
  });
  input.addEntry({ source: "pointer", button: 0, interaction: "rotate" });
}

function applyViewportMode(camera: ArcRotateCamera, mode: ViewportMode): void {
  camera.detachControl();
  camera.attachControl(true, false, mode === "pan" ? 0 : 2);
  setObjectEditorCameraInputMap(camera, mode);
}

function configureMeshes(root: TransformNode) {
  for (const mesh of root.getChildMeshes(false)) {
    if (mesh instanceof Mesh) {
      mesh.metadata = {
        ...mesh.metadata,
        objectEditorMaterialRegionKey: materialRegionKey(mesh),
      };
      mesh.isPickable = true;
      mesh.receiveShadows = true;
      mesh.alwaysSelectAsActiveMesh = true;
      ensureMeshUvBaseline(mesh);
    }
  }
}

function colorToHex(color: Color3): string {
  const toHex = (value: number) =>
    Math.round(Math.min(Math.max(value, 0), 1) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`;
}

function hexToColor(value: string): Color3 {
  const match = /^#?([0-9a-f]{6})$/i.exec(value);
  if (!match) {
    return Color3.White();
  }
  const raw = match[1];
  return new Color3(
    parseInt(raw.slice(0, 2), 16) / 255,
    parseInt(raw.slice(2, 4), 16) / 255,
    parseInt(raw.slice(4, 6), 16) / 255,
  );
}

function materialKind(material: Material | null): EditableMaterialKind {
  if (material instanceof PBRMaterial) return "pbr";
  if (material instanceof StandardMaterial) return "standard";
  return "unsupported";
}

function materialRegionKey(mesh: Mesh): string {
  return String(
    mesh.metadata?.objectEditorMaterialRegionKey ??
      mesh.material?.uniqueId ??
      mesh.material?.name ??
      `mesh-${mesh.uniqueId}`,
  );
}

type GeometryAxis = "x" | "y" | "z";
type SurfaceGeometryAxes = {
  widthAxis: GeometryAxis;
  heightAxis: GeometryAxis;
};

type LocalGeometryBounds = Record<GeometryAxis, { min: number; max: number; size: number }>;

const AXES: GeometryAxis[] = ["x", "y", "z"];

function axisOffset(axis: GeometryAxis): number {
  if (axis === "x") return 0;
  if (axis === "y") return 1;
  return 2;
}

function meshPositions(mesh: Mesh): Float32Array | null {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  return positions ? new Float32Array(positions) : null;
}

function meshFaceVertexIndices(mesh: Mesh, faceId: number): number[] {
  const indices = mesh.getIndices();
  if (!indices || faceId < 0) {
    return [];
  }
  const offset = faceId * 3;
  if (offset + 2 >= indices.length) {
    return [];
  }
  return [indices[offset], indices[offset + 1], indices[offset + 2]];
}

function localPositionAt(positions: Float32Array, vertexIndex: number): Vector3 {
  return new Vector3(
    positions[vertexIndex * 3],
    positions[vertexIndex * 3 + 1],
    positions[vertexIndex * 3 + 2],
  );
}

function localAxisVector(axis: GeometryAxis): Vector3 {
  if (axis === "x") return new Vector3(1, 0, 0);
  if (axis === "y") return new Vector3(0, 1, 0);
  return new Vector3(0, 0, 1);
}

function faceLocalNormal(mesh: Mesh, faceId: number): Vector3 {
  const positions = meshPositions(mesh);
  const indices = positions ? meshFaceVertexIndices(mesh, faceId) : [];
  if (!positions || indices.length !== 3) {
    return new Vector3(0, 0, 1);
  }
  const a = localPositionAt(positions, indices[0]);
  const b = localPositionAt(positions, indices[1]);
  const c = localPositionAt(positions, indices[2]);
  const normal = Vector3.Cross(b.subtract(a), c.subtract(a));
  if (normal.lengthSquared() <= 1e-8) {
    return new Vector3(0, 0, 1);
  }
  return normal.normalize();
}

function faceLocalCenter(mesh: Mesh, faceId: number): Vector3 {
  const positions = meshPositions(mesh);
  const indices = positions ? meshFaceVertexIndices(mesh, faceId) : [];
  if (!positions || indices.length !== 3) {
    return Vector3.Zero();
  }
  return localPositionAt(positions, indices[0])
    .add(localPositionAt(positions, indices[1]))
    .add(localPositionAt(positions, indices[2]))
    .scale(1 / 3);
}

function surfaceLocalCenter(mesh: Mesh, faceId: number): Vector3 {
  const positions = meshPositions(mesh);
  const indices = mesh.getIndices();
  if (!positions || !indices || faceId < 0) {
    return faceLocalCenter(mesh, faceId);
  }

  const selectedNormal = faceLocalNormal(mesh, faceId);
  const selectedCenter = faceLocalCenter(mesh, faceId);
  const normalAxis = dominantAxisFromNormal(selectedNormal);
  const planeAxes = AXES.filter((axis) => axis !== normalAxis);
  if (planeAxes.length !== 2) {
    return selectedCenter;
  }

  const allBounds = {
    x: { min: Infinity, max: -Infinity },
    y: { min: Infinity, max: -Infinity },
    z: { min: Infinity, max: -Infinity },
  };
  for (let index = 0; index < positions.length; index += 3) {
    allBounds.x.min = Math.min(allBounds.x.min, positions[index]);
    allBounds.x.max = Math.max(allBounds.x.max, positions[index]);
    allBounds.y.min = Math.min(allBounds.y.min, positions[index + 1]);
    allBounds.y.max = Math.max(allBounds.y.max, positions[index + 1]);
    allBounds.z.min = Math.min(allBounds.z.min, positions[index + 2]);
    allBounds.z.max = Math.max(allBounds.z.max, positions[index + 2]);
  }
  const meshSpan = Math.max(
    allBounds.x.max - allBounds.x.min,
    allBounds.y.max - allBounds.y.min,
    allBounds.z.max - allBounds.z.min,
    0.001,
  );
  const planeTolerance = Math.max(meshSpan * 0.01, 0.001);
  const planeBounds = {
    [planeAxes[0]]: { min: Infinity, max: -Infinity },
    [planeAxes[1]]: { min: Infinity, max: -Infinity },
  } as Record<GeometryAxis, { min: number; max: number }>;

  for (let triangle = 0; triangle + 2 < indices.length; triangle += 3) {
    const a = localPositionAt(positions, indices[triangle]);
    const b = localPositionAt(positions, indices[triangle + 1]);
    const c = localPositionAt(positions, indices[triangle + 2]);
    const normal = Vector3.Cross(b.subtract(a), c.subtract(a));
    if (normal.lengthSquared() <= 1e-8) {
      continue;
    }
    if (Math.abs(Vector3.Dot(normal.normalize(), selectedNormal)) < 0.98) {
      continue;
    }
    const triangleCenter = a.add(b).add(c).scale(1 / 3);
    const planeDistance = Math.abs(
      Vector3.Dot(triangleCenter.subtract(selectedCenter), selectedNormal),
    );
    if (planeDistance > planeTolerance) {
      continue;
    }

    for (const point of [a, b, c]) {
      for (const axis of planeAxes) {
        planeBounds[axis].min = Math.min(planeBounds[axis].min, point[axis]);
        planeBounds[axis].max = Math.max(planeBounds[axis].max, point[axis]);
      }
    }
  }

  if (
    !Number.isFinite(planeBounds[planeAxes[0]].min) ||
    !Number.isFinite(planeBounds[planeAxes[1]].min)
  ) {
    return selectedCenter;
  }

  const center = selectedCenter.clone();
  for (const axis of planeAxes) {
    center[axis] = (planeBounds[axis].min + planeBounds[axis].max) / 2;
  }
  return center;
}

function surfaceWorldCenter(mesh: Mesh, faceId: number): Vector3 {
  return Vector3.TransformCoordinates(surfaceLocalCenter(mesh, faceId), mesh.getWorldMatrix());
}

function surfaceWorldRotation(mesh: Mesh, faceId: number): Quaternion {
  const axes = surfaceGeometryAxes(mesh, faceId);
  const world = mesh.getWorldMatrix();
  const xAxis = Vector3.TransformNormal(localAxisVector(axes.widthAxis), world).normalize();
  const yAxis = Vector3.TransformNormal(localAxisVector(axes.heightAxis), world).normalize();
  const normal = Vector3.TransformNormal(faceLocalNormal(mesh, faceId), world).normalize();
  const frame = Matrix.Identity();
  Matrix.FromXYZAxesToRef(xAxis, yAxis, normal, frame);
  return Quaternion.FromRotationMatrix(frame);
}

function syncSurfaceGizmoProxy(
  proxy: TransformNode,
  mesh: Mesh,
  faceId: number,
  alignToSurface = false,
): void {
  proxy.position = surfaceWorldCenter(mesh, faceId);
  proxy.rotationQuaternion = alignToSurface
    ? surfaceWorldRotation(mesh, faceId)
    : Quaternion.Identity();
  proxy.scaling = Vector3.One();
  proxy.computeWorldMatrix(true);
}

function applySurfaceGizmoProxyDelta(
  proxy: TransformNode,
  drag: {
    mesh: Mesh;
    proxyWorldMatrix: Matrix;
    meshWorldMatrix: Matrix;
  },
): void {
  const proxyWorld = proxy.computeWorldMatrix(true);
  const proxyDelta = drag.proxyWorldMatrix.clone().invert().multiply(proxyWorld);
  let nextMeshMatrix = drag.meshWorldMatrix.multiply(proxyDelta);
  const parent = drag.mesh.parent;
  if (parent && "getWorldMatrix" in parent) {
    nextMeshMatrix = nextMeshMatrix.multiply(parent.getWorldMatrix().clone().invert());
  }
  const nextScale = Vector3.One();
  const nextRotation = Quaternion.Identity();
  const nextPosition = Vector3.Zero();
  nextMeshMatrix.decompose(nextScale, nextRotation, nextPosition);
  drag.mesh.position = nextPosition;
  drag.mesh.rotationQuaternion = nextRotation;
  drag.mesh.scaling = nextScale;
  drag.mesh.computeWorldMatrix(true);
}

function dominantAxisFromNormal(normal: Vector3): GeometryAxis {
  const absX = Math.abs(normal.x);
  const absY = Math.abs(normal.y);
  const absZ = Math.abs(normal.z);
  if (absZ >= absX && absZ >= absY) return "z";
  if (absY >= absX) return "y";
  return "x";
}

function surfaceGeometryAxes(mesh: Mesh, faceId: number): SurfaceGeometryAxes {
  const normalAxis = dominantAxisFromNormal(faceLocalNormal(mesh, faceId));
  const planeAxes = AXES.filter((axis) => axis !== normalAxis);
  if (planeAxes.length === 2) {
    return { widthAxis: planeAxes[0], heightAxis: planeAxes[1] };
  }

  return { widthAxis: "x", heightAxis: "y" };
}

function localGeometryBounds(mesh: Mesh): LocalGeometryBounds | null {
  const positions = meshPositions(mesh);
  if (!positions || positions.length < 3) {
    return null;
  }

  const bounds: LocalGeometryBounds = {
    x: { min: Infinity, max: -Infinity, size: 0 },
    y: { min: Infinity, max: -Infinity, size: 0 },
    z: { min: Infinity, max: -Infinity, size: 0 },
  };

  for (let index = 0; index < positions.length; index += 3) {
    bounds.x.min = Math.min(bounds.x.min, positions[index]);
    bounds.x.max = Math.max(bounds.x.max, positions[index]);
    bounds.y.min = Math.min(bounds.y.min, positions[index + 1]);
    bounds.y.max = Math.max(bounds.y.max, positions[index + 1]);
    bounds.z.min = Math.min(bounds.z.min, positions[index + 2]);
    bounds.z.max = Math.max(bounds.z.max, positions[index + 2]);
  }

  for (const axis of AXES) {
    bounds[axis].size = Math.max(bounds[axis].max - bounds[axis].min, 0);
  }

  return bounds;
}

function selectedGeometryDimensions(mesh: Mesh, faceId: number): {
  width: number;
  height: number;
} {
  const axes = surfaceGeometryAxes(mesh, faceId);
  const bounds = localGeometryBounds(mesh);
  if (!bounds) {
    return { width: 0, height: 0 };
  }
  return {
    width: bounds[axes.widthAxis].size,
    height: bounds[axes.heightAxis].size,
  };
}

function focusedGeometryRange(value: number): { min: number; max: number; step: number } {
  const safeValue = Math.max(value, 0.001);
  const span = Math.max(safeValue * 0.25, 0.02);
  return {
    min: Math.max(0.001, safeValue - span),
    max: safeValue + span,
    step: Math.max(safeValue * 0.001, 0.001),
  };
}

function refreshMeshVertexGeometry(mesh: Mesh): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const indices = mesh.getIndices();
  if (positions && indices) {
    const normals: number[] = [];
    VertexData.ComputeNormals(positions, indices, normals);
    mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
  }
  mesh.refreshBoundingInfo(true);
  mesh.computeWorldMatrix(true);
}

function applyGeometryData(
  mesh: Mesh,
  positions: number[] | null,
  normals: number[] | null,
): void {
  if (!positions) {
    return;
  }
  mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
  if (normals) {
    mesh.setVerticesData(VertexBuffer.NormalKind, normals, true);
    mesh.refreshBoundingInfo(true);
    mesh.computeWorldMatrix(true);
    return;
  }
  refreshMeshVertexGeometry(mesh);
}

function resizeMeshGeometryOnAxes(
  mesh: Mesh,
  axes: SurfaceGeometryAxes,
  nextWidth: number,
  nextHeight: number,
): boolean {
  const positions = meshPositions(mesh);
  const bounds = localGeometryBounds(mesh);
  if (!positions || !bounds) {
    return false;
  }

  const widthSize = bounds[axes.widthAxis].size;
  const heightSize = bounds[axes.heightAxis].size;
  if (widthSize <= 0 || heightSize <= 0 || nextWidth <= 0 || nextHeight <= 0) {
    return false;
  }

  const widthScale = nextWidth / widthSize;
  const heightScale = nextHeight / heightSize;
  const widthCenter =
    (bounds[axes.widthAxis].min + bounds[axes.widthAxis].max) / 2;
  const heightCenter =
    (bounds[axes.heightAxis].min + bounds[axes.heightAxis].max) / 2;
  const widthOffset = axisOffset(axes.widthAxis);
  const heightOffset = axisOffset(axes.heightAxis);

  for (let index = 0; index < positions.length; index += 3) {
    positions[index + widthOffset] =
      widthCenter + (positions[index + widthOffset] - widthCenter) * widthScale;
    positions[index + heightOffset] =
      heightCenter + (positions[index + heightOffset] - heightCenter) * heightScale;
  }

  mesh.setVerticesData(VertexBuffer.PositionKind, positions, true);
  refreshMeshVertexGeometry(mesh);
  return true;
}

function isModelPickMesh(root: TransformNode | null, candidate: unknown): candidate is Mesh {
  if (!(candidate instanceof Mesh) || !candidate.isPickable) {
    return false;
  }
  return Boolean(root?.getChildMeshes(false).includes(candidate));
}

function meshWorldSizeScore(mesh: Mesh): number {
  mesh.computeWorldMatrix(true);
  const box = mesh.getBoundingInfo().boundingBox;
  return box.extendSizeWorld.length();
}

function pickEditableSurface(
  scene: Scene,
  root: TransformNode | null,
  x: number,
  y: number,
) {
  const picks = scene.multiPick(x, y, (candidate) =>
    isModelPickMesh(root, candidate),
  );
  const hits =
    picks?.filter(
      (pick) => pick.hit && pick.pickedMesh instanceof Mesh && pick.faceId >= 0,
    ) ?? [];
  if (hits.length === 0) {
    return null;
  }

  const nearestDistance = Math.min(
    ...hits.map((pick) => pick.distance || Number.MAX_VALUE),
  );
  const closeHits = hits.filter(
    (pick) => (pick.distance || 0) <= nearestDistance + 0.12,
  );
  return closeHits.sort((left, right) => {
    const leftMesh = left.pickedMesh as Mesh;
    const rightMesh = right.pickedMesh as Mesh;
    const sizeDelta = meshWorldSizeScore(leftMesh) - meshWorldSizeScore(rightMesh);
    if (Math.abs(sizeDelta) > 0.001) {
      return sizeDelta;
    }
    return (left.distance || 0) - (right.distance || 0);
  })[0];
}

function editableMaterialFromRegion(regionMeshes: Mesh[], sourceMesh: Mesh): Material | null {
  const material = sourceMesh.material;
  if (!material) {
    return null;
  }
  if (objectEditorMaterialClones.has(material)) {
    return material;
  }
  if (material instanceof PBRMaterial || material instanceof StandardMaterial) {
    const clone = material.clone(
      `${material.name || sourceMesh.name}_region_${sourceMesh.uniqueId}`,
    );
    if (clone) {
      objectEditorMaterialClones.add(clone);
      for (const mesh of regionMeshes) {
        mesh.material = clone;
      }
      return clone;
    }
  }
  return material;
}

function surfaceSelectionFromMesh(
  mesh: Mesh,
  regionMeshes: Mesh[],
  faceId: number,
): SurfaceSelection {
  const material = editableMaterialFromRegion(regionMeshes, mesh);
  const kind = materialKind(material);
  const albedoColor =
    material instanceof PBRMaterial
      ? material.albedoColor
      : material instanceof StandardMaterial
        ? material.diffuseColor
        : Color3.White();
  const emissiveColor =
    material instanceof PBRMaterial || material instanceof StandardMaterial
      ? material.emissiveColor
      : Color3.Black();
  const uv = readMaterialUvTransform(material);
  const geometry = selectedGeometryDimensions(mesh, faceId);

  return {
    meshId: mesh.uniqueId,
    faceId,
    meshName: mesh.name || `mesh_${mesh.uniqueId}`,
    regionMeshCount: regionMeshes.length,
    materialName: material?.name || "No material",
    materialKind: kind,
    hasEditableTextures: collectMaterialTextures(material).length > 0,
    hasEditableFaceUvs: meshHasFaceUvs(mesh) && faceId >= 0,
    uvScaleU: uv.uvScaleU,
    uvScaleV: uv.uvScaleV,
    uvOffsetU: uv.uvOffsetU,
    uvOffsetV: uv.uvOffsetV,
    faceUvRotationDeg: normalizeFaceUvRotationDeg(getFaceUvRotationDeg(mesh, faceId)),
    geometryWidth: geometry.width,
    geometryHeight: geometry.height,
    drawOrder: mesh.alphaIndex,
    alpha: material?.alpha ?? 1,
    albedoColor: colorToHex(albedoColor),
    emissiveColor: colorToHex(emissiveColor),
    metallic: material instanceof PBRMaterial ? material.metallic ?? 0 : 0,
    roughness: material instanceof PBRMaterial ? material.roughness ?? 0.5 : 0.5,
    twoSided: !material?.backFaceCulling,
    depthWrite: !material?.disableDepthWrite,
    forceDepthWrite: material?.forceDepthWrite ?? false,
    depthTest: material?.depthFunction !== Engine.ALWAYS,
    renderBias: material?.zOffset ?? 0,
    unlit:
      material instanceof PBRMaterial
        ? material.unlit
        : material instanceof StandardMaterial
          ? material.disableLighting
          : false,
  };
}

function vectorSnapshot(vector: Vector3): VectorSnapshot {
  return {
    x: vector.x,
    y: vector.y,
    z: vector.z,
  };
}

function nodeRotationSnapshot(node: TransformNode): VectorSnapshot {
  const rotation = node.rotationQuaternion
    ? node.rotationQuaternion.toEulerAngles()
    : node.rotation;
  return vectorSnapshot(rotation);
}

function captureTransform(node: TransformNode): TransformSnapshot {
  return {
    position: vectorSnapshot(node.position),
    rotation: nodeRotationSnapshot(node),
    scaling: vectorSnapshot(node.scaling),
  };
}

function applyTransform(node: TransformNode, snapshot: TransformSnapshot): void {
  node.position.set(snapshot.position.x, snapshot.position.y, snapshot.position.z);
  node.rotationQuaternion = null;
  node.rotation.set(snapshot.rotation.x, snapshot.rotation.y, snapshot.rotation.z);
  node.scaling.set(snapshot.scaling.x, snapshot.scaling.y, snapshot.scaling.z);
  node.computeWorldMatrix(true);
}

function clampObjectEditorScale(node: TransformNode): void {
  node.scaling.set(
    Math.max(node.scaling.x, OBJECT_EDITOR_MIN_SCALE),
    Math.max(node.scaling.y, OBJECT_EDITOR_MIN_SCALE),
    Math.max(node.scaling.z, OBJECT_EDITOR_MIN_SCALE),
  );
}

function captureMaterial(material: Material | null): MaterialSnapshot | null {
  if (!material) {
    return null;
  }
  const kind = materialKind(material);
  const albedoColor =
    material instanceof PBRMaterial
      ? material.albedoColor
      : material instanceof StandardMaterial
        ? material.diffuseColor
        : Color3.White();
  const emissiveColor =
    material instanceof PBRMaterial || material instanceof StandardMaterial
      ? material.emissiveColor
      : Color3.Black();

  return {
    kind,
    alpha: material.alpha,
    albedoColor: colorToHex(albedoColor),
    emissiveColor: colorToHex(emissiveColor),
    metallic: material instanceof PBRMaterial ? material.metallic ?? 0 : 0,
    roughness: material instanceof PBRMaterial ? material.roughness ?? 0.5 : 0.5,
    twoSided: !material.backFaceCulling,
    depthWrite: !material.disableDepthWrite,
    forceDepthWrite: material.forceDepthWrite,
    depthTest: material.depthFunction !== Engine.ALWAYS,
    renderBias: material.zOffset ?? 0,
    unlit:
      material instanceof PBRMaterial
        ? material.unlit
        : material instanceof StandardMaterial
          ? material.disableLighting
          : false,
    ...readMaterialUvTransform(material),
  };
}

function applyMaterial(material: Material | null, snapshot: MaterialSnapshot | null): void {
  if (!material || !snapshot) {
    return;
  }
  applyMaterialUvTransform(material, snapshot);

  material.alpha = snapshot.alpha;
  material.backFaceCulling = !snapshot.twoSided;
  material.disableDepthWrite = !snapshot.depthWrite;
  material.forceDepthWrite = snapshot.forceDepthWrite ?? false;
  material.depthFunction = snapshot.depthTest ? Engine.LEQUAL : Engine.ALWAYS;
  material.zOffset = snapshot.renderBias;
  if (material instanceof PBRMaterial) {
    material.albedoColor = hexToColor(snapshot.albedoColor);
    material.emissiveColor = hexToColor(snapshot.emissiveColor);
    material.metallic = snapshot.metallic;
    material.roughness = snapshot.roughness;
    material.unlit = snapshot.unlit;
  } else if (material instanceof StandardMaterial) {
    material.diffuseColor = hexToColor(snapshot.albedoColor);
    material.emissiveColor = hexToColor(snapshot.emissiveColor);
    material.disableLighting = snapshot.unlit;
  }
}

function captureObjectEditorSnapshot(
  root: TransformNode | null,
): ObjectEditorHistorySnapshot | null {
  if (!root) {
    return null;
  }

  return {
    root: captureTransform(root),
    meshes: root.getChildMeshes(false).flatMap((mesh): MeshHistorySnapshot[] => {
      if (!(mesh instanceof Mesh)) {
        return [];
      }
      return [
        {
          meshId: mesh.uniqueId,
          transform: captureTransform(mesh),
          geometryPositions: mesh.getVerticesData(VertexBuffer.PositionKind)
            ? Array.from(mesh.getVerticesData(VertexBuffer.PositionKind) ?? [])
            : null,
          geometryNormals: mesh.getVerticesData(VertexBuffer.NormalKind)
            ? Array.from(mesh.getVerticesData(VertexBuffer.NormalKind) ?? [])
            : null,
          drawOrder: mesh.alphaIndex,
          material: captureMaterial(mesh.material),
          faceUv: captureMeshFaceUvSnapshot(mesh),
        },
      ];
    }),
  };
}

function applyObjectEditorSnapshot(
  root: TransformNode | null,
  snapshot: ObjectEditorHistorySnapshot,
): void {
  if (!root) {
    return;
  }

  applyTransform(root, snapshot.root);
  const meshesById = new Map<number, Mesh>();
  for (const mesh of root.getChildMeshes(false)) {
    if (mesh instanceof Mesh) {
      meshesById.set(mesh.uniqueId, mesh);
    }
  }

  for (const meshSnapshot of snapshot.meshes) {
    const mesh = meshesById.get(meshSnapshot.meshId);
    if (!mesh) {
      continue;
    }
    applyTransform(mesh, meshSnapshot.transform);
    applyGeometryData(
      mesh,
      meshSnapshot.geometryPositions,
      meshSnapshot.geometryNormals,
    );
    mesh.alphaIndex = meshSnapshot.drawOrder;
    applyMaterial(mesh.material, meshSnapshot.material);
    if (meshSnapshot.faceUv) {
      applyMeshFaceUvSnapshot(mesh, meshSnapshot.faceUv);
    }
    mesh.refreshBoundingInfo();
  }
}

function snapshotsMatch(
  left: ObjectEditorHistorySnapshot | null,
  right: ObjectEditorHistorySnapshot | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function modelToggleStatesMatch(
  left: ModelToggleStateMap | undefined,
  right: ModelToggleStateMap | undefined,
): boolean {
  const leftEntries = Object.entries(left ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  const rightEntries = Object.entries(right ?? {}).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function folderIdsForAssetPath(assetPath: string): string[] {
  const match = /^\/models\/(.+)\/[^/]+\.glb$/i.exec(assetPath);
  if (!match) {
    return [];
  }
  const parts = match[1].split("/").filter(Boolean);
  const ids: string[] = [];
  let id = "root";
  for (const part of parts) {
    id = `${id}/${part}`;
    ids.push(id);
  }
  return ids;
}

type NumericControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  buttonStep?: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
};

type IconToggleButtonProps = {
  label: string;
  icon: IconDefinition;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
};

function IconToggleButton({
  label,
  icon,
  active = false,
  disabled = false,
  onClick,
}: IconToggleButtonProps) {
  return (
    <button
      type="button"
      className={[
        "object-editor-icon-toggle",
        active ? "object-editor-icon-toggle--active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label={label}
      aria-pressed={active}
      data-tooltip={label}
      disabled={disabled}
      onClick={onClick}
    >
      <FontAwesomeIcon icon={icon} />
      <span className="object-editor-tooltip" role="tooltip">
        {label}
      </span>
    </button>
  );
}

function NumericControl({
  label,
  value,
  min,
  max,
  step,
  buttonStep,
  disabled = false,
  onChange,
  onCommit,
}: NumericControlProps) {
  const safeValue = Number.isFinite(value) ? value : min;
  const displayValue = clampNumber(safeValue, min, max);
  const nudgeStep = buttonStep ?? defaultButtonStep(step);

  return (
    <div className="object-editor-control object-editor-control--numeric">
      <div className="object-editor-control-label-row">
        <span>{label}</span>
        <input
          type="number"
          min={min}
          max={max}
          step={nudgeStep}
          disabled={disabled}
          value={safeValue}
          onChange={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next)) {
              onChange(clampNumber(next, min, max));
            }
          }}
          onBlur={(event) => {
            const next = Number(event.currentTarget.value);
            if (Number.isFinite(next)) {
              onCommit?.(clampNumber(next, min, max));
            }
          }}
        />
      </div>
      <div className="object-editor-slider-control">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled}
          onClick={() => {
            const next = steppedValue(safeValue, nudgeStep, -1, min, max);
            onChange(next);
            onCommit?.(next);
          }}
        >
          -
        </button>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={displayValue}
          onChange={(event) => onChange(Number(event.currentTarget.value))}
          onPointerUp={(event) => onCommit?.(Number(event.currentTarget.value))}
          onKeyUp={(event) => onCommit?.(Number(event.currentTarget.value))}
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled}
          onClick={() => {
            const next = steppedValue(safeValue, nudgeStep, 1, min, max);
            onChange(next);
            onCommit?.(next);
          }}
        >
          +
        </button>
      </div>
    </div>
  );
}

const OBJECT_EDITOR_SIDEBAR_DEFAULT = 224;
const OBJECT_EDITOR_TOOLS_DEFAULT = 240;
const OBJECT_EDITOR_SIDEBAR_MIN = 160;
const OBJECT_EDITOR_SIDEBAR_MAX = 480;
const OBJECT_EDITOR_TOOLS_MIN = 180;
const OBJECT_EDITOR_TOOLS_MAX = 520;
const OBJECT_EDITOR_VIEWER_MIN = 280;
const OBJECT_EDITOR_RESIZE_HANDLE_WIDTH = 5;

type PanelResizeEdge = "sidebar" | "tools";

function clampPanelWidth(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function editorSelectionsMatch(
  left: EditorSelection | null,
  right: EditorSelection,
): boolean {
  if (!left || left.type !== right.type) {
    return false;
  }
  if (left.type === "catalog" && right.type === "catalog") {
    return left.assetId === right.assetId;
  }
  if (left.type === "local" && right.type === "local") {
    return left.file === right.file && left.loadKey === right.loadKey;
  }
  return false;
}

export default function ObjectEditor() {
  const [userAssets, setUserAssets] = useState<ObjectEditorAsset[]>([]);
  const [modelFolders, setModelFolders] = useState<string[]>([
    DEFAULT_MODEL_LIBRARY_FOLDER,
  ]);
  const allAssets = useMemo(
    () => [...OBJECT_EDITOR_ASSETS, ...userAssets],
    [userAssets],
  );
  const modelTree = useMemo(
    () => buildModelTree(allAssets),
    [allAssets],
  );
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(() =>
    new Set(collectFolderIds(buildModelTree(OBJECT_EDITOR_ASSETS))),
  );
  const [selection, setSelection] = useState<EditorSelection | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const shellRef = useRef<HTMLElement>(null);
  const [sidebarWidth, setSidebarWidth] = useState(OBJECT_EDITOR_SIDEBAR_DEFAULT);
  const [toolsWidth, setToolsWidth] = useState(OBJECT_EDITOR_TOOLS_DEFAULT);
  const [activeResizeEdge, setActiveResizeEdge] = useState<PanelResizeEdge | null>(
    null,
  );
  const panelResizeRef = useRef<{
    edge: PanelResizeEdge;
    startX: number;
    startSidebar: number;
    startTools: number;
  } | null>(null);
  const displayAsset = useMemo((): DisplayAsset | undefined => {
    if (!selection) {
      return undefined;
    }
    if (selection.type === "local") {
      return {
        id: "local-file",
        name: selection.file.name,
        category: "Local",
        type: "glb",
        path: selection.file.name,
        notes: "Loaded from your machine.",
      };
    }
    const asset = allAssets.find((entry) => entry.id === selection.assetId);
    return asset;
  }, [selection, allAssets]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<Scene | null>(null);
  const cameraRef = useRef<ArcRotateCamera | null>(null);
  const currentRootRef = useRef<TransformNode | null>(null);
  const editorLoadSequenceRef = useRef(0);
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const gridRef = useRef<LinesMesh | null>(null);
  const dimensionGuidesRef = useRef<ModelDimensionGuideSet | null>(null);
  const selectedSurfaceMeshRef = useRef<Mesh | null>(null);
  const selectedFaceIdRef = useRef<number>(-1);
  const selectedRegionMeshesRef = useRef<Mesh[]>([]);
  const surfaceGizmoProxyRef = useRef<TransformNode | null>(null);
  const surfaceGizmoDragRef = useRef<{
    mesh: Mesh;
    faceId: number;
    proxyWorldMatrix: Matrix;
    meshWorldMatrix: Matrix;
  } | null>(null);
  const geometryLiveEditSnapshotRef =
    useRef<ObjectEditorHistorySnapshot | null>(null);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [selectedSurface, setSelectedSurface] = useState<SurfaceSelection | null>(null);
  const [geometryControlRanges, setGeometryControlRanges] =
    useState<GeometryControlRanges | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [rulersVisible, setRulersVisible] = useState(true);
  const [dimensionLabelsVisible, setDimensionLabelsVisible] = useState(true);
  const dimensionLabelsVisibleRef = useRef(dimensionLabelsVisible);
  const [viewportRuler, setViewportRuler] = useState<ViewportRulerState | null>(null);
  const [viewportAxisLegend, setViewportAxisLegend] =
    useState<ViewportAxisLegendState | null>(null);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("rotate");
  const viewportModeRef = useRef<ViewportMode>("rotate");
  const [shiftPanActive, setShiftPanActive] = useState(false);
  const shiftPanActiveRef = useRef(false);
  const surfaceGizmoLocalAlignment = Boolean(selectedSurface && shiftPanActive);
  const effectiveViewportMode: ViewportMode =
    shiftPanActive && !selectedSurface ? "pan" : viewportMode;
  const [sceneReadyGeneration, setSceneReadyGeneration] = useState(0);
  const [gizmoEnabled, setGizmoEnabled] = useState(true);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("move");
  const [scaleLinked, setScaleLinked] = useState(true);
  const [viewModes, setViewModes] = useState<ObjectEditorViewModes>({
    wireframe: false,
    lighting: true,
    texture: true,
  });
  const viewModesRef = useRef(viewModes);
  const [saveFolder, setSaveFolder] = useState(DEFAULT_MODEL_LIBRARY_FOLDER);
  const [saveModelName, setSaveModelName] = useState("");
  const [saveDisplayName, setSaveDisplayName] = useState("");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveMessage, setSaveMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteStatus, setDeleteStatus] = useState<SaveStatus>("idle");
  const [deleteMessage, setDeleteMessage] = useState("");
  const [modalPortalHost, setModalPortalHost] = useState<HTMLElement | null>(null);
  const [oilBarrelEditorActive, setOilBarrelEditorActive] = useState(false);
  const [oilBarrelFireEnabled, setOilBarrelFireEnabled] = useState(
    loadOilBarrelEditorInteriorFire,
  );
  const [oilBarrelFireTuning, setOilBarrelFireTuning] = useState(
    getDefaultOilBarrelEditorFireTuning,
  );
  const [modelToggleControls, setModelToggleControls] = useState<
    ModelToggleControl[]
  >([]);
  const [modelToggleStates, setModelToggleStates] = useState<
    Partial<Record<ModelToggleId, boolean>>
  >({});
  const modelToggleControlsRef = useRef<ModelToggleControl[]>([]);
  const modelToggleStatesRef = useRef<ModelToggleStateMap>({});
  const baselineModelToggleStatesRef = useRef<ModelToggleStateMap>({});
  const [oilBarrelTuningSaveStatus, setOilBarrelTuningSaveStatus] =
    useState<SaveStatus>("idle");
  const [oilBarrelTuningSaveMessage, setOilBarrelTuningSaveMessage] = useState("");
  const historyRef = useRef<{
    undo: ObjectEditorHistorySnapshot[];
    redo: ObjectEditorHistorySnapshot[];
  }>({ undo: [], redo: [] });
  const baselineSnapshotRef = useRef<ObjectEditorHistorySnapshot | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [historyAvailability, setHistoryAvailability] = useState({
    canUndo: false,
    canRedo: false,
  });

  const clearSelectedRegionOutline = useCallback(() => {
    for (const mesh of selectedRegionMeshesRef.current) {
      mesh.renderOutline = false;
      mesh.renderOverlay = false;
    }
    selectedRegionMeshesRef.current = [];
  }, []);

  const selectSurfaceMesh = useCallback((mesh: Mesh, faceId: number) => {
    clearSelectedRegionOutline();

    selectedSurfaceMeshRef.current = mesh;
    selectedFaceIdRef.current = faceId;
    const regionKey = materialRegionKey(mesh);
    const regionMeshes =
      currentRootRef.current
        ?.getChildMeshes(false)
        .filter(
          (candidate): candidate is Mesh =>
            candidate instanceof Mesh && materialRegionKey(candidate) === regionKey,
        ) ?? [mesh];
    selectedRegionMeshesRef.current = regionMeshes;
    mesh.outlineColor = new Color3(0.26, 0.68, 1);
    mesh.outlineWidth = 0.0025;
    mesh.renderOutline = true;
    mesh.overlayColor = new Color3(0.18, 0.52, 1);
    mesh.overlayAlpha = 0.08;
    mesh.renderOverlay = true;
    const nextSelection = surfaceSelectionFromMesh(mesh, regionMeshes, faceId);
    setGeometryControlRanges({
      width: focusedGeometryRange(nextSelection.geometryWidth),
      height: focusedGeometryRange(nextSelection.geometryHeight),
    });
    setSelectedSurface(nextSelection);
  }, [clearSelectedRegionOutline]);

  const clearSurfaceSelection = useCallback(() => {
    clearSelectedRegionOutline();
    surfaceGizmoDragRef.current = null;
    selectedSurfaceMeshRef.current = null;
    selectedFaceIdRef.current = -1;
    selectedRegionMeshesRef.current = [];
    setGeometryControlRanges(null);
    setSelectedSurface(null);
  }, [clearSelectedRegionOutline]);

  useEffect(() => {
    dimensionLabelsVisibleRef.current = dimensionLabelsVisible;
  }, [dimensionLabelsVisible]);

  const clearDimensionGuides = useCallback(() => {
    dimensionGuidesRef.current?.dispose();
    dimensionGuidesRef.current = null;
  }, []);

  const refreshObjectMeasurements = useCallback(() => {
    const root = currentRootRef.current;
    const camera = cameraRef.current;
    const scene = sceneRef.current;
    clearDimensionGuides();
    if (!root || !scene) {
      return;
    }

    if (dimensionLabelsVisibleRef.current) {
      dimensionGuidesRef.current = createModelDimensionGuides(scene, root);
      if (dimensionGuidesRef.current && camera && scene) {
        dimensionGuidesRef.current.syncLabels(camera, scene);
      }
    }
    if (camera) {
      updateCameraDepthLimits(camera, root);
    }
  }, [clearDimensionGuides]);

  const refreshViewportRuler = useCallback(() => {
    const camera = cameraRef.current;
    const canvas = canvasRef.current;
    const scene = sceneRef.current;
    setViewportRuler(
      camera && canvas && scene
        ? createViewportRulerState(camera, scene, canvas)
        : null,
    );
    setViewportAxisLegend(
      camera && canvas && scene
        ? createViewportAxisLegendState(
            camera,
            scene,
            canvas.clientWidth,
            canvas.clientHeight,
          )
        : null,
    );
  }, []);

  const refreshSelectedSurface = useCallback(() => {
    const mesh = selectedSurfaceMeshRef.current;
    if (mesh) {
      setSelectedSurface(
        surfaceSelectionFromMesh(
          mesh,
          selectedRegionMeshesRef.current,
          selectedFaceIdRef.current,
        ),
      );
    }
  }, []);

  const refreshHistoryAvailability = useCallback(() => {
    setHistoryAvailability({
      canUndo: historyRef.current.undo.length > 0,
      canRedo: historyRef.current.redo.length > 0,
    });
  }, []);

  const refreshDirtyState = useCallback(() => {
    const current = captureObjectEditorSnapshot(currentRootRef.current);
    const baseline = baselineSnapshotRef.current;
    const togglesDirty = !modelToggleStatesMatch(
      modelToggleStatesRef.current,
      baselineModelToggleStatesRef.current,
    );
    setIsDirty(
      Boolean(current && baseline && (!snapshotsMatch(current, baseline) || togglesDirty)),
    );
  }, []);

  const commitHistorySnapshot = useCallback(
    (before: ObjectEditorHistorySnapshot | null) => {
      const root = currentRootRef.current;
      const after = captureObjectEditorSnapshot(root);
      if (!before || !after || snapshotsMatch(before, after)) {
        return;
      }
      historyRef.current.undo = [...historyRef.current.undo, before].slice(-80);
      historyRef.current.redo = [];
      refreshHistoryAvailability();
      refreshDirtyState();
    },
    [refreshDirtyState, refreshHistoryAvailability],
  );

  const commitHistorySnapshotRef = useRef(commitHistorySnapshot);
  const refreshObjectMeasurementsRef = useRef(refreshObjectMeasurements);
  const refreshViewportRulerRef = useRef(refreshViewportRuler);
  const selectSurfaceMeshRef = useRef(selectSurfaceMesh);
  const clearSurfaceSelectionRef = useRef(clearSurfaceSelection);
  const clearDimensionGuidesRef = useRef(clearDimensionGuides);
  const clearSelectedRegionOutlineRef = useRef(clearSelectedRegionOutline);

  useEffect(() => {
    commitHistorySnapshotRef.current = commitHistorySnapshot;
  }, [commitHistorySnapshot]);

  useEffect(() => {
    refreshObjectMeasurementsRef.current = refreshObjectMeasurements;
  }, [refreshObjectMeasurements]);

  useEffect(() => {
    refreshViewportRulerRef.current = refreshViewportRuler;
  }, [refreshViewportRuler]);

  useEffect(() => {
    selectSurfaceMeshRef.current = selectSurfaceMesh;
  }, [selectSurfaceMesh]);

  useEffect(() => {
    clearSurfaceSelectionRef.current = clearSurfaceSelection;
  }, [clearSurfaceSelection]);

  useEffect(() => {
    clearDimensionGuidesRef.current = clearDimensionGuides;
  }, [clearDimensionGuides]);

  useEffect(() => {
    clearSelectedRegionOutlineRef.current = clearSelectedRegionOutline;
  }, [clearSelectedRegionOutline]);

  const resolveEditorDisplayAsset = useCallback(
    (target: EditorSelection): DisplayAsset | undefined => {
      if (target.type === "local") {
        return {
          id: "local-file",
          name: target.file.name,
          category: "Local",
          type: "glb",
          path: target.file.name,
          notes: "Loaded from your machine.",
        };
      }
      return allAssets.find((entry) => entry.id === target.assetId);
    },
    [allAssets],
  );

  const unloadEditorModelFromScene = useCallback(() => {
    const scene = sceneRef.current;
    clearDimensionGuides();
    if (scene && !scene.isDisposed) {
      disposeEditorModelRoots(scene);
    }
    currentRootRef.current = null;
    gizmoManagerRef.current?.attachToNode(null);
    gizmoManagerRef.current?.attachToMesh(null);
    refreshObjectMeasurementsRef.current();
    refreshViewportRulerRef.current();
  }, [clearDimensionGuides]);

  const resetEditorForNewModel = useCallback(() => {
    editorLoadSequenceRef.current += 1;
    clearSurfaceSelection();
    setStatus("idle");
    setViewModes({ wireframe: false, lighting: true, texture: true });
    setGizmoMode("move");
    setGizmoEnabled(true);
    setScaleLinked(true);
    setOilBarrelEditorActive(false);
    setOilBarrelFireEnabled(loadOilBarrelEditorInteriorFire());
    setOilBarrelFireTuning(getDefaultOilBarrelEditorFireTuning());
    setModelToggleControls([]);
    setModelToggleStates({});
    modelToggleControlsRef.current = [];
    modelToggleStatesRef.current = {};
    baselineModelToggleStatesRef.current = {};
    setOilBarrelTuningSaveStatus("idle");
    setOilBarrelTuningSaveMessage("");
    historyRef.current = { undo: [], redo: [] };
    baselineSnapshotRef.current = null;
    setIsDirty(false);
    refreshHistoryAvailability();
    unloadEditorModelFromScene();
  }, [
    clearSurfaceSelection,
    refreshHistoryAvailability,
    unloadEditorModelFromScene,
  ]);

  const queueEditorAssetSelection = useCallback(
    (nextSelection: EditorSelection) => {
      const nextAsset = resolveEditorDisplayAsset(nextSelection);
      if (!nextAsset) {
        return false;
      }
      if (
        isDirty &&
        !editorSelectionsMatch(selection, nextSelection) &&
        !window.confirm(
          "You have unsaved changes on this GLB. Load another model and discard those changes?",
        )
      ) {
        return false;
      }
      resetEditorForNewModel();
      setSelection(nextSelection);
      return true;
    },
    [isDirty, resetEditorForNewModel, resolveEditorDisplayAsset, selection],
  );

  const undoEditorHistory = useCallback(() => {
    const previous = historyRef.current.undo.pop();
    const current = captureObjectEditorSnapshot(currentRootRef.current);
    if (!previous || !current) {
      return;
    }
    historyRef.current.redo.push(current);
    applyObjectEditorSnapshot(currentRootRef.current, previous);
    refreshSelectedSurface();
    refreshObjectMeasurements();
    refreshHistoryAvailability();
    refreshDirtyState();
  }, [
    refreshDirtyState,
    refreshHistoryAvailability,
    refreshObjectMeasurements,
    refreshSelectedSurface,
  ]);

  const redoEditorHistory = useCallback(() => {
    const next = historyRef.current.redo.pop();
    const current = captureObjectEditorSnapshot(currentRootRef.current);
    if (!next || !current) {
      return;
    }
    historyRef.current.undo.push(current);
    applyObjectEditorSnapshot(currentRootRef.current, next);
    refreshSelectedSurface();
    refreshObjectMeasurements();
    refreshHistoryAvailability();
    refreshDirtyState();
  }, [
    refreshDirtyState,
    refreshHistoryAvailability,
    refreshObjectMeasurements,
    refreshSelectedSurface,
  ]);

  useEffect(() => {
    void fetchModelLibrary()
      .then(({ assets, folders }) => {
        setUserAssets(assets);
        setModelFolders(folders);
        setExpandedFolderIds((current) => {
          const next = new Set(current);
          const populatedTree = buildModelTree([
            ...OBJECT_EDITOR_ASSETS,
            ...assets,
          ]);
          for (const id of collectFolderIds(populatedTree)) {
            next.add(id);
          }
          return next;
        });
      })
      .catch(() => {
        /* dev library optional */
      });
  }, []);

  useEffect(() => {
    viewModesRef.current = viewModes;
  }, [viewModes]);

  useEffect(() => {
    viewportModeRef.current = viewportMode;
  }, [viewportMode]);

  useEffect(() => {
    shiftPanActiveRef.current = shiftPanActive;
  }, [shiftPanActive]);

  useEffect(() => {
    const setShiftPan = (active: boolean) => {
      if (shiftPanActiveRef.current === active) {
        return;
      }
      shiftPanActiveRef.current = active;
      setShiftPanActive(active);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPan(true);
      }
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === "Shift") {
        setShiftPan(false);
      }
    };
    const onBlur = () => setShiftPan(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const engine = new Engine(canvas, true, {
      preserveDrawingBuffer: true,
      stencil: true,
      adaptToDeviceRatio: true,
    });
    const scene = new Scene(engine);
    scene.clearColor = new Color4(0.03, 0.04, 0.05, 1);
    sceneRef.current = scene;

    const camera = new ArcRotateCamera(
      "objectEditorCamera",
      OBJECT_EDITOR_FRAME_ALPHA,
      OBJECT_EDITOR_FRAME_BETA,
      4,
      Vector3.Zero(),
      scene,
    );
    camera.lowerAlphaLimit = null;
    camera.upperAlphaLimit = null;
    camera.lowerBetaLimit = null;
    camera.upperBetaLimit = null;
    camera.allowUpsideDown = true;
    camera.minZ = 0.00001;
    camera.maxZ = 1000;
    camera.wheelDeltaPercentage = 0.015;
    camera.panningSensibility = OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY;
    applyViewportMode(camera, shiftPanActiveRef.current ? "pan" : viewportModeRef.current);
    setSceneReadyGeneration((generation) => generation + 1);
    cameraRef.current = camera;
    scene.activeCamera = camera;

    const gizmoManager = new GizmoManager(scene, 0.72);
    gizmoManager.usePointerToAttachGizmos = false;
    gizmoManager.clearGizmoOnEmptyPointerEvent = false;
    gizmoManager.scaleRatio = 1.05;
    gizmoManagerRef.current = gizmoManager;

    const tuning = DEFAULT_OUTDOOR_LIGHTING;

    const hemi = new HemisphericLight(
      "objectEditorHemi",
      new Vector3(0.25, 1, 0.35),
      scene,
    );
    hemi.diffuse = colorFromKelvin(tuning.hemiDay.temperature);
    hemi.groundColor = new Color3(0.08, 0.11, 0.14);
    hemi.intensity = tuning.hemiDay.intensity;

    const sun = new DirectionalLight(
      "objectEditorSun",
      new Vector3(-0.36, -0.55, -0.75),
      scene,
    );
    sun.diffuse = colorFromKelvin(tuning.sunTemperature);
    sun.specular = sun.diffuse;
    sun.intensity = tuning.sunIntensity;

    const fill = new DirectionalLight(
      "objectEditorFill",
      new Vector3(0.7, -0.24, 0.4),
      scene,
    );
    fill.diffuse = new Color3(0.42, 0.52, 0.72);
    fill.specular = fill.diffuse;
    fill.intensity = 0.32;

    const gridLines: Vector3[][] = [];
    const gridSize = 6;
    const gridStep = 0.5;
    for (let v = -gridSize; v <= gridSize; v += gridStep) {
      gridLines.push([
        new Vector3(-gridSize, 0, v),
        new Vector3(gridSize, 0, v),
      ]);
      gridLines.push([
        new Vector3(v, 0, -gridSize),
        new Vector3(v, 0, gridSize),
      ]);
    }
    const grid = MeshBuilder.CreateLineSystem(
      "objectEditorGroundGrid",
      { lines: gridLines },
      scene,
    );
    grid.color = new Color3(0.18, 0.42, 0.68);
    grid.alpha = 0.42;
    grid.isPickable = false;
    grid.isVisible = true;
    gridRef.current = grid;

    let lastSurfaceSyncMs = 0;
    let lastMeasurementSyncMs = 0;
    let lastMeasurementRecoveryMs = 0;
    let lastViewportRulerSyncMs = 0;
    let lastViewportRulerKey = "";
    let wasGizmoDragging = false;
    let gizmoDragSnapshot: ObjectEditorHistorySnapshot | null = null;
    const onPointerDown = (event: PointerEvent) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
        return;
      }
      const pick = pickEditableSurface(
        scene,
        currentRootRef.current,
        event.offsetX,
        event.offsetY,
      );
      if (pick?.hit && pick.pickedMesh instanceof Mesh) {
        if (
          selectedSurfaceMeshRef.current === pick.pickedMesh &&
          selectedFaceIdRef.current === pick.faceId
        ) {
          clearSurfaceSelectionRef.current();
          return;
        }
        selectSurfaceMeshRef.current(pick.pickedMesh, pick.faceId);
        return;
      }
      clearSurfaceSelectionRef.current();
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    engine.runRenderLoop(() => {
      const now = performance.now();
      if (now - lastViewportRulerSyncMs > OBJECT_EDITOR_VIEWPORT_RULER_SYNC_MS) {
        lastViewportRulerSyncMs = now;
        const rulerKey = [
          Math.round(camera.radius * 10000),
          Math.round(camera.fov * 10000),
          Math.round(camera.target.x * 10000),
          Math.round(camera.target.y * 10000),
          Math.round(camera.target.z * 10000),
          canvas.clientWidth,
          canvas.clientHeight,
        ].join(":");
        if (rulerKey !== lastViewportRulerKey) {
          lastViewportRulerKey = rulerKey;
          refreshViewportRulerRef.current();
        }
      }

      const isGizmoDragging = gizmoManager.isDragging;
      if (isGizmoDragging && !wasGizmoDragging) {
        gizmoDragSnapshot = captureObjectEditorSnapshot(currentRootRef.current);
        const surfaceMesh = selectedSurfaceMeshRef.current;
        const proxy = surfaceGizmoProxyRef.current;
        if (surfaceMesh && proxy) {
          surfaceGizmoDragRef.current = {
            mesh: surfaceMesh,
            faceId: selectedFaceIdRef.current,
            proxyWorldMatrix: proxy.computeWorldMatrix(true).clone(),
            meshWorldMatrix: surfaceMesh.computeWorldMatrix(true).clone(),
          };
        }
      }
      if (isGizmoDragging && currentRootRef.current) {
        const surfaceDrag = surfaceGizmoDragRef.current;
        if (surfaceDrag && surfaceGizmoProxyRef.current) {
          applySurfaceGizmoProxyDelta(surfaceGizmoProxyRef.current, surfaceDrag);
          clampObjectEditorScale(surfaceDrag.mesh);
        } else {
          clampObjectEditorScale(currentRootRef.current);
        }
        if (now - lastMeasurementSyncMs > 90) {
          lastMeasurementSyncMs = now;
          refreshObjectMeasurementsRef.current();
          refreshViewportRulerRef.current();
        }
      }
      if (!isGizmoDragging && wasGizmoDragging) {
        const surfaceDrag = surfaceGizmoDragRef.current;
        if (surfaceDrag && surfaceGizmoProxyRef.current) {
          applySurfaceGizmoProxyDelta(surfaceGizmoProxyRef.current, surfaceDrag);
          clampObjectEditorScale(surfaceDrag.mesh);
          syncSurfaceGizmoProxy(
            surfaceGizmoProxyRef.current,
            surfaceDrag.mesh,
            surfaceDrag.faceId,
            shiftPanActiveRef.current,
          );
          setSelectedSurface(
            surfaceSelectionFromMesh(
              surfaceDrag.mesh,
              selectedRegionMeshesRef.current,
              surfaceDrag.faceId,
            ),
          );
        } else if (currentRootRef.current) {
          clampObjectEditorScale(currentRootRef.current);
        }
        surfaceGizmoDragRef.current = null;
        commitHistorySnapshotRef.current(gizmoDragSnapshot);
        refreshObjectMeasurementsRef.current();
        gizmoDragSnapshot = null;
      }
      wasGizmoDragging = isGizmoDragging;

      if (gizmoManager.isDragging && selectedSurfaceMeshRef.current) {
        if (now - lastSurfaceSyncMs > 90) {
          lastSurfaceSyncMs = now;
          setSelectedSurface(
            surfaceSelectionFromMesh(
              selectedSurfaceMeshRef.current,
              selectedRegionMeshesRef.current,
              selectedFaceIdRef.current,
            ),
          );
        }
      }
      tickModelOverlays(
        currentRootRef.current,
        camera,
        performance.now() / 1000,
      );
      if (
        dimensionLabelsVisibleRef.current &&
        currentRootRef.current &&
        !dimensionGuidesRef.current &&
        now - lastMeasurementRecoveryMs > 250
      ) {
        lastMeasurementRecoveryMs = now;
        refreshObjectMeasurementsRef.current();
      }
      if (dimensionGuidesRef.current) {
        dimensionGuidesRef.current.syncLabels(camera, scene);
      }
      scene.render();
    });

    const resize = () => {
      engine.resize();
      refreshViewportRulerRef.current();
    };
    window.addEventListener("resize", resize);
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
      refreshViewportRulerRef.current();
    });
    resizeObserver.observe(canvas);
    resize();

    return () => {
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("resize", resize);
      resizeObserver.disconnect();
      editorLoadSequenceRef.current += 1;
      camera.detachControl();
      engine.stopRenderLoop();
      clearDimensionGuidesRef.current();
      disposeEditorModelRoots(scene);
      clearSelectedRegionOutlineRef.current();
      gizmoManager.dispose();
      scene.dispose();
      engine.dispose();
      resetOilBarrelInteriorVideoCache();
      sceneRef.current = null;
      cameraRef.current = null;
      currentRootRef.current = null;
      surfaceGizmoProxyRef.current = null;
      surfaceGizmoDragRef.current = null;
      gizmoManagerRef.current = null;
      gridRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera) {
      return undefined;
    }

    if (!displayAsset || !selection) {
      editorLoadSequenceRef.current += 1;
      unloadEditorModelFromScene();
      return undefined;
    }

    editorLoadSequenceRef.current += 1;
    const loadId = editorLoadSequenceRef.current;
    let cancelled = false;
    const isLoadCurrent = () =>
      !cancelled &&
      !scene.isDisposed &&
      loadId === editorLoadSequenceRef.current;

    clearDimensionGuides();
    disposeEditorModelRoots(scene);
    setModelToggleControls([]);
    setModelToggleStates({});
    modelToggleControlsRef.current = [];
    modelToggleStatesRef.current = {};
    baselineModelToggleStatesRef.current = {};
    currentRootRef.current = null;
    gizmoManagerRef.current?.attachToNode(null);

    const abandonLoad = (root: TransformNode) => {
      root.dispose(false, true);
    };

    const loadAsset = async () => {
      let root: TransformNode | null = null;
      try {
        await Promise.resolve();
        if (!isLoadCurrent()) {
          return;
        }
        setStatus("loading");
        setGeometryControlRanges(null);
        setSelectedSurface(null);
        refreshHistoryAvailability();
        const rootName = `objectEditor_${displayAsset.id}`;
        const loaded =
          selection.type === "local"
            ? await loadGltfModelFromFile(scene, selection.file, rootName)
            : await loadGltfModel(scene, displayAsset.path, rootName, loadId);
        root = loaded.root;
        if (!isLoadCurrent()) {
          abandonLoad(root);
          return;
        }

        configureMeshes(root);
        const isOilBarrel = isOilBarrelModelPath(displayAsset.path);
        setOilBarrelEditorActive(isOilBarrel);

        if (isOilBarrel) {
          const fireEnabled = loadOilBarrelEditorInteriorFire();
          setOilBarrelFireEnabled(fireEnabled);
          try {
            await applyOilBarrelInteriorFireSetting(
              scene,
              root,
              displayAsset.path,
              fireEnabled,
            );
            if (!isLoadCurrent()) {
              abandonLoad(root);
              return;
            }
            const editorTuning = mergeOilBarrelEditorFireTuning(
              getOilBarrelFireTuning(root) ?? getDefaultOilBarrelEditorFireTuning(),
              loadOilBarrelEditorFireTuningPatch(),
            );
            applyOilBarrelFireTuning(root, editorTuning);
            setOilBarrelFireTuning(editorTuning);
            resumeOilBarrelInteriorVideoPlayback();
          } catch {
            // GLB still loads if fire videos fail — user can retry via the toggle.
          }
        } else {
          const overlayModelPath =
            selection.type === "catalog" ? displayAsset.path : null;
          if (overlayModelPath) {
            await attachModelOverlays(scene, root, overlayModelPath);
          }
        }

        if (!isLoadCurrent()) {
          abandonLoad(root);
          return;
        }

        const committedRoot = root;
        currentRootRef.current = committedRoot;
        clearObjectEditorMaterialSnapshots(committedRoot);
        applyObjectEditorViewModes(committedRoot, viewModesRef.current);
        const toggleControls = detectModelToggleControls(
          committedRoot,
          loaded.animationGroups,
        );
        const savedToggleStates = displayAsset.animationToggles ?? {};
        const nextToggleStates = Object.fromEntries(
          toggleControls.map((control) => [
            control.id,
            Boolean(savedToggleStates[control.id]),
          ]),
        );
        for (const control of toggleControls) {
          snapModelToggleOpen(
            committedRoot,
            control.id,
            Boolean(savedToggleStates[control.id]),
          );
        }
        modelToggleControlsRef.current = toggleControls;
        modelToggleStatesRef.current = nextToggleStates;
        baselineModelToggleStatesRef.current = nextToggleStates;
        setModelToggleControls(toggleControls);
        setModelToggleStates(nextToggleStates);
        frameObjectInCamera(camera, committedRoot, canvasRef.current);
        refreshObjectMeasurementsRef.current();
        requestAnimationFrame(() => {
          if (currentRootRef.current === committedRoot) {
            refreshObjectMeasurementsRef.current();
          }
        });
        refreshViewportRulerRef.current();
        baselineSnapshotRef.current = captureObjectEditorSnapshot(committedRoot);
        refreshHistoryAvailability();
        refreshDirtyState();
        setStatus("ready");
      } catch {
        if (root) {
          abandonLoad(root);
        }
        if (isLoadCurrent()) {
          setStatus("error");
        }
      }
    };

    void loadAsset();

    return () => {
      cancelled = true;
      editorLoadSequenceRef.current += 1;
    };
  }, [
    selection,
    displayAsset,
    clearDimensionGuides,
    refreshDirtyState,
    refreshHistoryAvailability,
    unloadEditorModelFromScene,
  ]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    applyViewportMode(camera, effectiveViewportMode);
    refreshViewportRulerRef.current();
  }, [effectiveViewportMode, sceneReadyGeneration]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.isVisible = gridVisible;
    }
  }, [gridVisible]);

  useEffect(() => {
    refreshObjectMeasurements();
  }, [refreshObjectMeasurements, sceneReadyGeneration, dimensionLabelsVisible]);

  const selectedSurfaceGizmoKey = selectedSurface
    ? `${selectedSurface.meshId}:${selectedSurface.faceId}`
    : "none";

  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current;
    if (!gizmoManager) {
      return;
    }

    const shouldShow = gizmoEnabled && status === "ready";
    gizmoManager.positionGizmoEnabled = shouldShow && gizmoMode === "move";
    gizmoManager.rotationGizmoEnabled = shouldShow && gizmoMode === "rotate";
    gizmoManager.scaleGizmoEnabled = shouldShow && gizmoMode === "scale";
    const scaleGizmo = gizmoManager.gizmos.scaleGizmo;
    if (scaleGizmo) {
      scaleGizmo.sensitivity = OBJECT_EDITOR_SCALE_GIZMO_SENSITIVITY;
      scaleGizmo.snapDistance = 0;
      scaleGizmo.incrementalSnap = false;
      scaleGizmo.xGizmo.uniformScaling = scaleLinked;
      scaleGizmo.yGizmo.uniformScaling = scaleLinked;
      scaleGizmo.zGizmo.uniformScaling = scaleLinked;
    }
    gizmoManager.attachToNode(null);
    gizmoManager.attachToMesh(null);
    if (shouldShow) {
      const selectedMesh = selectedSurfaceMeshRef.current;
      if (selectedMesh) {
        const scene = sceneRef.current;
        if (!scene) {
          return;
        }
        const proxy =
          surfaceGizmoProxyRef.current ??
          new TransformNode("objectEditorSurfaceGizmoProxy", scene);
        surfaceGizmoProxyRef.current = proxy;
        syncSurfaceGizmoProxy(
          proxy,
          selectedMesh,
          selectedFaceIdRef.current,
          surfaceGizmoLocalAlignment,
        );
        gizmoManager.attachToNode(proxy);
      } else {
        gizmoManager.attachToNode(currentRootRef.current);
      }
    }
  }, [
    gizmoEnabled,
    gizmoMode,
    scaleLinked,
    status,
    sceneReadyGeneration,
    selectedSurfaceGizmoKey,
    surfaceGizmoLocalAlignment,
  ]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const modifierPressed = event.metaKey || event.ctrlKey;
      if (!modifierPressed || event.altKey) {
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "z" && event.shiftKey) {
        event.preventDefault();
        redoEditorHistory();
      } else if (key === "z") {
        event.preventDefault();
        undoEditorHistory();
      } else if (key === "y") {
        event.preventDefault();
        redoEditorHistory();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [redoEditorHistory, undoEditorHistory]);

  useEffect(() => {
    const root = currentRootRef.current;
    if (!root) {
      return;
    }
    applyObjectEditorViewModes(root, viewModes);
  }, [viewModes]);

  const setViewMode = (
    key: keyof ObjectEditorViewModes,
    checked: boolean,
  ) => {
    setViewModes((current) => ({ ...current, [key]: checked }));
  };

  const toggleGizmoMode = (mode: GizmoMode) => {
    setGizmoMode(mode);
    setGizmoEnabled((current) => !(current && gizmoMode === mode));
  };

  const updateSelectedSurface = (patch: Partial<SurfaceSelection>) => {
    const mesh = selectedSurfaceMeshRef.current;
    const faceId = selectedFaceIdRef.current;
    if (!mesh || !mesh.material || !selectedSurface) {
      return;
    }
    const before = captureObjectEditorSnapshot(currentRootRef.current);
    const material = mesh.material;
    const next = {
      ...selectedSurface,
      ...patch,
    };

    if (patch.drawOrder !== undefined) {
      mesh.alphaIndex = next.drawOrder;
    }

    if (patch.faceUvRotationDeg !== undefined) {
      if (faceId >= 0 && meshHasFaceUvs(mesh)) {
        setFaceUvRotationDeg(mesh, faceId, next.faceUvRotationDeg);
      }
    }

    if (
      patch.uvScaleU !== undefined ||
      patch.uvScaleV !== undefined ||
      patch.uvOffsetU !== undefined ||
      patch.uvOffsetV !== undefined
    ) {
      applyMaterialUvTransform(material, {
        uvScaleU: next.uvScaleU,
        uvScaleV: next.uvScaleV,
        uvOffsetU: next.uvOffsetU,
        uvOffsetV: next.uvOffsetV,
      });
    }

    material.alpha = next.alpha;
    material.backFaceCulling = !next.twoSided;
    material.disableDepthWrite = !next.depthWrite;
    material.forceDepthWrite =
      patch.depthWrite !== undefined ? false : next.forceDepthWrite;
    material.depthFunction = next.depthTest ? Engine.LEQUAL : Engine.ALWAYS;
    material.zOffset = next.renderBias;
    if (material instanceof PBRMaterial) {
      material.albedoColor = hexToColor(next.albedoColor);
      material.emissiveColor = hexToColor(next.emissiveColor);
      material.metallic = next.metallic;
      material.roughness = next.roughness;
      material.unlit = next.unlit;
    } else if (material instanceof StandardMaterial) {
      material.diffuseColor = hexToColor(next.albedoColor);
      material.emissiveColor = hexToColor(next.emissiveColor);
      material.disableLighting = next.unlit;
    }

    setSelectedSurface({
      ...next,
      ...surfaceSelectionFromMesh(
        mesh,
        selectedRegionMeshesRef.current,
        faceId,
      ),
      ...patch,
    });
    commitHistorySnapshot(before);
  };

  const updateSelectedSurfaceGeometry = (
    patch: Partial<Pick<SurfaceSelection, "geometryWidth" | "geometryHeight">>,
    commit = false,
  ) => {
    const mesh = selectedSurfaceMeshRef.current;
    const faceId = selectedFaceIdRef.current;
    if (!mesh || !selectedSurface || status !== "ready") {
      return;
    }

    if (!geometryLiveEditSnapshotRef.current) {
      geometryLiveEditSnapshotRef.current = captureObjectEditorSnapshot(
        currentRootRef.current,
      );
    }
    const nextWidth = patch.geometryWidth ?? selectedSurface.geometryWidth;
    const nextHeight = patch.geometryHeight ?? selectedSurface.geometryHeight;
    const resized = resizeMeshGeometryOnAxes(
      mesh,
      surfaceGeometryAxes(mesh, faceId),
      nextWidth,
      nextHeight,
    );
    if (!resized) {
      return;
    }

    setSelectedSurface(
      surfaceSelectionFromMesh(
        mesh,
        selectedRegionMeshesRef.current,
        faceId,
      ),
    );
    if (!gizmoManagerRef.current?.isDragging && surfaceGizmoProxyRef.current) {
      syncSurfaceGizmoProxy(
        surfaceGizmoProxyRef.current,
        mesh,
        faceId,
        surfaceGizmoLocalAlignment,
      );
    }
    if (commit) {
      refreshObjectMeasurementsRef.current();
      refreshViewportRulerRef.current();
      commitHistorySnapshot(geometryLiveEditSnapshotRef.current);
      geometryLiveEditSnapshotRef.current = null;
    }
  };

  const updateModelToggleState = (toggleId: ModelToggleId, open: boolean) => {
    const root = currentRootRef.current;
    if (!root || status !== "ready") {
      return;
    }
    if (!setModelToggleOpen(root, toggleId, open)) {
      return;
    }
    const next: ModelToggleStateMap = {
      ...modelToggleStatesRef.current,
      [toggleId]: open,
    };
    modelToggleStatesRef.current = next;
    setModelToggleStates(next);
    refreshDirtyState();
  };

  const currentModelToggleSaveState = () => {
    const entries = modelToggleControlsRef.current.map((control) => [
      control.id,
      Boolean(modelToggleStatesRef.current[control.id]),
    ]);
    return entries.length > 0 ? Object.fromEntries(entries) : undefined;
  };

  const selectCatalogAsset = (assetId: string) => {
    const accepted = queueEditorAssetSelection({ type: "catalog", assetId });
    if (!accepted) {
      return;
    }
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      for (const id of collectFolderIdsForAsset(modelTree, assetId)) {
        next.add(id);
      }
      return next;
    });
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const handleLocalFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) {
      return;
    }
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".glb")) {
      return;
    }
    const modelName = defaultModelNameFromFileName(file.name);
    const accepted = queueEditorAssetSelection({
      type: "local",
      file,
      loadKey: selection?.type === "local" ? selection.loadKey + 1 : 0,
    });
    if (!accepted) {
      return;
    }
    setSaveFolder(defaultFolderFromFileName(file.name));
    setSaveModelName(modelName);
    setSaveDisplayName(titleCaseSegment(modelName));
    setSaveStatus("idle");
    setSaveMessage("");
    setExpandedFolderIds((current) => new Set(current).add("local"));
  };

  const handleSaveToServer = async () => {
    if (!selection || selection.type !== "local" || saveStatus === "saving") {
      return;
    }
    setSaveStatus("saving");
    setSaveMessage("");
    try {
      const result = await saveModelToServer({
        file: selection.file,
        folder: saveFolder,
        modelName: saveModelName,
        displayName: saveDisplayName,
        category: titleCaseSegment(saveFolder),
        animationToggles: currentModelToggleSaveState(),
      });
      setUserAssets((current) => {
        const next = current.filter((asset) => asset.id !== result.asset.id);
        next.push(result.asset);
        return next.sort((a, b) => a.path.localeCompare(b.path));
      });
      setModelFolders((current) => {
        const parsed = parseModelSegments(saveFolder, saveModelName);
        const folder = parsed?.folder ?? saveFolder;
        return [...new Set([...current, folder])].sort((a, b) =>
          a.localeCompare(b),
        );
      });
      setSelection({ type: "catalog", assetId: result.asset.id });
      setExpandedFolderIds((current) => {
        const next = new Set(current);
        for (const id of folderIdsForAssetPath(result.asset.path)) {
          next.add(id);
        }
        return next;
      });
      setSaveStatus("success");
      setSaveMessage(
        result.overwritten
          ? `Updated ${result.asset.path}`
          : `Saved to ${result.asset.path}`,
      );
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save model.",
      );
    }
  };

  const handleSaveEdits = async () => {
    const root = currentRootRef.current;
    if (!root || !selection || saveStatus === "saving" || status !== "ready") {
      return;
    }

    setSaveStatus("saving");
    setSaveMessage("");

    try {
      let folder: string;
      let modelName: string;
      let displayName: string;
      let category: string;

      if (selection.type === "catalog" && displayAsset) {
        const parsed = parseModelPublicPath(displayAsset.path);
        if (!parsed) {
          throw new Error("Could not determine save path for this model.");
        }
        folder = parsed.folder;
        modelName = parsed.modelName;
        displayName = displayAsset.name;
        category = displayAsset.category;
      } else if (selection.type === "local") {
        folder = saveFolder;
        modelName = saveModelName;
        displayName = saveDisplayName;
        category = titleCaseSegment(saveFolder);
      } else {
        throw new Error("Nothing selected to save.");
      }

      const file = await exportTransformNodeToGlb(root, modelName);
      const result = await saveModelToServer({
        file,
        folder,
        modelName,
        displayName,
        category,
        animationToggles: currentModelToggleSaveState(),
      });

      setUserAssets((current) => {
        const next = current.filter((asset) => asset.id !== result.asset.id);
        next.push(result.asset);
        return next.sort((a, b) => a.path.localeCompare(b.path));
      });
      setModelFolders((current) => {
        const parsed = parseModelSegments(folder, modelName);
        const nextFolder = parsed?.folder ?? folder;
        return [...new Set([...current, nextFolder])].sort((a, b) =>
          a.localeCompare(b),
        );
      });

      baselineSnapshotRef.current = captureObjectEditorSnapshot(root);
      baselineModelToggleStatesRef.current = { ...modelToggleStatesRef.current };
      refreshDirtyState();

      if (selection.type === "local") {
        setSelection({ type: "catalog", assetId: result.asset.id });
        setExpandedFolderIds((current) => {
          const next = new Set(current);
          for (const id of folderIdsForAssetPath(result.asset.path)) {
            next.add(id);
          }
          return next;
        });
      }

      setSaveStatus("success");
      setSaveMessage(
        result.overwritten
          ? `Updated ${result.asset.path}`
          : `Saved to ${result.asset.path}`,
      );
    } catch (error) {
      setSaveStatus("error");
      setSaveMessage(
        error instanceof Error ? error.message : "Could not save edited model.",
      );
    }
  };

  const handleResetEdits = useCallback(() => {
    const root = currentRootRef.current;
    const baseline = baselineSnapshotRef.current;
    if (!root || !baseline || status !== "ready" || saveStatus === "saving") {
      return;
    }

    applyObjectEditorSnapshot(root, baseline);
    applyObjectEditorViewModes(root, viewModesRef.current);
    for (const control of modelToggleControlsRef.current) {
      snapModelToggleOpen(
        root,
        control.id,
        Boolean(baselineModelToggleStatesRef.current[control.id]),
      );
    }
    modelToggleStatesRef.current = { ...baselineModelToggleStatesRef.current };
    setModelToggleStates(modelToggleStatesRef.current);
    historyRef.current = { undo: [], redo: [] };
    refreshSelectedSurface();
    refreshObjectMeasurements();
    refreshHistoryAvailability();
    refreshDirtyState();
    setSaveStatus("idle");
    setSaveMessage("");
  }, [
    refreshDirtyState,
    refreshHistoryAvailability,
    refreshObjectMeasurements,
    refreshSelectedSurface,
    saveStatus,
    status,
  ]);

  const selectedUserAsset =
    selection?.type === "catalog"
      ? userAssets.find((asset) => asset.id === selection.assetId)
      : undefined;
  const deleteConfirmMatches =
    selectedUserAsset !== undefined && deleteConfirmName === selectedUserAsset.name;

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setDeleteConfirmName("");
    setDeleteStatus("idle");
    setDeleteMessage("");
  }, []);

  const openDeleteDialog = () => {
    if (!selectedUserAsset || saveStatus === "saving" || deleteStatus === "saving") {
      return;
    }
    setDeleteConfirmName("");
    setDeleteStatus("idle");
    setDeleteMessage("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteSelectedModel = async () => {
    if (!selectedUserAsset || !deleteConfirmMatches || deleteStatus === "saving") {
      return;
    }
    setDeleteStatus("saving");
    setDeleteMessage("");
    try {
      const result = await deleteModelFromServer(
        selectedUserAsset.id,
        deleteConfirmName,
      );
      resetEditorForNewModel();
      setSelection(null);
      setUserAssets((current) =>
        current.filter((asset) => asset.id !== result.asset.id),
      );
      closeDeleteDialog();
      setDeleteStatus("success");
      setDeleteMessage(`Deleted ${result.asset.path}`);
    } catch (error) {
      setDeleteStatus("error");
      setDeleteMessage(
        error instanceof Error ? error.message : "Could not delete model.",
      );
    }
  };

  const patchOilBarrelFireTuning = useCallback(
    (patch: Partial<OilBarrelFireTuning>) => {
      const root = currentRootRef.current;
      if (!root) {
        return;
      }
      setOilBarrelFireTuning((current) => {
        const next = normalizeOilBarrelEditorFireTuning({
          ...current,
          ...patch,
          interiorFire: oilBarrelFireEnabled,
        });
        saveOilBarrelEditorFireTuningPatch(next);
        applyOilBarrelFireTuning(root, next);
        refreshObjectMeasurementsRef.current();
        return next;
      });
    },
    [oilBarrelFireEnabled],
  );

  const handleSaveOilBarrelFireTuning = useCallback(async () => {
    if (!displayAsset || oilBarrelTuningSaveStatus === "saving") {
      return;
    }
    setOilBarrelTuningSaveStatus("saving");
    setOilBarrelTuningSaveMessage("");
    try {
      const tuning = normalizeOilBarrelEditorFireTuning({
        ...oilBarrelFireTuning,
        interiorFire: oilBarrelFireEnabled,
      });
      const result = await saveOilBarrelFireTuningToOverlay(
        displayAsset.path,
        tuning,
      );
      saveOilBarrelEditorFireTuningPatch({});
      setOilBarrelFireTuning(tuning);
      setOilBarrelTuningSaveStatus("success");
      setOilBarrelTuningSaveMessage(
        `Saved to ${result.overlayPath} at ${new Date(result.savedAt).toLocaleTimeString()}.`,
      );
    } catch (error) {
      setOilBarrelTuningSaveStatus("error");
      setOilBarrelTuningSaveMessage(
        error instanceof Error ? error.message : "Failed to save fire tuning.",
      );
    }
  }, [
    displayAsset,
    oilBarrelFireEnabled,
    oilBarrelFireTuning,
    oilBarrelTuningSaveStatus,
  ]);

  const savePreviewPath = previewSavedAssetPath(saveFolder, saveModelName);
  const editedSavePreviewPath =
    selection?.type === "local"
      ? savePreviewPath
      : displayAsset
        ? displayAsset.path
        : "/models/…";

  const getMaxSidebarWidth = useCallback(() => {
    const shellWidth = shellRef.current?.clientWidth ?? window.innerWidth;
    const reserved =
      toolsWidth +
      OBJECT_EDITOR_RESIZE_HANDLE_WIDTH * 2 +
      OBJECT_EDITOR_VIEWER_MIN;
    return clampPanelWidth(
      shellWidth - reserved,
      OBJECT_EDITOR_SIDEBAR_MIN,
      OBJECT_EDITOR_SIDEBAR_MAX,
    );
  }, [toolsWidth]);

  const getMaxToolsWidth = useCallback(() => {
    const shellWidth = shellRef.current?.clientWidth ?? window.innerWidth;
    const reserved =
      sidebarWidth +
      OBJECT_EDITOR_RESIZE_HANDLE_WIDTH * 2 +
      OBJECT_EDITOR_VIEWER_MIN;
    return clampPanelWidth(
      shellWidth - reserved,
      OBJECT_EDITOR_TOOLS_MIN,
      OBJECT_EDITOR_TOOLS_MAX,
    );
  }, [sidebarWidth]);

  const beginPanelResize = useCallback(
    (edge: PanelResizeEdge) => (event: ReactPointerEvent<HTMLDivElement>) => {
      event.preventDefault();
      panelResizeRef.current = {
        edge,
        startX: event.clientX,
        startSidebar: sidebarWidth,
        startTools: toolsWidth,
      };
      setActiveResizeEdge(edge);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [sidebarWidth, toolsWidth],
  );

  const movePanelResize = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const drag = panelResizeRef.current;
      if (!drag) {
        return;
      }

      const deltaX = event.clientX - drag.startX;
      if (drag.edge === "sidebar") {
        setSidebarWidth(
          clampPanelWidth(
            drag.startSidebar + deltaX,
            OBJECT_EDITOR_SIDEBAR_MIN,
            getMaxSidebarWidth(),
          ),
        );
        return;
      }

      setToolsWidth(
        clampPanelWidth(
          drag.startTools - deltaX,
          OBJECT_EDITOR_TOOLS_MIN,
          getMaxToolsWidth(),
        ),
      );
    },
    [getMaxSidebarWidth, getMaxToolsWidth],
  );

  const endPanelResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    panelResizeRef.current = null;
    setActiveResizeEdge(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  useEffect(() => {
    const clampPanelSizes = () => {
      setSidebarWidth((current) =>
        clampPanelWidth(current, OBJECT_EDITOR_SIDEBAR_MIN, getMaxSidebarWidth()),
      );
      setToolsWidth((current) =>
        clampPanelWidth(current, OBJECT_EDITOR_TOOLS_MIN, getMaxToolsWidth()),
      );
    };

    window.addEventListener("resize", clampPanelSizes);
    return () => window.removeEventListener("resize", clampPanelSizes);
  }, [getMaxSidebarWidth, getMaxToolsWidth]);

  useEffect(() => {
    setModalPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!deleteDialogOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && deleteStatus !== "saving") {
        closeDeleteDialog();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [closeDeleteDialog, deleteDialogOpen, deleteStatus]);

  return (
    <main
      ref={shellRef}
      className={[
        "object-editor-shell",
        activeResizeEdge ? "object-editor-shell--resizing" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        gridTemplateColumns: `${sidebarWidth}px ${OBJECT_EDITOR_RESIZE_HANDLE_WIDTH}px minmax(0, 1fr) ${OBJECT_EDITOR_RESIZE_HANDLE_WIDTH}px ${toolsWidth}px`,
      }}
    >
      <aside className="object-editor-sidebar" aria-label="Object catalogue">
        <div className="object-editor-sidebar-head">
          <p className="object-editor-kicker">VX-27 Object Editor</p>
          <h1>Objects</h1>
          <input
            ref={fileInputRef}
            type="file"
            accept=".glb,model/gltf-binary"
            className="object-editor-file-input"
            onChange={handleLocalFileChange}
          />
          <button
            type="button"
            className={[
              "object-editor-load-btn",
              selection?.type === "local" ? "object-editor-load-btn--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onClick={() => fileInputRef.current?.click()}
          >
            Load GLB…
          </button>
        </div>
        <div className="object-editor-list">
          <ObjectEditorTree
            root={modelTree}
            selectedAssetId={
              selection?.type === "catalog" ? selection.assetId : null
            }
            localPreviewName={
              selection?.type === "local" ? selection.file.name : null
            }
            expandedFolderIds={expandedFolderIds}
            onToggleFolder={toggleFolder}
            onSelectAsset={selectCatalogAsset}
          />
        </div>
      </aside>

      <div
        className={[
          "object-editor-resize-handle",
          activeResizeEdge === "sidebar" ? "object-editor-resize-handle--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize object tree panel"
        onPointerDown={beginPanelResize("sidebar")}
        onPointerMove={movePanelResize}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
      />

      <section className="object-editor-viewer-panel" aria-label="Object viewer">
        <div className="object-editor-canvas-wrap">
          <div
            className={[
              "object-editor-viewport-frame",
              rulersVisible ? "" : "object-editor-viewport-frame--no-rulers",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            {rulersVisible ? (
              <div className="object-editor-viewport-corner" aria-hidden="true">
                0
              </div>
            ) : null}
            {rulersVisible ? (
              <div
                className="object-editor-viewport-ruler object-editor-viewport-ruler--left"
                aria-label="Viewport vertical ruler"
              >
                {viewportRuler?.verticalTicks.map((tick) => (
                  <ViewportRulerMark
                    key={`y-${tick.position}-${tick.label ?? "minor"}`}
                    tick={tick}
                    axis="vertical"
                  />
                ))}
              </div>
            ) : null}
            <div className="object-editor-viewport-stage">
              <div className="object-editor-viewport-controls">
            <IconToggleButton
              label="Rotate view"
              icon={faRotate}
              active={effectiveViewportMode === "rotate"}
              onClick={() => {
                viewportModeRef.current = "rotate";
                setViewportMode("rotate");
              }}
            />
            <IconToggleButton
              label="Pan view"
              icon={faHand}
              active={effectiveViewportMode === "pan"}
              onClick={() => {
                viewportModeRef.current = "pan";
                setViewportMode("pan");
              }}
            />
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            <IconToggleButton
              label="Undo"
              icon={faRotateLeft}
              disabled={!historyAvailability.canUndo}
              onClick={undoEditorHistory}
            />
            <IconToggleButton
              label="Redo"
              icon={faRotateRight}
              disabled={!historyAvailability.canRedo}
              onClick={redoEditorHistory}
            />
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            <IconToggleButton
              label="Wireframe"
              icon={faCube}
              active={viewModes.wireframe}
              onClick={() => setViewMode("wireframe", !viewModes.wireframe)}
            />
            <IconToggleButton
              label="Lighting"
              icon={faLightbulb}
              active={viewModes.lighting}
              onClick={() => setViewMode("lighting", !viewModes.lighting)}
            />
            <IconToggleButton
              label="Texture"
              icon={faPalette}
              active={viewModes.texture}
              onClick={() => setViewMode("texture", !viewModes.texture)}
            />
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            <IconToggleButton
              label="Transform gizmo"
              icon={faCrosshairs}
              active={gizmoEnabled}
              onClick={() => setGizmoEnabled((current) => !current)}
            />
            <IconToggleButton
              label="Move gizmo"
              icon={faUpDownLeftRight}
              active={gizmoEnabled && gizmoMode === "move"}
              onClick={() => toggleGizmoMode("move")}
            />
            <IconToggleButton
              label="Rotate gizmo"
              icon={faArrowsRotate}
              active={gizmoEnabled && gizmoMode === "rotate"}
              onClick={() => toggleGizmoMode("rotate")}
            />
            <div className="object-editor-tool-popover-host">
              <IconToggleButton
                label="Scale gizmo"
                icon={faExpand}
                active={gizmoEnabled && gizmoMode === "scale"}
                onClick={() => toggleGizmoMode("scale")}
              />
              {gizmoEnabled && gizmoMode === "scale" ? (
                <div className="object-editor-tool-popover">
                  <IconToggleButton
                    label="Linked scale"
                    icon={faLink}
                    active={scaleLinked}
                    onClick={() => setScaleLinked((current) => !current)}
                  />
                </div>
              ) : null}
            </div>
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            <IconToggleButton
              label="Grid"
              icon={faBorderAll}
              active={gridVisible}
              onClick={() => setGridVisible((current) => !current)}
            />
            <IconToggleButton
              label="Rulers"
              icon={faRulerCombined}
              active={rulersVisible}
              onClick={() => setRulersVisible((current) => !current)}
            />
            <IconToggleButton
              label="Size labels"
              icon={faTags}
              active={dimensionLabelsVisible}
              onClick={() => setDimensionLabelsVisible((current) => !current)}
            />
          </div>
          <div className="object-editor-viewport-meta">
            <div>
              <p className="object-editor-kicker">{displayAsset?.category}</p>
              <h2>{displayAsset?.name}</h2>
            </div>
            <div className={`object-editor-status object-editor-status--${status}`}>
              {status}
              {isDirty ? " · edited" : ""}
            </div>
            {isDirty ? (
              <div className="object-editor-viewport-save-actions">
                <button
                  type="button"
                  className="object-editor-save-changes-btn"
                  disabled={saveStatus === "saving" || status !== "ready"}
                  onClick={() => void handleSaveEdits()}
                >
                  {saveStatus === "saving" ? "Saving…" : "Save changes"}
                </button>
                <button
                  type="button"
                  className="object-editor-reset-btn"
                  disabled={saveStatus === "saving" || status !== "ready"}
                  onClick={handleResetEdits}
                >
                  Reset
                </button>
              </div>
            ) : null}
          </div>
              <canvas ref={canvasRef} className="object-editor-canvas" />
              {!displayAsset ? (
                <div className="object-editor-empty">
                  <strong>Select a model</strong>
                  <span>Choose an object from the left tree or load a GLB.</span>
                </div>
              ) : null}
              {status === "error" ? (
                <div className="object-editor-empty">
                  <strong>Could not load asset</strong>
                  <span>{displayAsset?.path}</span>
                </div>
              ) : null}
              <ObjectEditorAxisLegend legend={viewportAxisLegend} />
            </div>
            {rulersVisible ? (
              <div
                className="object-editor-viewport-ruler object-editor-viewport-ruler--top"
                aria-label="Viewport horizontal ruler"
              >
                {viewportRuler?.horizontalTicks.map((tick) => (
                  <ViewportRulerMark
                    key={`x-${tick.position}-${tick.label ?? "minor"}`}
                    tick={tick}
                    axis="horizontal"
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <div
        className={[
          "object-editor-resize-handle",
          activeResizeEdge === "tools" ? "object-editor-resize-handle--active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize tools panel"
        onPointerDown={beginPanelResize("tools")}
        onPointerMove={movePanelResize}
        onPointerUp={endPanelResize}
        onPointerCancel={endPanelResize}
      />

      <aside className="object-editor-tools" aria-label="Object settings and tools">
        <div className="object-editor-tools-head">
          <p className="object-editor-kicker">Settings & Tools</p>
          <h2>Inspector</h2>
        </div>

        <section className="object-editor-tool-section">
          <h3>Selected</h3>
          <dl className="object-editor-details">
            <div>
              <dt>Name</dt>
              <dd>{displayAsset?.name}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{displayAsset?.category}</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>{displayAsset?.type}</dd>
            </div>
            <div>
              <dt>Path</dt>
              <dd>
                <code>{displayAsset?.path}</code>
              </dd>
            </div>
          </dl>
          <p className="object-editor-save-hint">Scene units: 1 unit = 1 meter.</p>
        </section>

        {modelToggleControls.length > 0 ? (
          <section className="object-editor-tool-section">
            <h3>Animation toggles</h3>
            <p className="object-editor-save-hint">
              Toggle controls are detected from GLB animation groups and moving parts.
            </p>
            {modelToggleControls.map((control) => (
              <label
                key={control.id}
                className="object-editor-control object-editor-control--inline"
              >
                <span>{control.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(modelToggleStates[control.id])}
                  disabled={status !== "ready"}
                  onChange={(event) => {
                    updateModelToggleState(
                      control.id,
                      event.currentTarget.checked,
                    );
                  }}
                />
              </label>
            ))}
          </section>
        ) : null}

        {oilBarrelEditorActive ? (
          <section className="object-editor-tool-section">
            <h3>Oil barrel fire</h3>
            <p className="object-editor-save-hint">
              Preview tuning is stored in this browser until you save it back to
              the overlay JSON (dev only).
            </p>
            <label className="object-editor-control object-editor-control--inline">
              <span>Interior fire</span>
              <input
                type="checkbox"
                checked={oilBarrelFireEnabled}
                disabled={status !== "ready"}
                onChange={(event) => {
                  const enabled = event.currentTarget.checked;
                  const root = currentRootRef.current;
                  const scene = sceneRef.current;
                  if (!root || !scene || !displayAsset) {
                    return;
                  }
                  void (async () => {
                    saveOilBarrelEditorInteriorFire(enabled);
                    setOilBarrelFireEnabled(enabled);
                    const applied = await applyOilBarrelInteriorFireSetting(
                      scene,
                      root,
                      displayAsset.path,
                      enabled,
                    );
                    if (!applied) {
                      saveOilBarrelEditorInteriorFire(false);
                      setOilBarrelFireEnabled(false);
                      return;
                    }
                    patchOilBarrelFireTuning({ interiorFire: enabled });
                  })();
                }}
              />
            </label>
            {OIL_BARREL_FIRE_TUNING_CONTROL_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="object-editor-save-hint">
                  {group.title}
                  {group.hint ? ` — ${group.hint}` : ""}
                </p>
                {group.controls.map((control) => {
                  const limits = getOilBarrelFireTuningControlLimits(control.key);
                  return (
                    <NumericControl
                      key={control.key}
                      label={control.label}
                      value={oilBarrelFireTuning[control.key]}
                      min={limits.min}
                      max={limits.max}
                      step={limits.step}
                      buttonStep={limits.nudge}
                      disabled={status !== "ready" || !oilBarrelFireEnabled}
                      onChange={(value) => {
                        patchOilBarrelFireTuning({ [control.key]: value });
                      }}
                    />
                  );
                })}
              </div>
            ))}
            <div className="object-editor-save-actions">
              <button
                type="button"
                className="object-editor-save-btn"
                disabled={
                  status !== "ready" ||
                  !oilBarrelFireEnabled ||
                  oilBarrelTuningSaveStatus === "saving"
                }
                onClick={() => {
                  void handleSaveOilBarrelFireTuning();
                }}
              >
                {oilBarrelTuningSaveStatus === "saving"
                  ? "Saving…"
                  : "Save fire tuning to overlay"}
              </button>
            </div>
            {oilBarrelTuningSaveMessage ? (
              <p
                className={[
                  "object-editor-save-message",
                  oilBarrelTuningSaveStatus === "error"
                    ? "object-editor-save-message--error"
                    : "object-editor-save-message--success",
                ].join(" ")}
              >
                {oilBarrelTuningSaveMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        <section className="object-editor-tool-section">
          <h3>Imported Region</h3>
          {selectedSurface ? (
            <>
              <dl className="object-editor-details object-editor-details--compact">
                <div>
                  <dt>Clicked mesh</dt>
                  <dd>{selectedSurface.meshName}</dd>
                </div>
                <div>
                  <dt>Region meshes</dt>
                  <dd>{selectedSurface.regionMeshCount}</dd>
                </div>
                <div>
                  <dt>Material</dt>
                  <dd>{selectedSurface.materialName}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{selectedSurface.materialKind}</dd>
                </div>
              </dl>
              {selectedSurface.materialKind === "unsupported" ? (
                <p className="object-editor-save-hint">
                  This material type is not editable yet.
                </p>
              ) : (
                <>
                  <p className="object-editor-save-hint">
                    Material UV scale/offset applies to the whole material. Face
                    rotation applies to the clicked surface only (front and back are
                    separate) around that surface&apos;s texture centre.
                  </p>
                  {!selectedSurface.hasEditableTextures ? (
                    <p className="object-editor-save-hint">
                      This region has no texture maps — UV controls only affect
                      textured materials.
                    </p>
                  ) : null}
                  {!selectedSurface.hasEditableFaceUvs ? (
                    <p className="object-editor-save-hint">
                      Click a face on the model to edit per-face texture rotation.
                    </p>
                  ) : null}
                  {(() => {
                    const widthRange =
                      geometryControlRanges?.width ??
                      focusedGeometryRange(selectedSurface.geometryWidth);
                    const heightRange =
                      geometryControlRanges?.height ??
                      focusedGeometryRange(selectedSurface.geometryHeight);
                    return (
                  <div className="object-editor-control-grid">
                    <NumericControl
                      label="Geometry width"
                      min={widthRange.min}
                      max={widthRange.max}
                      step={widthRange.step}
                      buttonStep={widthRange.step}
                      disabled={selectedSurface.geometryWidth <= 0}
                      value={selectedSurface.geometryWidth}
                      onChange={(geometryWidth) =>
                        updateSelectedSurfaceGeometry({ geometryWidth })
                      }
                      onCommit={(geometryWidth) =>
                        updateSelectedSurfaceGeometry({ geometryWidth }, true)
                      }
                    />
                    <NumericControl
                      label="Geometry height"
                      min={heightRange.min}
                      max={heightRange.max}
                      step={heightRange.step}
                      buttonStep={heightRange.step}
                      disabled={selectedSurface.geometryHeight <= 0}
                      value={selectedSurface.geometryHeight}
                      onChange={(geometryHeight) =>
                        updateSelectedSurfaceGeometry({ geometryHeight })
                      }
                      onCommit={(geometryHeight) =>
                        updateSelectedSurfaceGeometry({ geometryHeight }, true)
                      }
                    />
                  </div>
                    );
                  })()}
                  <div className="object-editor-control-grid">
                    <NumericControl
                      label="Material UV width"
                      min={0.05}
                      max={4}
                      step={0.05}
                      disabled={!selectedSurface.hasEditableTextures}
                      value={selectedSurface.uvScaleU}
                      onChange={(uvScaleU) => updateSelectedSurface({ uvScaleU })}
                    />
                    <NumericControl
                      label="Material UV height"
                      min={0.05}
                      max={4}
                      step={0.05}
                      disabled={!selectedSurface.hasEditableTextures}
                      value={selectedSurface.uvScaleV}
                      onChange={(uvScaleV) => updateSelectedSurface({ uvScaleV })}
                    />
                    <NumericControl
                      label="Material UV offset U"
                      min={-2}
                      max={2}
                      step={0.01}
                      disabled={!selectedSurface.hasEditableTextures}
                      value={selectedSurface.uvOffsetU}
                      onChange={(uvOffsetU) => updateSelectedSurface({ uvOffsetU })}
                    />
                    <NumericControl
                      label="Material UV offset V"
                      min={-2}
                      max={2}
                      step={0.01}
                      disabled={!selectedSurface.hasEditableTextures}
                      value={selectedSurface.uvOffsetV}
                      onChange={(uvOffsetV) => updateSelectedSurface({ uvOffsetV })}
                    />
                    <NumericControl
                      label="Face texture rotation"
                      min={0}
                      max={360}
                      step={1}
                      buttonStep={1}
                      disabled={!selectedSurface.hasEditableFaceUvs}
                      value={selectedSurface.faceUvRotationDeg}
                      onChange={(faceUvRotationDeg) =>
                        updateSelectedSurface({
                          faceUvRotationDeg: normalizeFaceUvRotationDeg(faceUvRotationDeg),
                        })
                      }
                    />
                  </div>
                  <div className="object-editor-texture-rotate-actions">
                    <button
                      type="button"
                      className="object-editor-save-btn object-editor-save-btn--secondary"
                      disabled={!selectedSurface.hasEditableFaceUvs}
                      onClick={() =>
                        updateSelectedSurface({
                          faceUvRotationDeg: normalizeFaceUvRotationDeg(
                            selectedSurface.faceUvRotationDeg + 90,
                          ),
                        })
                      }
                    >
                      Rotate face 90°
                    </button>
                    <button
                      type="button"
                      className="object-editor-save-btn object-editor-save-btn--secondary"
                      disabled={!selectedSurface.hasEditableFaceUvs}
                      onClick={() =>
                        updateSelectedSurface({
                          faceUvRotationDeg: normalizeFaceUvRotationDeg(
                            selectedSurface.faceUvRotationDeg + 180,
                          ),
                        })
                      }
                    >
                      Flip face 180°
                    </button>
                  </div>
                  <label className="object-editor-control">
                    <span>Base colour</span>
                    <input
                      type="color"
                      value={selectedSurface.albedoColor}
                      onChange={(event) =>
                        updateSelectedSurface({
                          albedoColor: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <label className="object-editor-control">
                    <span>Emissive colour</span>
                    <input
                      type="color"
                      value={selectedSurface.emissiveColor}
                      onChange={(event) =>
                        updateSelectedSurface({
                          emissiveColor: event.currentTarget.value,
                        })
                      }
                    />
                  </label>
                  <div className="object-editor-control-grid">
                    <NumericControl
                      label="Alpha"
                      min={0}
                      max={1}
                      step={0.05}
                      value={selectedSurface.alpha}
                      onChange={(alpha) => updateSelectedSurface({ alpha })}
                    />
                    <NumericControl
                      label="Roughness"
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={selectedSurface.materialKind !== "pbr"}
                      value={selectedSurface.roughness}
                      onChange={(roughness) => updateSelectedSurface({ roughness })}
                    />
                    <NumericControl
                      label="Metallic"
                      min={0}
                      max={1}
                      step={0.05}
                      disabled={selectedSurface.materialKind !== "pbr"}
                      value={selectedSurface.metallic}
                      onChange={(metallic) => updateSelectedSurface({ metallic })}
                    />
                    <NumericControl
                      label="Render bias"
                      min={-8}
                      max={8}
                      step={0.1}
                      buttonStep={0.1}
                      value={selectedSurface.renderBias}
                      onChange={(renderBias) => updateSelectedSurface({ renderBias })}
                    />
                    <NumericControl
                      label="Draw order"
                      min={-10000}
                      max={10000}
                      step={1}
                      buttonStep={10}
                      value={selectedSurface.drawOrder}
                      onChange={(drawOrder) => updateSelectedSurface({ drawOrder })}
                    />
                    <label className="object-editor-control object-editor-control--inline">
                      <span>Unlit</span>
                      <input
                        type="checkbox"
                        checked={selectedSurface.unlit}
                        onChange={(event) =>
                          updateSelectedSurface({
                            unlit: event.currentTarget.checked,
                          })
                        }
                      />
                    </label>
                    <label className="object-editor-control object-editor-control--inline">
                      <span>Two sided</span>
                      <input
                        type="checkbox"
                        checked={selectedSurface.twoSided}
                        onChange={(event) =>
                          updateSelectedSurface({
                            twoSided: event.currentTarget.checked,
                          })
                        }
                      />
                    </label>
                    <label className="object-editor-control object-editor-control--inline">
                      <span>Depth write</span>
                      <input
                        type="checkbox"
                        checked={selectedSurface.depthWrite}
                        onChange={(event) =>
                          updateSelectedSurface({
                            depthWrite: event.currentTarget.checked,
                          })
                        }
                      />
                    </label>
                    <label className="object-editor-control object-editor-control--inline">
                      <span>Depth test</span>
                      <input
                        type="checkbox"
                        checked={selectedSurface.depthTest}
                        onChange={(event) =>
                          updateSelectedSurface({
                            depthTest: event.currentTarget.checked,
                          })
                        }
                      />
                    </label>
                  </div>
                </>
              )}
              <button
                type="button"
                className="object-editor-save-btn object-editor-save-btn--secondary"
                onClick={clearSurfaceSelection}
              >
                Clear region
              </button>
            </>
          ) : (
            <p className="object-editor-save-hint">
              Click a model surface to inspect the imported material region it belongs to.
            </p>
          )}
        </section>

        {isDirty ? (
          <section className="object-editor-tool-section">
            <h3>Save changes</h3>
            <p className="object-editor-save-hint">
              Exports the edited model back to{" "}
              <code>public/models/</code>. Dev only.
            </p>
            {selection?.type === "local" ? (
              <>
                <label className="object-editor-control">
                  <span>Folder</span>
                  <select
                    value={saveFolder}
                    onChange={(event) => setSaveFolder(event.currentTarget.value)}
                  >
                    {modelFolders.map((folder) => (
                      <option key={folder} value={folder}>
                        {folder}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="object-editor-control">
                  <span>Model name</span>
                  <input
                    type="text"
                    value={saveModelName}
                    onChange={(event) => setSaveModelName(event.currentTarget.value)}
                    placeholder="pulse_rifle_mk2"
                    spellCheck={false}
                  />
                </label>
                <label className="object-editor-control">
                  <span>Display name</span>
                  <input
                    type="text"
                    value={saveDisplayName}
                    onChange={(event) =>
                      setSaveDisplayName(event.currentTarget.value)
                    }
                    placeholder="Pulse Rifle Mk2"
                  />
                </label>
              </>
            ) : null}
            <p className="object-editor-save-preview">
              <span>Target</span>
              <code>{editedSavePreviewPath}</code>
            </p>
            <div className="object-editor-save-actions">
              <button
                type="button"
                className="object-editor-save-btn"
                disabled={saveStatus === "saving" || status !== "ready"}
                onClick={() => void handleSaveEdits()}
              >
                {saveStatus === "saving" ? "Saving…" : "Save GLB"}
              </button>
              <button
                type="button"
                className="object-editor-save-btn object-editor-save-btn--secondary"
                disabled={saveStatus === "saving" || status !== "ready"}
                onClick={handleResetEdits}
              >
                Reset
              </button>
            </div>
            {saveMessage ? (
              <p
                className={[
                  "object-editor-save-message",
                  saveStatus === "error"
                    ? "object-editor-save-message--error"
                    : "object-editor-save-message--success",
                ].join(" ")}
              >
                {saveMessage}
              </p>
            ) : null}
          </section>
        ) : selection?.type === "local" ? (
          <section className="object-editor-tool-section">
            <h3>Save to server</h3>
            <p className="object-editor-save-hint">
              Import the original file to <code>public/models/</code> without
              edits. Dev only.
            </p>
            <label className="object-editor-control">
              <span>Folder</span>
              <select
                value={saveFolder}
                onChange={(event) => setSaveFolder(event.currentTarget.value)}
              >
                {modelFolders.map((folder) => (
                  <option key={folder} value={folder}>
                    {folder}
                  </option>
                ))}
              </select>
            </label>
            <label className="object-editor-control">
              <span>Model name</span>
              <input
                type="text"
                value={saveModelName}
                onChange={(event) => setSaveModelName(event.currentTarget.value)}
                placeholder="pulse_rifle_mk2"
                spellCheck={false}
              />
            </label>
            <label className="object-editor-control">
              <span>Display name</span>
              <input
                type="text"
                value={saveDisplayName}
                onChange={(event) => setSaveDisplayName(event.currentTarget.value)}
                placeholder="Pulse Rifle Mk2"
              />
            </label>
            <p className="object-editor-save-preview">
              <span>Target</span>
              <code>{savePreviewPath}</code>
            </p>
            <button
              type="button"
              className="object-editor-save-btn"
              disabled={saveStatus === "saving" || status !== "ready"}
              onClick={() => void handleSaveToServer()}
            >
              {saveStatus === "saving" ? "Saving…" : "Save GLB"}
            </button>
            {saveMessage ? (
              <p
                className={[
                  "object-editor-save-message",
                  saveStatus === "error"
                    ? "object-editor-save-message--error"
                    : "object-editor-save-message--success",
                ].join(" ")}
              >
                {saveMessage}
              </p>
            ) : null}
          </section>
        ) : null}

        {selectedUserAsset ? (
          <section className="object-editor-tool-section object-editor-tool-section--danger">
            <h3>Delete GLB</h3>
            <p className="object-editor-save-hint">
              Permanently removes this saved GLB from <code>public/models/</code>.
            </p>
            <p className="object-editor-save-preview">
              <span>Target</span>
              <code>{selectedUserAsset.path}</code>
            </p>
            <button
              type="button"
              className="object-editor-save-btn object-editor-save-btn--danger"
              disabled={saveStatus === "saving" || deleteStatus === "saving"}
              onClick={openDeleteDialog}
            >
              Delete GLB
            </button>
            {deleteMessage ? (
              <p
                className={[
                  "object-editor-save-message",
                  deleteStatus === "error"
                    ? "object-editor-save-message--error"
                    : "object-editor-save-message--success",
                ].join(" ")}
              >
                {deleteMessage}
              </p>
            ) : null}
          </section>
        ) : null}

      </aside>
      {modalPortalHost && deleteDialogOpen && selectedUserAsset
        ? createPortal(
            <div
              className="object-editor-modal-backdrop"
              role="presentation"
              onClick={() => {
                if (deleteStatus !== "saving") {
                  closeDeleteDialog();
                }
              }}
            >
              <div
                className="object-editor-modal object-editor-modal--delete"
                role="dialog"
                aria-modal="true"
                aria-labelledby="object-editor-delete-title"
                onClick={(event) => event.stopPropagation()}
              >
                <header className="object-editor-modal__header">
                  <h2 id="object-editor-delete-title">Delete GLB</h2>
                  <p className="object-editor-modal__lead">
                    This will permanently remove the file from{" "}
                    <code>public/models/</code>. Type the model name exactly to
                    confirm.
                  </p>
                  <p className="object-editor-modal__path">
                    <code>{selectedUserAsset.path}</code>
                  </p>
                </header>

                <div className="object-editor-modal__field">
                  <label htmlFor="object-editor-delete-confirm">
                    Confirm model name
                  </label>
                  <input
                    id="object-editor-delete-confirm"
                    type="text"
                    value={deleteConfirmName}
                    onChange={(event) =>
                      setDeleteConfirmName(event.currentTarget.value)
                    }
                    placeholder={selectedUserAsset.name}
                    spellCheck={false}
                    autoComplete="off"
                    autoFocus
                  />
                  <p className="object-editor-modal__hint">
                    Type <strong>{selectedUserAsset.name}</strong>
                  </p>
                </div>

                {deleteMessage && deleteStatus === "error" ? (
                  <p className="object-editor-modal__error">{deleteMessage}</p>
                ) : null}

                <footer className="object-editor-modal__actions">
                  <button
                    type="button"
                    className="object-editor-save-btn object-editor-save-btn--danger"
                    disabled={!deleteConfirmMatches || deleteStatus === "saving"}
                    onClick={() => void handleDeleteSelectedModel()}
                  >
                    {deleteStatus === "saving" ? "Deleting…" : "Delete permanently"}
                  </button>
                  <button
                    type="button"
                    className="object-editor-save-btn object-editor-save-btn--secondary"
                    disabled={deleteStatus === "saving"}
                    onClick={closeDeleteDialog}
                  >
                    Cancel
                  </button>
                </footer>
              </div>
            </div>,
            modalPortalHost,
          )
        : null}
    </main>
  );
}
