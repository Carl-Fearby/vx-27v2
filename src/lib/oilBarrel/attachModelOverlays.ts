import {
  Scene,
  TransformNode,
  type Camera,
  type Mesh,
} from "@babylonjs/core";

import {
  addOilBarrelFireLight,
  collectOilBarrelFireLights,
  tickOilBarrelFireLights,
} from "@/lib/oilBarrel/oilBarrelFireLight";
import {
  collectOilBarrelInteriorVideoMeshes,
  createOilBarrelInteriorVideoMesh,
  tickOilBarrelInteriorVideo,
} from "@/lib/oilBarrel/oilBarrelInteriorVideo";
import {
  resolveOilBarrelOverlayDimensions,
} from "@/lib/oilBarrel/oilBarrelDimensions";
import { configureOilBarrelFireOcclusion } from "@/lib/oilBarrel/oilBarrelFireOcclusion";
import {
  OIL_BARREL_MODEL_URL,
  isOilBarrelModelPath,
} from "@/lib/oilBarrel/oilBarrelAssets";
import {
  loadModelOverlayPackage,
  resolveOilBarrelFireTuning,
  type OilBarrelFireOverlay,
} from "@/lib/oilBarrel/overlayPackage";

export type OilBarrelOverlayRuntime = {
  videoMeshes: Mesh[];
  fireLightsRoot: TransformNode | null;
};

const runtimeByRoot = new WeakMap<TransformNode, OilBarrelOverlayRuntime>();

function findNodeByName(root: TransformNode, name: string): TransformNode | null {
  if (root.name === name) {
    return root;
  }
  for (const child of root.getChildren(undefined, false)) {
    if (!(child instanceof TransformNode)) {
      continue;
    }
    const found = findNodeByName(child, name);
    if (found) {
      return found;
    }
  }
  return null;
}

function ensureBarrelFireFlickerSeed(barrel: TransformNode): number {
  const existing = barrel.metadata?.fireFlickerSeed;
  if (typeof existing === "number" && Number.isFinite(existing)) {
    return existing;
  }
  const seed = Math.random() * 1e6;
  barrel.metadata = {
    ...barrel.metadata,
    fireFlickerSeed: seed,
  };
  return seed;
}

async function attachOilBarrelFireOverlay(
  scene: Scene,
  modelRoot: TransformNode,
  overlay: OilBarrelFireOverlay,
): Promise<OilBarrelOverlayRuntime | null> {
  const barrelRoot = findNodeByName(modelRoot, overlay.attachToNode);
  if (!barrelRoot) {
    return null;
  }

  const tuning = resolveOilBarrelFireTuning(overlay);
  const dimensions = resolveOilBarrelOverlayDimensions(
    barrelRoot,
    overlay.dimensions,
  );
  const { innerRadius, floorY, clipTopY } = dimensions;
  const barrelSeed = ensureBarrelFireFlickerSeed(barrelRoot);
  const attachTuning = { ...tuning, interiorFire: true };

  barrelRoot.metadata = {
    ...barrelRoot.metadata,
    innerRadius,
    floorY,
    clipTopY,
    interiorFire: tuning.interiorFire !== false,
  };

  let videoMesh: Mesh | null = null;
  try {
    videoMesh = await createOilBarrelInteriorVideoMesh(
      scene,
      barrelRoot,
      overlay.video,
      innerRadius,
      floorY,
      clipTopY,
      attachTuning,
    );
  } catch {
    videoMesh = null;
  }

  const fireLightsRoot = addOilBarrelFireLight(
    scene,
    barrelRoot,
    innerRadius,
    floorY,
    clipTopY,
    attachTuning,
    barrelSeed,
  );

  const videoMeshes = videoMesh ? [videoMesh] : [];
  configureOilBarrelFireOcclusion(barrelRoot, videoMeshes);

  return {
    videoMeshes,
    fireLightsRoot,
  };
}

export async function attachModelOverlays(
  scene: Scene,
  modelRoot: TransformNode,
  modelPath: string,
): Promise<OilBarrelOverlayRuntime | null> {
  const overlayPackage = await loadModelOverlayPackage(modelPath);
  if (!overlayPackage?.overlays.length) {
    return null;
  }

  let runtime: OilBarrelOverlayRuntime = {
    videoMeshes: [],
    fireLightsRoot: null,
  };

  for (const overlay of overlayPackage.overlays) {
    if (overlay.type !== "oilBarrelFire") {
      continue;
    }
    const attached = await attachOilBarrelFireOverlay(scene, modelRoot, overlay);
    if (!attached) {
      continue;
    }
    runtime = {
      videoMeshes: [...runtime.videoMeshes, ...attached.videoMeshes],
      fireLightsRoot: attached.fireLightsRoot ?? runtime.fireLightsRoot,
    };
  }

  if (!runtime.videoMeshes.length && !runtime.fireLightsRoot) {
    return null;
  }

  runtimeByRoot.set(modelRoot, runtime);
  modelRoot.metadata = {
    ...modelRoot.metadata,
    overlayPackageId: overlayPackage.packageId,
  };

  const defaultFireOn = overlayPackage.overlays.some(
    (entry) =>
      entry.type === "oilBarrelFire" &&
      resolveOilBarrelFireTuning(entry).interiorFire !== false,
  );
  setOilBarrelInteriorFire(modelRoot, defaultFireOn);

  return runtime;
}

