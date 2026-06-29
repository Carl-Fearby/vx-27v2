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
import {
  ArcRotateCamera,
  Color3,
  Color4,
  DirectionalLight,
  Engine,
  HemisphericLight,
  LinesMesh,
  Material,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
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
  faPalette,
  faRotateLeft,
  faRotateRight,
  faRotate,
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
  fetchModelLibrary,
  previewSavedAssetPath,
  saveModelToServer,
} from "@/lib/objectEditor/userCatalog";
import {
  applyObjectEditorViewModes,
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
};

type EditableMaterialKind = "pbr" | "standard" | "unsupported";

type SurfaceSelection = {
  meshId: number;
  meshName: string;
  regionMeshCount: number;
  materialName: string;
  materialKind: EditableMaterialKind;
  uvScaleU: number;
  uvScaleV: number;
  uvOffsetU: number;
  uvOffsetV: number;
  faceUvRotationDeg: number;
  alpha: number;
  albedoColor: string;
  emissiveColor: string;
  metallic: number;
  roughness: number;
  unlit: boolean;
  hasEditableTextures: boolean;
  hasEditableFaceUvs: boolean;
};

type ViewportToggle = {
  id:
    | keyof ObjectEditorViewModes
    | "grid"
    | "gizmo"
    | "undo"
    | "redo"
    | "viewport-rotate"
    | "viewport-pan"
    | GizmoMode
    | ViewportMode;
  label: string;
  icon: IconDefinition;
  active: boolean;
  disabled?: boolean;
  onToggle: () => void;
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
  material: MaterialSnapshot | null;
  faceUv: MeshFaceUvSnapshot | null;
};

type ObjectEditorHistorySnapshot = {
  root: TransformSnapshot;
  meshes: MeshHistorySnapshot[];
};

const objectEditorMaterialClones = new WeakSet<Material>();

function colorFromKelvin(kelvin: number): Color3 {
  const rgb = kelvinToRgb(kelvin);
  return new Color3(rgb.r, rgb.g, rgb.b);
}

const OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY = 1000;

function updateObjectEditorPanSensibility(
  camera: ArcRotateCamera,
  objectSize: number,
): void {
  const longestSide = Math.max(objectSize, 0.001);
  const defaultRadius = Math.max(longestSide * 2.6, 0.001);
  camera.metadata = {
    ...camera.metadata,
    objectEditorLongestSide: longestSide,
    objectEditorDefaultRadius: defaultRadius,
  };
  syncObjectEditorPanSensibility(camera);
}

function syncObjectEditorPanSensibility(camera: ArcRotateCamera): void {
  const longestSide = camera.metadata?.objectEditorLongestSide;
  const defaultRadius = camera.metadata?.objectEditorDefaultRadius;
  if (typeof longestSide !== "number" || typeof defaultRadius !== "number") {
    camera.panningSensibility = OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY;
    return;
  }

  const base = Math.max(OBJECT_EDITOR_DEFAULT_PANNING_SENSIBILITY, 5000 / longestSide);
  const zoomScale = Math.max(
    defaultRadius / Math.max(camera.radius, defaultRadius * 0.01),
    1,
  );
  camera.panningSensibility = base * zoomScale;
}

function frameObject(camera: ArcRotateCamera, root: TransformNode) {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const center = bounds.min.add(bounds.max).scale(0.5);
  const longestSide = Math.max(size.x, size.y, size.z, 0.001);
  const nearClip = Math.max(longestSide * 0.0005, 0.00001);
  camera.setTarget(center);
  camera.minZ = nearClip;
  camera.maxZ = Math.max(longestSide * 1000, 1000);
  camera.radius = Math.max(longestSide * 2.6, nearClip * 20);
  camera.lowerRadiusLimit = Math.max(longestSide * 0.03, nearClip * 4);
  camera.upperRadiusLimit = Math.max(longestSide * 20, 5);
  updateObjectEditorPanSensibility(camera, longestSide);
}

