import {
  Color3,
  Material,
  Mesh,
  MultiMaterial,
  PBRMaterial,
  StandardMaterial,
} from "@babylonjs/core";

/** Match arena native PBR — hemi + sun + moon + two fill lights. */
export const OUTDOOR_MAX_SIMULTANEOUS_LIGHTS = 8;

export function configureMaterialForOutdoorLighting(material: Material): void {
  if (material instanceof MultiMaterial) {
    for (const subMaterial of material.subMaterials) {
      if (subMaterial) {
        configureMaterialForOutdoorLighting(subMaterial);
      }
    }
    return;
  }

  if (material instanceof PBRMaterial) {
    material.unlit = false;
    material.maxSimultaneousLights = OUTDOOR_MAX_SIMULTANEOUS_LIGHTS;
    material.environmentIntensity = 0;
    material.directIntensity = 1;
    material.emissiveColor = Color3.Black();
    material.emissiveIntensity = 0;
    material.emissiveTexture = null;
    return;
  }

  if (material instanceof StandardMaterial) {
    material.disableLighting = false;
    material.maxSimultaneousLights = OUTDOOR_MAX_SIMULTANEOUS_LIGHTS;
    material.emissiveColor = Color3.Black();
    material.emissiveTexture = null;
  }
}

export function configureMeshForOutdoorLighting(mesh: Mesh): void {
  if (mesh.material) {
    configureMaterialForOutdoorLighting(mesh.material);
  }
}

/** Walk a loaded model hierarchy and apply outdoor light/shadow material settings. */
export function configureHierarchyForOutdoorLighting(root: Mesh): Mesh[] {
  const childMeshes = root
    .getChildMeshes(false)
    .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
  const renderMeshes = childMeshes.length > 0 ? childMeshes : [root];

  for (const mesh of renderMeshes) {
    configureMeshForOutdoorLighting(mesh);
    mesh.receiveShadows = true;
  }

  return renderMeshes;
}