function findOilBarrelRoot(modelRoot: TransformNode): TransformNode | null {
  return findNodeByName(modelRoot, "oil_barrel");
}

export function modelHasOilBarrelFireOverlay(
  modelRoot: TransformNode | null | undefined,
): boolean {
  if (!modelRoot) {
    return false;
  }
  return runtimeByRoot.has(modelRoot);
}

export function resolveOilBarrelOverlayModelPath(modelPath: string): string {
  return isOilBarrelModelPath(modelPath) ? OIL_BARREL_MODEL_URL : modelPath;
}

export async function ensureOilBarrelFireOverlay(
  scene: Scene,
  modelRoot: TransformNode,
  modelPath: string,
): Promise<boolean> {
  if (modelHasOilBarrelFireOverlay(modelRoot)) {
    return true;
  }
  if (!isOilBarrelModelPath(modelPath)) {
    return false;
  }
  const attached = await attachModelOverlays(
    scene,
    modelRoot,
    resolveOilBarrelOverlayModelPath(modelPath),
  );
  return attached != null;
}

export async function applyOilBarrelInteriorFireSetting(
  scene: Scene,
  modelRoot: TransformNode,
  modelPath: string,
  enabled: boolean,
): Promise<boolean> {
  if (enabled && !(await ensureOilBarrelFireOverlay(scene, modelRoot, modelPath))) {
    return false;
  }
  if (modelHasOilBarrelFireOverlay(modelRoot)) {
    setOilBarrelInteriorFire(modelRoot, enabled);
  }
  return true;
}

export function getOilBarrelInteriorFire(
  modelRoot: TransformNode | null | undefined,
): boolean {
  const barrel = modelRoot ? findOilBarrelRoot(modelRoot) : null;
  return barrel?.metadata?.interiorFire !== false;
}

export function setOilBarrelInteriorFire(
  modelRoot: TransformNode,
  enabled: boolean,
): void {
  const barrel = findOilBarrelRoot(modelRoot);
  if (barrel) {
    barrel.metadata = {
      ...barrel.metadata,
      interiorFire: enabled,
    };
  }

  const runtime = runtimeByRoot.get(modelRoot);
  if (runtime) {
    for (const mesh of runtime.videoMeshes) {
      mesh.setEnabled(enabled);
      mesh.isVisible = enabled;
    }
    if (runtime.fireLightsRoot) {
      runtime.fireLightsRoot.setEnabled(enabled);
    }
    for (const light of collectOilBarrelFireLights(modelRoot)) {
      light.setEnabled(enabled);
    }
  }
}

export function getModelOverlayRuntime(
  modelRoot: TransformNode | null | undefined,
): OilBarrelOverlayRuntime | null {
  if (!modelRoot) {
    return null;
  }
  return runtimeByRoot.get(modelRoot) ?? null;
}

export function tickModelOverlays(
  modelRoot: TransformNode | null | undefined,
  camera: Camera,
  timeSec: number,
): void {
  if (!modelRoot) {
    return;
  }

  if (!getOilBarrelInteriorFire(modelRoot)) {
    return;
  }

  const runtime = runtimeByRoot.get(modelRoot);
  if (runtime) {
    tickOilBarrelInteriorVideo(camera, runtime.videoMeshes);
    tickOilBarrelFireLights(modelRoot, timeSec);
    return;
  }

  tickOilBarrelInteriorVideo(camera, collectOilBarrelInteriorVideoMeshes(modelRoot));
  tickOilBarrelFireLights(modelRoot, timeSec);
}

export function collectOilBarrelFirePositions(
  modelRoot: TransformNode | null | undefined,
): { x: number; y: number; z: number }[] {
  if (!modelRoot) {
    return [];
  }
  return collectOilBarrelFireLights(modelRoot).map((light) => {
    const position = light.getAbsolutePosition();
    return { x: position.x, y: position.y, z: position.z };
  });
}

export function tickOilBarrelOverlayRoots(
  modelRoots: TransformNode[],
  camera: Camera,
  timeSec: number,
): void {
  for (const root of modelRoots) {
    tickModelOverlays(root, camera, timeSec);
  }
}

export function collectOilBarrelFirePositionsFromRoots(
  modelRoots: TransformNode[],
): { x: number; y: number; z: number }[] {
  return modelRoots.flatMap((root) => collectOilBarrelFirePositions(root));
}