function applyViewportMode(camera: ArcRotateCamera, mode: ViewportMode): void {
  camera.detachControl();
  camera.attachControl(true, false, mode === "pan" ? 0 : 2);
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

  return {
    meshId: mesh.uniqueId,
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
    alpha: material?.alpha ?? 1,
    albedoColor: colorToHex(albedoColor),
    emissiveColor: colorToHex(emissiveColor),
    metallic: material instanceof PBRMaterial ? material.metallic ?? 0 : 0,
    roughness: material instanceof PBRMaterial ? material.roughness ?? 0.5 : 0.5,
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
};

function NumericControl({
  label,
  value,
  min,
  max,
  step,
  buttonStep,
  disabled = false,
  onChange,
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
        />
      </div>
      <div className="object-editor-slider-control">
        <button
          type="button"
          aria-label={`Decrease ${label}`}
          disabled={disabled}
          onClick={() => onChange(steppedValue(safeValue, nudgeStep, -1, min, max))}
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
        />
        <button
          type="button"
          aria-label={`Increase ${label}`}
          disabled={disabled}
          onClick={() => onChange(steppedValue(safeValue, nudgeStep, 1, min, max))}
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
  const gizmoManagerRef = useRef<GizmoManager | null>(null);
  const gridRef = useRef<LinesMesh | null>(null);
  const selectedSurfaceMeshRef = useRef<Mesh | null>(null);
  const selectedFaceIdRef = useRef<number>(-1);
  const selectedRegionMeshesRef = useRef<Mesh[]>([]);
  const pointerDownRef = useRef<{ x: number; y: number } | null>(null);
  const [status, setStatus] = useState<ViewerStatus>("idle");
  const [selectedSurface, setSelectedSurface] = useState<SurfaceSelection | null>(null);
  const [gridVisible, setGridVisible] = useState(true);
  const [viewportMode, setViewportMode] = useState<ViewportMode>("rotate");
  const viewportModeRef = useRef<ViewportMode>("rotate");
  const [sceneReadyGeneration, setSceneReadyGeneration] = useState(0);
  const [gizmoEnabled, setGizmoEnabled] = useState(true);
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("move");
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
  const [oilBarrelEditorActive, setOilBarrelEditorActive] = useState(false);
  const [oilBarrelFireEnabled, setOilBarrelFireEnabled] = useState(
    loadOilBarrelEditorInteriorFire,
  );
  const [oilBarrelFireTuning, setOilBarrelFireTuning] = useState(
    getDefaultOilBarrelEditorFireTuning,
  );
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
    mesh.outlineColor = new Color3(0.25, 0.7, 1);
    mesh.outlineWidth = 0.004;
    mesh.renderOutline = true;
    setSelectedSurface(surfaceSelectionFromMesh(mesh, regionMeshes, faceId));
  }, [clearSelectedRegionOutline]);

  const clearSurfaceSelection = useCallback(() => {
    clearSelectedRegionOutline();
    selectedSurfaceMeshRef.current = null;
    selectedFaceIdRef.current = -1;
    selectedRegionMeshesRef.current = [];
    setSelectedSurface(null);
  }, [clearSelectedRegionOutline]);

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
    setIsDirty(
      Boolean(current && baseline && !snapshotsMatch(current, baseline)),
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

  const undoEditorHistory = useCallback(() => {
    const previous = historyRef.current.undo.pop();
    const current = captureObjectEditorSnapshot(currentRootRef.current);
    if (!previous || !current) {
      return;
    }
    historyRef.current.redo.push(current);
    applyObjectEditorSnapshot(currentRootRef.current, previous);
    refreshSelectedSurface();
    refreshHistoryAvailability();
    refreshDirtyState();
  }, [refreshDirtyState, refreshHistoryAvailability, refreshSelectedSurface]);

  const redoEditorHistory = useCallback(() => {
    const next = historyRef.current.redo.pop();
    const current = captureObjectEditorSnapshot(currentRootRef.current);
    if (!next || !current) {
      return;
    }
    historyRef.current.undo.push(current);
    applyObjectEditorSnapshot(currentRootRef.current, next);
    refreshSelectedSurface();
    refreshHistoryAvailability();
    refreshDirtyState();
  }, [refreshDirtyState, refreshHistoryAvailability, refreshSelectedSurface]);

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
      Math.PI * 1.3,
      Math.PI * 0.38,
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
    viewportModeRef.current = "rotate";
    setViewportMode("rotate");
    applyViewportMode(camera, "rotate");
    setSceneReadyGeneration((generation) => generation + 1);
    const panSyncObserver = camera.onAfterCheckInputsObservable.add(() => {
      syncObjectEditorPanSensibility(camera);
    });
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
    gridRef.current = grid;

    let lastSurfaceSyncMs = 0;
    let wasGizmoDragging = false;
    let gizmoDragSnapshot: ObjectEditorHistorySnapshot | null = null;
    engine.runRenderLoop(() => {
      const isGizmoDragging = gizmoManager.isDragging;
      if (isGizmoDragging && !wasGizmoDragging) {
        gizmoDragSnapshot = captureObjectEditorSnapshot(currentRootRef.current);
      }
      if (!isGizmoDragging && wasGizmoDragging) {
        commitHistorySnapshot(gizmoDragSnapshot);
        gizmoDragSnapshot = null;
      }
      wasGizmoDragging = isGizmoDragging;

      if (gizmoManager.isDragging && selectedSurfaceMeshRef.current) {
        const now = performance.now();
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
      scene.render();
    });

    const resize = () => engine.resize();
    window.addEventListener("resize", resize);
    const onPointerDown = (event: PointerEvent) => {
      pointerDownRef.current = { x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      const start = pointerDownRef.current;
      pointerDownRef.current = null;
      if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) {
        return;
      }
      const pick = scene.pick(scene.pointerX, scene.pointerY, (candidate) => {
        if (!(candidate instanceof Mesh) || !candidate.isPickable) {
          return false;
        }
        return Boolean(currentRootRef.current?.getChildMeshes(false).includes(candidate));
      });
      if (pick?.hit && pick.pickedMesh instanceof Mesh) {
        selectSurfaceMesh(pick.pickedMesh, pick.faceId);
      }
    };
    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointerup", onPointerUp);
    const resizeObserver = new ResizeObserver(() => {
      engine.resize();
    });
    resizeObserver.observe(canvas);
    resize();

    return () => {
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointerup", onPointerUp);
      resizeObserver.disconnect();
      camera.onAfterCheckInputsObservable.remove(panSyncObserver);
      currentRootRef.current?.dispose(false, true);
      clearSelectedRegionOutline();
      gizmoManager.dispose();
      scene.dispose();
      engine.dispose();
      sceneRef.current = null;
      cameraRef.current = null;
      currentRootRef.current = null;
      gizmoManagerRef.current = null;
      gridRef.current = null;
    };
  }, [
    commitHistorySnapshot,
    clearSelectedRegionOutline,
    selectSurfaceMesh,
  ]);

  useEffect(() => {
    const camera = cameraRef.current;
    if (!camera) {
      return;
    }
    applyViewportMode(camera, viewportModeRef.current);
  }, [viewportMode, sceneReadyGeneration]);

  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.isVisible = gridVisible;
    }
  }, [gridVisible]);

  useEffect(() => {
    const gizmoManager = gizmoManagerRef.current;
    if (!gizmoManager) {
      return;
    }

    const shouldShow = gizmoEnabled && status === "ready";
    gizmoManager.positionGizmoEnabled = shouldShow && gizmoMode === "move";
    gizmoManager.rotationGizmoEnabled = shouldShow && gizmoMode === "rotate";
    gizmoManager.scaleGizmoEnabled = shouldShow && gizmoMode === "scale";
    gizmoManager.attachToNode(null);
    gizmoManager.attachToMesh(null);
    if (shouldShow) {
      gizmoManager.attachToNode(currentRootRef.current);
    }
  }, [gizmoEnabled, gizmoMode, status]);

  useEffect(() => {
    const scene = sceneRef.current;
    const camera = cameraRef.current;
    if (!scene || !camera || !displayAsset) return undefined;
    const activeSelection = selection;
    if (!activeSelection) return undefined;

    let cancelled = false;
    historyRef.current = { undo: [], redo: [] };
    baselineSnapshotRef.current = null;
    setIsDirty(false);
    gizmoManagerRef.current?.attachToNode(null);
    clearSelectedRegionOutline();
    selectedSurfaceMeshRef.current = null;
    selectedFaceIdRef.current = -1;
    selectedRegionMeshesRef.current = [];
    currentRootRef.current?.dispose(false, true);
    currentRootRef.current = null;
    setOilBarrelEditorActive(false);
    setOilBarrelTuningSaveStatus("idle");
    setOilBarrelTuningSaveMessage("");

    const load = async () => {
      try {
        await Promise.resolve();
        if (cancelled) {
          return;
        }
        setStatus("loading");
        setSelectedSurface(null);
        refreshHistoryAvailability();
        const rootName = `objectEditor_${displayAsset.id}`;
        const { root } =
          activeSelection.type === "local"
            ? await loadGltfModelFromFile(
                scene,
                activeSelection.file,
                rootName,
              )
            : await loadGltfModel(scene, displayAsset.path, rootName);
        if (cancelled) {
          root.dispose(false, true);
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
            const editorTuning = mergeOilBarrelEditorFireTuning(
              getOilBarrelFireTuning(root) ?? getDefaultOilBarrelEditorFireTuning(),
              loadOilBarrelEditorFireTuningPatch(),
            );
            applyOilBarrelFireTuning(root, editorTuning);
            setOilBarrelFireTuning(editorTuning);
          } catch {
            // GLB still loads if fire videos fail — user can retry via the toggle.
          }
        } else {
          const overlayModelPath =
            activeSelection.type === "catalog" ? displayAsset.path : null;
          if (overlayModelPath) {
            await attachModelOverlays(scene, root, overlayModelPath);
          }
        }

        currentRootRef.current = root;
        applyObjectEditorViewModes(root, viewModesRef.current);
        frameObject(camera, root);
        baselineSnapshotRef.current = captureObjectEditorSnapshot(root);
        refreshHistoryAvailability();
        refreshDirtyState();
        setStatus("ready");
      } catch {
        setStatus("error");
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [
    clearSelectedRegionOutline,
    refreshDirtyState,
    refreshHistoryAvailability,
    selection,
    displayAsset,
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

  const selectCatalogAsset = (assetId: string) => {
    setExpandedFolderIds((current) => {
      const next = new Set(current);
      for (const id of collectFolderIdsForAsset(modelTree, assetId)) {
        next.add(id);
      }
      return next;
    });
    setSelection({ type: "catalog", assetId });
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
    setSaveFolder(defaultFolderFromFileName(file.name));
    setSaveModelName(modelName);
    setSaveDisplayName(titleCaseSegment(modelName));
    setSaveStatus("idle");
    setSaveMessage("");
    setExpandedFolderIds((current) => new Set(current).add("local"));
    setSelection((current) => ({
      type: "local",
      file,
      loadKey: current?.type === "local" ? current.loadKey + 1 : 0,
    }));
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
    historyRef.current = { undo: [], redo: [] };
    refreshSelectedSurface();
    refreshHistoryAvailability();
    refreshDirtyState();
    setSaveStatus("idle");
    setSaveMessage("");
  }, [
    refreshDirtyState,
    refreshHistoryAvailability,
    refreshSelectedSurface,
    saveStatus,
    status,
  ]);

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

  const viewportToggles: ViewportToggle[] = [
    {
      id: "viewport-rotate",
      label: "Rotate view",
      icon: faRotate,
      active: viewportMode === "rotate",
      onToggle: () => {
        viewportModeRef.current = "rotate";
        setViewportMode("rotate");
      },
    },
    {
      id: "viewport-pan",
      label: "Pan view",
      icon: faHand,
      active: viewportMode === "pan",
      onToggle: () => {
        viewportModeRef.current = "pan";
        setViewportMode("pan");
      },
    },
    {
      id: "wireframe",
      label: "Wireframe",
      icon: faCube,
      active: viewModes.wireframe,
      onToggle: () => setViewMode("wireframe", !viewModes.wireframe),
    },
    {
      id: "lighting",
      label: "Lighting",
      icon: faLightbulb,
      active: viewModes.lighting,
      onToggle: () => setViewMode("lighting", !viewModes.lighting),
    },
    {
      id: "texture",
      label: "Texture",
      icon: faPalette,
      active: viewModes.texture,
      onToggle: () => setViewMode("texture", !viewModes.texture),
    },
    {
      id: "gizmo",
      label: "Transform gizmo",
      icon: faCrosshairs,
      active: gizmoEnabled,
      onToggle: () => setGizmoEnabled((current) => !current),
    },
    {
      id: "move",
      label: "Move gizmo",
      icon: faUpDownLeftRight,
      active: gizmoEnabled && gizmoMode === "move",
      onToggle: () => toggleGizmoMode("move"),
    },
    {
      id: "rotate",
      label: "Rotate gizmo",
      icon: faArrowsRotate,
      active: gizmoEnabled && gizmoMode === "rotate",
      onToggle: () => toggleGizmoMode("rotate"),
    },
    {
      id: "scale",
      label: "Scale gizmo",
      icon: faExpand,
      active: gizmoEnabled && gizmoMode === "scale",
      onToggle: () => toggleGizmoMode("scale"),
    },
    {
      id: "grid",
      label: "Grid",
      icon: faBorderAll,
      active: gridVisible,
      onToggle: () => setGridVisible((current) => !current),
    },
  ];

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
          <div className="object-editor-viewport-controls">
            {viewportToggles.slice(0, 2).map((toggle) => (
              <button
                key={toggle.id}
                type="button"
                className={[
                  "object-editor-icon-toggle",
                  toggle.active ? "object-editor-icon-toggle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={toggle.label}
                aria-pressed={toggle.active}
                data-tooltip={toggle.label}
                disabled={toggle.disabled}
                onClick={toggle.onToggle}
              >
                <FontAwesomeIcon icon={toggle.icon} />
                <span className="object-editor-tooltip" role="tooltip">
                  {toggle.label}
                </span>
              </button>
            ))}
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            <button
              type="button"
              className="object-editor-icon-toggle"
              aria-label="Undo"
              aria-pressed="false"
              data-tooltip="Undo"
              disabled={!historyAvailability.canUndo}
              onClick={undoEditorHistory}
            >
              <FontAwesomeIcon icon={faRotateLeft} />
              <span className="object-editor-tooltip" role="tooltip">
                Undo
              </span>
            </button>
            <button
              type="button"
              className="object-editor-icon-toggle"
              aria-label="Redo"
              aria-pressed="false"
              data-tooltip="Redo"
              disabled={!historyAvailability.canRedo}
              onClick={redoEditorHistory}
            >
              <FontAwesomeIcon icon={faRotateRight} />
              <span className="object-editor-tooltip" role="tooltip">
                Redo
              </span>
            </button>
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            {viewportToggles.slice(2, 5).map((toggle) => (
              <button
                key={toggle.id}
                type="button"
                className={[
                  "object-editor-icon-toggle",
                  toggle.active ? "object-editor-icon-toggle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={toggle.label}
                aria-pressed={toggle.active}
                data-tooltip={toggle.label}
                disabled={toggle.disabled}
                onClick={toggle.onToggle}
              >
                <FontAwesomeIcon icon={toggle.icon} />
                <span className="object-editor-tooltip" role="tooltip">
                  {toggle.label}
                </span>
              </button>
            ))}
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            {viewportToggles.slice(5, 9).map((toggle) => (
              <button
                key={toggle.id}
                type="button"
                className={[
                  "object-editor-icon-toggle",
                  toggle.active ? "object-editor-icon-toggle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={toggle.label}
                aria-pressed={toggle.active}
                data-tooltip={toggle.label}
                disabled={toggle.disabled}
                onClick={toggle.onToggle}
              >
                <FontAwesomeIcon icon={toggle.icon} />
                <span className="object-editor-tooltip" role="tooltip">
                  {toggle.label}
                </span>
              </button>
            ))}
            <span className="object-editor-toolbar-divider" aria-hidden="true" />
            {viewportToggles.slice(9).map((toggle) => (
              <button
                key={toggle.id}
                type="button"
                className={[
                  "object-editor-icon-toggle",
                  toggle.active ? "object-editor-icon-toggle--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                aria-label={toggle.label}
                aria-pressed={toggle.active}
                data-tooltip={toggle.label}
                disabled={toggle.disabled}
                onClick={toggle.onToggle}
              >
                <FontAwesomeIcon icon={toggle.icon} />
                <span className="object-editor-tooltip" role="tooltip">
                  {toggle.label}
                </span>
              </button>
            ))}
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
        </section>

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

      </aside>
    </main>
  );
}
