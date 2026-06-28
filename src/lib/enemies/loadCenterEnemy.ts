import { Mesh, Scene, Vector3 } from "@babylonjs/core";
import {
  CENTER_ENEMY_HEIGHT_METERS,
  CENTER_ENEMY_MODEL_URL,
  CENTER_ENEMY_POSITION,
} from "@/lib/enemies/enemyAssets";
import {
  gltfRenderMeshes,
  loadGltfModel,
} from "@/lib/assets/loadGltfModel";
import {
  configureMeshForOutdoorLighting,
} from "@/lib/lighting/configureOutdoorMeshMaterials";

const MIN_MODEL_HEIGHT_METERS = 0.001;

/** Load a glTF enemy and stand it on the floor at the arena centre. */
export async function loadCenterEnemy(scene: Scene): Promise<Mesh[]> {
  const { root } = await loadGltfModel(
    scene,
    CENTER_ENEMY_MODEL_URL,
    "centerEnemy",
  );

  root.computeWorldMatrix(true);
  const unscaledBounds = root.getHierarchyBoundingVectors(true);
  const unscaledHeight = unscaledBounds.max.y - unscaledBounds.min.y;
  if (unscaledHeight > MIN_MODEL_HEIGHT_METERS) {
    const scale = CENTER_ENEMY_HEIGHT_METERS / unscaledHeight;
    root.scaling.scaleInPlace(scale);
    root.computeWorldMatrix(true);
  }

  const bounds = root.getHierarchyBoundingVectors(true);
  const center = bounds.min.add(bounds.max).scale(0.5);
  root.position = new Vector3(
    CENTER_ENEMY_POSITION.x - center.x,
    CENTER_ENEMY_POSITION.y - bounds.min.y,
    CENTER_ENEMY_POSITION.z - center.z,
  );

  const renderMeshes = gltfRenderMeshes(root);
  for (const mesh of renderMeshes) {
    configureMeshForOutdoorLighting(mesh);
    mesh.receiveShadows = true;
    mesh.isPickable = false;
  }

  return renderMeshes;
}
