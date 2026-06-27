import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
  VertexBuffer,
} from "@babylonjs/core";
import {
  WALL_HEIGHT,
  WALL_PLATFORM_HALF,
  WALL_SPAN,
  WALL_THICKNESS,
  WALL_TILE_WORLD_SIZE,
} from "@/lib/wall/wallAssets";

type WallOrientation = "northSouth" | "eastWest";

/**
 * GE2 `applyArenaWallUVs` / `applyCentredBoxWorldUVs` — world metres in tile units,
 * paired with material `uScale`/`vScale` of 1.
 */
function applyWallBoxWorldUvs(
  mesh: Mesh,
  orientation: WallOrientation,
  wallCenterX: number,
  wallCenterZ: number,
): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals) {
    return;
  }

  const half = WALL_PLATFORM_HALF;
  const span = WALL_SPAN;
  const thickness = WALL_THICKNESS;
  const invTile = 1 / WALL_TILE_WORLD_SIZE;
  const uvs = new Float32Array((positions.length / 3) * 2);

  const xMin = wallCenterX - thickness * 0.5;
  const xMax = wallCenterX + thickness * 0.5;
  const zMin = wallCenterZ - thickness * 0.5;
  const zMax = wallCenterZ + thickness * 0.5;

  for (let i = 0; i < positions.length / 3; i += 1) {
    const wx = positions[i * 3];
    const wy = positions[i * 3 + 1];
    const wz = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    let u = 0;
    let v = 0;

    if (orientation === "northSouth") {
      if (az >= ax && az >= ay) {
        u = (wx + half) * invTile;
        v = wy * invTile;
      } else if (ax >= ay && ax >= az) {
        u = (nx < 0 ? (xMax - wx) : (wx - xMin)) * invTile;
        v = wy * invTile;
      } else {
        u = (wx + half) * invTile;
        v = (ny < 0 ? (zMax - wz) : (wz - zMin)) * invTile;
      }
    } else if (az >= ax && az >= ay) {
      u = (nz < 0 ? (zMax - wz) : (wz - zMin)) * invTile;
      v = wy * invTile;
    } else if (ax >= ay && ax >= az) {
      u = (wz + half) * invTile;
      v = wy * invTile;
    } else {
      u = (wz + half) * invTile;
      v = (ny < 0 ? (xMax - wx) : (wx - xMin)) * invTile;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

function createWallBox(
  scene: Scene,
  material: PBRMaterial,
  name: string,
  width: number,
  height: number,
  depth: number,
  centerX: number,
  centerY: number,
  centerZ: number,
  orientation: WallOrientation,
): Mesh {
  const wall = MeshBuilder.CreateBox(
    name,
    { width, height, depth },
    scene,
  );
  wall.position.set(centerX, centerY, centerZ);
  wall.material = material;
  wall.checkCollisions = true;
  wall.receiveShadows = true;
  applyWallBoxWorldUvs(wall, orientation, centerX, centerZ);
  return wall;
}

/** 45° corner block where two perimeter walls meet — fills the exterior junction. */
function createWallChamferCorner(
  scene: Scene,
  material: PBRMaterial,
  name: string,
  cornerX: number,
  cornerZ: number,
  centerY: number,
): Mesh {
  const size = WALL_THICKNESS / Math.SQRT2;
  const corner = MeshBuilder.CreateBox(
    name,
    { width: size, height: WALL_HEIGHT, depth: size },
    scene,
  );
  corner.position.set(cornerX, centerY, cornerZ);
  corner.rotation.y = Math.PI / 4;
  corner.material = material;
  corner.checkCollisions = true;
  corner.receiveShadows = true;
  applyWallBoxWorldUvs(corner, "eastWest", cornerX, cornerZ);
  return corner;
}

/** North, east, and south perimeter walls — west side stays open. GE2 arena convention. */
export function createArenaPerimeterWalls(
  scene: Scene,
  material: PBRMaterial,
): Mesh[] {
  const half = WALL_PLATFORM_HALF;
  const thickness = WALL_THICKNESS;
  const height = WALL_HEIGHT;
  const span = WALL_SPAN;
  const centerY = height / 2;

  const northZ = -half - thickness / 2;
  const southZ = half + thickness / 2;
  const eastX = half + thickness / 2;
  const cornerInset = half + thickness / 2;

  return [
    createWallBox(
      scene,
      material,
      "wallNorth",
      span,
      height,
      thickness,
      0,
      centerY,
      northZ,
      "northSouth",
    ),
    createWallBox(
      scene,
      material,
      "wallEast",
      thickness,
      height,
      span,
      eastX,
      centerY,
      0,
      "eastWest",
    ),
    createWallBox(
      scene,
      material,
      "wallSouth",
      span,
      height,
      thickness,
      0,
      centerY,
      southZ,
      "northSouth",
    ),
    createWallChamferCorner(
      scene,
      material,
      "wallCornerNE",
      cornerInset,
      -cornerInset,
      centerY,
    ),
    createWallChamferCorner(
      scene,
      material,
      "wallCornerSE",
      cornerInset,
      cornerInset,
      centerY,
    ),
  ];
}
