import { Color3, Mesh, MeshBuilder, PBRMaterial, Scene } from "@babylonjs/core";
import { JUMP_BLOCKS, type JumpBlockSpec } from "@/lib/arena/walkableSurfaces";
import { configureMaterialForOutdoorLighting } from "@/lib/lighting/configureOutdoorMeshMaterials";

const JUMP_BLOCK_BLUE = new Color3(0.22, 0.48, 0.95);

function createJumpBlockMaterial(scene: Scene): PBRMaterial {
  const material = new PBRMaterial("jumpBlockMat", scene);
  material.albedoColor = JUMP_BLOCK_BLUE.clone();
  material.metallic = 0;
  material.roughness = 0.82;
  configureMaterialForOutdoorLighting(material);
  return material;
}

/** GE2 walk slabs — Rust resolves foot support; Babylon side faces trap the capsule. */
function createJumpBlock(
  scene: Scene,
  material: PBRMaterial,
  block: JumpBlockSpec,
): Mesh {
  const mesh = MeshBuilder.CreateBox(
    block.id,
    {
      width: block.width,
      height: block.height,
      depth: block.depth,
    },
    scene,
  );
  mesh.position.set(block.centerX, block.height / 2, block.centerZ);
  mesh.material = material;
  mesh.checkCollisions = false;
  mesh.receiveShadows = true;
  return mesh;
}

export function createJumpBlocks(scene: Scene): Mesh[] {
  const material = createJumpBlockMaterial(scene);
  return JUMP_BLOCKS.map((block) => createJumpBlock(scene, material, block));
}
