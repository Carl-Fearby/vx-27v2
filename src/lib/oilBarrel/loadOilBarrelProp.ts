import { Mesh, Scene, TransformNode, Vector3 } from "@babylonjs/core";

import {
  gltfRenderMeshes,
  loadGltfModel,
} from "@/lib/assets/loadGltfModel";
import {
  attachModelOverlays,
  getModelOverlayRuntime,
  setOilBarrelInteriorFire,
} from "@/lib/oilBarrel/attachModelOverlays";
import { configureOilBarrelFireOcclusion } from "@/lib/oilBarrel/oilBarrelFireOcclusion";
import { OIL_BARREL_MODEL_URL } from "@/lib/oilBarrel/oilBarrelAssets";
import { configureMeshForOutdoorLighting } from "@/lib/lighting/configureOutdoorMeshMaterials";

export type OilBarrelPlacement = {
  id: string;
  x: number;
  z: number;
  rotationY?: number;
  footY?: number;
  interiorFire?: boolean;
};

export async function loadOilBarrelProp(
  scene: Scene,
  placement: OilBarrelPlacement,
): Promise<{ root: TransformNode; meshes: Mesh[] }> {
  const { root } = await loadGltfModel(
    scene,
    OIL_BARREL_MODEL_URL,
    placement.id,
  );

  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const footY = placement.footY ?? 0;
  root.position = new Vector3(
    placement.x,
    footY - bounds.min.y,
    placement.z,
  );
  root.rotation.y = placement.rotationY ?? 0;

  const renderMeshes = gltfRenderMeshes(root);
  for (const mesh of renderMeshes) {
    configureMeshForOutdoorLighting(mesh);
    mesh.receiveShadows = true;
    mesh.checkCollisions = true;
    mesh.isPickable = false;
  }

  await attachModelOverlays(scene, root, OIL_BARREL_MODEL_URL);
  if (placement.interiorFire === false) {
    setOilBarrelInteriorFire(root, false);
  }

  const overlayRuntime = getModelOverlayRuntime(root);
  const videoMeshes = overlayRuntime?.videoMeshes ?? [];
  const barrelRoot = root.getChildTransformNodes(false).find((node) => node.name === "oil_barrel");
  if (barrelRoot) {
    configureOilBarrelFireOcclusion(barrelRoot, videoMeshes, 1);
  }

  return { root, meshes: [...renderMeshes, ...videoMeshes] };
}
