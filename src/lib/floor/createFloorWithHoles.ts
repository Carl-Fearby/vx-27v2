import {
  CSG,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
} from "@babylonjs/core";
import {
  FLOOR_HOLES,
  type FloorHole,
} from "@/lib/floor/floorHoles";
import {
  FLOOR_PLATFORM_SIZE,
  FLOOR_SLAB_DEPTH,
} from "@/lib/floor/floorAssets";

const HOLE_WALL_TESSELATION = 64;

function subtractHoleFromSlab(
  scene: Scene,
  slab: Mesh,
  hole: FloorHole,
): Mesh {
  const cutter = MeshBuilder.CreateCylinder(
    `floor-hole-cut-${hole.x}-${hole.z}`,
    {
      height: FLOOR_SLAB_DEPTH + 0.08,
      diameter: hole.radius * 2,
      tessellation: HOLE_WALL_TESSELATION,
    },
    scene,
  );
  cutter.position = new Vector3(hole.x, -FLOOR_SLAB_DEPTH / 2, hole.z);

  const result = CSG.FromMesh(slab)
    .subtract(CSG.FromMesh(cutter))
    .toMesh(slab.name, slab.material, scene, true);

  cutter.dispose();
  slab.dispose();

  return result as Mesh;
}

/** Open cylinder sleeve — both faces rendered so the pit wall is always visible. */
function createHoleWallSleeve(
  scene: Scene,
  material: PBRMaterial,
  hole: FloorHole,
): Mesh {
  const wall = MeshBuilder.CreateCylinder(
    `floor-hole-wall-${hole.x}-${hole.z}`,
    {
      height: FLOOR_SLAB_DEPTH,
      diameter: hole.radius * 2,
      tessellation: HOLE_WALL_TESSELATION,
      cap: Mesh.NO_CAP,
      sideOrientation: Mesh.DOUBLESIDE,
    },
    scene,
  );
  wall.position = new Vector3(hole.x, -FLOOR_SLAB_DEPTH / 2, hole.z);
  wall.material = material;
  wall.isPickable = false;
  wall.checkCollisions = false;
  return wall;
}


/**
 * GE2-style arena deck: box slab (top y=0, bottom y=-depth) with circular holes
 * cut through, plus explicit double-sided hole wall sleeves.
 */
export function createFloorWithHoles(
  scene: Scene,
  material: PBRMaterial,
  holes: FloorHole[] = FLOOR_HOLES,
): Mesh {
  let slab = MeshBuilder.CreateBox(
    "platform-slab",
    {
      width: FLOOR_PLATFORM_SIZE,
      height: FLOOR_SLAB_DEPTH,
      depth: FLOOR_PLATFORM_SIZE,
    },
    scene,
  );
  slab.position.y = -FLOOR_SLAB_DEPTH / 2;
  slab.material = material;

  for (const hole of holes) {
    slab = subtractHoleFromSlab(scene, slab, hole);
  }

  const parts: Mesh[] = [slab];
  for (const hole of holes) {
    parts.push(createHoleWallSleeve(scene, material, hole));
  }

  const merged =
    parts.length === 1
      ? slab
      : Mesh.MergeMeshes(parts, true, true, undefined, false, true);

  if (!merged) {
    throw new Error("Failed to build floor mesh");
  }

  merged.name = "platform";
  merged.material = material;
  merged.checkCollisions = true;
  merged.receiveShadows = true;

  return merged;
}
