import {
  AbstractMesh,
  Mesh,
  Scene,
  TransformNode,
  type AnimationGroup,
} from "@babylonjs/core";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";

export type GltfLoadResult = {
  /** Parent this node into your scene graph. */
  root: TransformNode;
  /** Loader `__root__` node — keeps glTF right→left conversion (do not strip). */
  gltfRoot: TransformNode;
  meshes: AbstractMesh[];
  animationGroups: AnimationGroup[];
};

function wrapGltfImport(
  result: Awaited<ReturnType<typeof ImportMeshAsync>>,
  name: string,
  scene: Scene,
): GltfLoadResult {
  const gltfRoot = result.meshes[0] as TransformNode;
  gltfRoot.name = `${name}__gltfRoot`;

  const root = new TransformNode(name, scene);
  gltfRoot.parent = root;

  const meshes = result.meshes.filter((mesh) => mesh !== gltfRoot);

  return { root, gltfRoot, meshes, animationGroups: result.animationGroups };
}

export function gltfModelLoadUrl(
  url: string,
  cacheKey?: string | number,
): string {
  if (cacheKey === undefined || cacheKey === "") {
    return url;
  }
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${encodeURIComponent(String(cacheKey))}`;
}

/**
 * Load a glTF/GLB while preserving the loader root transform.
 * Do not reparent glTF children off `__root__`; that drops the axis fix and mirrors models.
 */
export async function loadGltfModel(
  scene: Scene,
  url: string,
  name: string,
  cacheKey?: string | number,
): Promise<GltfLoadResult> {
  const result = await ImportMeshAsync(gltfModelLoadUrl(url, cacheKey), scene);
  return wrapGltfImport(result, name, scene);
}

/** Load a GLB picked from the user's machine. */
export async function loadGltfModelFromFile(
  scene: Scene,
  file: File,
  name: string,
): Promise<GltfLoadResult> {
  const result = await ImportMeshAsync(file, scene, {
    pluginExtension: ".glb",
  });
  return wrapGltfImport(result, name, scene);
}

export function gltfRenderMeshes(root: TransformNode): Mesh[] {
  return root
    .getChildMeshes(false)
    .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
}
