import {
  Color3,
  Material,
  Mesh,
  MultiMaterial,
  PBRMaterial,
  StandardMaterial,
  TransformNode,
  type BaseTexture,
} from "@babylonjs/core";

export type ObjectEditorViewModes = {
  wireframe: boolean;
  lighting: boolean;
  texture: boolean;
};

const FLAT_COLOR = new Color3(0.58, 0.6, 0.64);

type MaterialSnapshot = {
  wireframe: boolean;
  albedoTexture: BaseTexture | null;
  diffuseTexture: BaseTexture | null;
  metallicTexture: BaseTexture | null;
  bumpTexture: BaseTexture | null;
  albedoColor: Color3;
  diffuseColor: Color3;
  unlit: boolean;
  disableLighting: boolean;
};

const materialSnapshots = new WeakMap<Material, MaterialSnapshot>();

function snapshotMaterial(material: Material): MaterialSnapshot {
  const existing = materialSnapshots.get(material);
  if (existing) {
    return existing;
  }

  let snap: MaterialSnapshot;
  if (material instanceof PBRMaterial) {
    snap = {
      wireframe: material.wireframe,
      albedoTexture: material.albedoTexture,
      diffuseTexture: null,
      metallicTexture: material.metallicTexture,
      bumpTexture: material.bumpTexture,
      albedoColor: material.albedoColor.clone(),
      diffuseColor: Color3.White(),
      unlit: material.unlit,
      disableLighting: false,
    };
  } else if (material instanceof StandardMaterial) {
    snap = {
      wireframe: material.wireframe,
      albedoTexture: null,
      diffuseTexture: material.diffuseTexture,
      metallicTexture: null,
      bumpTexture: material.bumpTexture ?? null,
      albedoColor: Color3.White(),
      diffuseColor: material.diffuseColor.clone(),
      unlit: false,
      disableLighting: material.disableLighting,
    };
  } else {
    snap = {
      wireframe: false,
      albedoTexture: null,
      diffuseTexture: null,
      metallicTexture: null,
      bumpTexture: null,
      albedoColor: FLAT_COLOR.clone(),
      diffuseColor: FLAT_COLOR.clone(),
      unlit: false,
      disableLighting: false,
    };
  }

  materialSnapshots.set(material, snap);
  return snap;
}

function applyMaterialModes(material: Material, modes: ObjectEditorViewModes): void {
  if (material instanceof MultiMaterial) {
    for (const subMaterial of material.subMaterials) {
      if (subMaterial) {
        applyMaterialModes(subMaterial, modes);
      }
    }
    return;
  }

  if (!(material instanceof PBRMaterial || material instanceof StandardMaterial)) {
    return;
  }

  const snap = snapshotMaterial(material);
  material.wireframe = modes.wireframe;

  if (material instanceof PBRMaterial) {
    material.unlit = !modes.lighting;
    if (modes.texture) {
      material.albedoTexture = snap.albedoTexture;
      material.metallicTexture = snap.metallicTexture;
      material.bumpTexture = snap.bumpTexture;
      material.albedoColor = snap.albedoColor.clone();
    } else {
      material.albedoTexture = null;
      material.metallicTexture = null;
      material.bumpTexture = null;
      material.albedoColor = FLAT_COLOR.clone();
    }
    return;
  }

  material.disableLighting = !modes.lighting;
  if (modes.texture) {
    material.diffuseTexture = snap.diffuseTexture;
    material.bumpTexture = snap.bumpTexture;
    material.diffuseColor = snap.diffuseColor.clone();
  } else {
    material.diffuseTexture = null;
    material.bumpTexture = null;
    material.diffuseColor = FLAT_COLOR.clone();
  }
}

export function applyObjectEditorViewModes(
  root: TransformNode,
  modes: ObjectEditorViewModes,
): void {
  for (const mesh of root.getChildMeshes(false)) {
    if (!(mesh instanceof Mesh) || !mesh.material) {
      continue;
    }
    applyMaterialModes(mesh.material, modes);
  }
}
