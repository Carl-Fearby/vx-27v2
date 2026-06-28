import type { Node, TransformNode } from "@babylonjs/core";
import { GLTF2Export } from "@babylonjs/serializers/glTF";
// Side-effect imports register glTF extensions (texture transform, emissive strength, etc.).
import "@babylonjs/serializers/glTF/2.0/Extensions/index";

function isDescendantOf(node: Node, root: TransformNode): boolean {
  let current: Node | null = node;
  while (current) {
    if (current === root) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

/** Export an object-editor model root (and descendants) to a GLB File. */
export async function exportTransformNodeToGlb(
  root: TransformNode,
  fileName: string,
): Promise<File> {
  const scene = root.getScene();
  if (!scene) {
    throw new Error("Model is not attached to a scene.");
  }

  const safeName = fileName.replace(/\.glb$/i, "") || "model";
  await scene.whenReadyAsync();
  const exportResult = await GLTF2Export.GLBAsync(scene, safeName, {
    shouldExportNode: (node) => isDescendantOf(node, root),
  });

  const blob = exportResult.files[`${safeName}.glb`];
  if (!(blob instanceof Blob)) {
    throw new Error("GLB export did not produce a binary file.");
  }

  return new File([blob], `${safeName}.glb`, {
    type: "model/gltf-binary",
  });
}
