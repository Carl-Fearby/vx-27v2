import {
  Engine,
  Material,
  Mesh,
  PBRMaterial,
  ShaderMaterial,
  TransformNode,
} from "@babylonjs/core";

import { OIL_INTERIOR_VIDEO_MESH_NAME } from "@/lib/oilBarrel/oilBarrelInteriorVideo";

const BARREL_OCCLUDER_MESH_NAMES = new Set([
  "oil_barrel_exterior",
  "oil_barrel_cap_top",
  "oil_barrel_cap_bottom",
]);

/** Interior meshes stay double-sided (GLB export) so the inner wall/floor remain visible. */
const BARREL_INTERIOR_MESH_NAMES = new Set([
  "oil_interior_wall",
  "oil_interior_bottom",
]);

function resolveBarrelRenderingGroupId(
  barrelRoot: TransformNode,
  renderingGroupId?: number,
): number {
  if (renderingGroupId != null) {
    return renderingGroupId;
  }
  const exterior = barrelRoot
    .getChildMeshes(false)
    .find((mesh) => mesh.name === "oil_barrel_exterior");
  return exterior?.renderingGroupId ?? 0;
}

function configureBarrelOccluderMesh(mesh: Mesh, renderingGroupId: number): void {
  mesh.renderingGroupId = renderingGroupId;
  const material = mesh.material;
  if (!material) {
    return;
  }
  material.disableDepthWrite = false;
  material.forceDepthWrite = true;
  material.depthFunction = Engine.LEQUAL;
  if (material instanceof PBRMaterial) {
    material.transparencyMode = Material.MATERIAL_OPAQUE;
  }
}

function configureBarrelInteriorMesh(mesh: Mesh, renderingGroupId: number): void {
  mesh.renderingGroupId = renderingGroupId;
  const material = mesh.material;
  if (!(material instanceof PBRMaterial)) {
    return;
  }
  // Preserve GLB doubleSided interior — BackSide-only culling hides the wall from above.
  material.backFaceCulling = false;
  material.twoSidedLighting = true;
}

function configureFireVideoMesh(mesh: Mesh, renderingGroupId: number): void {
  mesh.renderingGroupId = renderingGroupId;
  mesh.alphaIndex = 50;
  const material = mesh.material;
  if (!(material instanceof ShaderMaterial)) {
    return;
  }
  material.disableDepthWrite = true;
  material.forceDepthWrite = false;
  material.depthFunction = Engine.LEQUAL;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.alphaMode = Engine.ALPHA_PREMULTIPLIED;
  material.needDepthPrePass = false;
}

/**
 * Match GE2 OilBarrelInteriorVideo depth rules: barrel shell writes depth, fire reads it.
 * Fire must share the same rendering group as the exterior or the front wall won't occlude it.
 */
export function configureOilBarrelFireOcclusion(
  barrelRoot: TransformNode,
  videoMeshes: Mesh[],
  renderingGroupId?: number,
): void {
  const groupId = resolveBarrelRenderingGroupId(barrelRoot, renderingGroupId);

  for (const mesh of barrelRoot.getChildMeshes(false)) {
    if (!(mesh instanceof Mesh)) {
      continue;
    }
    if (BARREL_OCCLUDER_MESH_NAMES.has(mesh.name)) {
      configureBarrelOccluderMesh(mesh, groupId);
      continue;
    }
    if (BARREL_INTERIOR_MESH_NAMES.has(mesh.name)) {
      configureBarrelInteriorMesh(mesh, groupId);
    }
  }

  for (const mesh of videoMeshes) {
    if (mesh.name !== OIL_INTERIOR_VIDEO_MESH_NAME) {
      continue;
    }
    configureFireVideoMesh(mesh, groupId);
  }
}
