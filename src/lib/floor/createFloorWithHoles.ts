import {
  CSG,
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  Vector3,
  VertexBuffer,
} from "@babylonjs/core";
import {
  FLOOR_HOLES,
  type FloorHole,
} from "@/lib/floor/floorHoles";
import {
  FLOOR_PLATFORM_SIZE,
  FLOOR_SLAB_DEPTH,
  FLOOR_TILE_WORLD_SIZE,
} from "@/lib/floor/floorAssets";

const HOLE_WALL_TESSELATION = 64;
const HOLE_WALL_SURFACE_TOLERANCE = 0.08;

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
 * GE2 `FLOOR_WORLD_UV_GENERATOR` for Babylon — world X/Z in tile units on the deck,
 * arc/axis mapping on vertical walls. Pairs with material `uScale`/`vScale` of 1.0.
 */
function applyWorldSpaceFloorUvs(mesh: Mesh, holes: FloorHole[]): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals) {
    return;
  }

  const uvs = new Float32Array((positions.length / 3) * 2);
  const invTile = 1 / FLOOR_TILE_WORLD_SIZE;

  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    let u = 0;
    let v = 0;

    if (Math.abs(ny) > 0.5) {
      u = x * invTile;
      v = z * invTile;
    } else {
      v = (-y) * invTile;

      let mappedHoleWall = false;
      for (const hole of holes) {
        const dx = x - hole.x;
        const dz = z - hole.z;
        const dist = Math.hypot(dx, dz);
        if (Math.abs(dist - hole.radius) < HOLE_WALL_SURFACE_TOLERANCE) {
          const arc = (Math.atan2(dz, dx) + Math.PI) * hole.radius;
          u = arc * invTile;
          mappedHoleWall = true;
          break;
        }
      }

      if (!mappedHoleWall) {
        if (Math.abs(nx) > Math.abs(nz)) {
          u = z * invTile;
        } else {
          u = x * invTile;
        }
      }
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
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

  applyWorldSpaceFloorUvs(merged, holes);

  return merged;
}
