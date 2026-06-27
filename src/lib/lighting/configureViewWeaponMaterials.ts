import {
  Constants,
  Material,
  Mesh,
  MultiMaterial,
  PBRMaterial,
  StandardMaterial,
  VertexBuffer,
} from "@babylonjs/core";
import { configureMeshForOutdoorLighting } from "@/lib/lighting/configureOutdoorMeshMaterials";

/** GE2 ViewWeapon.js — viewmodel never depth-tests against world (always on top). */
function configureViewWeaponMaterialDepth(material: Material): void {
  if (material instanceof MultiMaterial) {
    for (const subMaterial of material.subMaterials) {
      if (subMaterial) {
        configureViewWeaponMaterialDepth(subMaterial);
      }
    }
    return;
  }

  material.disableDepthWrite = true;
  material.depthFunction = Constants.ALWAYS;

  if (material instanceof PBRMaterial) {
    material.backFaceCulling = false;
  } else if (material instanceof StandardMaterial) {
    material.backFaceCulling = false;
  }
}

/** Mirrors GameEngine2 `ViewWeapon.js` `prepareViewMaterials` — receive sun/moon shadows, never cast. */
export function configureViewWeaponMesh(mesh: Mesh): void {
  if (!mesh.getVerticesData(VertexBuffer.NormalKind)) {
    mesh.createNormals(true);
  }

  configureMeshForOutdoorLighting(mesh);
  mesh.receiveShadows = true;

  if (mesh.material) {
    configureViewWeaponMaterialDepth(mesh.material);
  }
}

export function configureViewWeaponHierarchy(root: Mesh): Mesh[] {
  const childMeshes = root
    .getChildMeshes(false)
    .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
  const renderMeshes = childMeshes.length > 0 ? childMeshes : [root];

  for (const mesh of renderMeshes) {
    configureViewWeaponMesh(mesh);
  }

  return renderMeshes;
}
