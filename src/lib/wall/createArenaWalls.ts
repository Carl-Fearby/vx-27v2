import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
} from "@babylonjs/core";
import type { LevelRuntime } from "@/lib/level/types";

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
  return wall;
}

function createWallChamferCorner(
  scene: Scene,
  material: PBRMaterial,
  name: string,
  cornerX: number,
  cornerZ: number,
  centerY: number,
  wallHeight: number,
  wallThickness: number,
): Mesh {
  const size = wallThickness / Math.SQRT2;
  const corner = MeshBuilder.CreateBox(
    name,
    { width: size, height: wallHeight, depth: size },
    scene,
  );
  corner.position.set(cornerX, centerY, cornerZ);
  corner.rotation.y = Math.PI / 4;
  corner.material = material;
  corner.checkCollisions = true;
  corner.receiveShadows = true;
  return corner;
}

/** North, east, and south perimeter walls — west side stays open. GE2 arena convention. */
export function createArenaPerimeterWalls(
  scene: Scene,
  material: PBRMaterial,
  level: LevelRuntime,
): Mesh[] {
  const half = level.platformHalf;
  const thickness = level.wallThickness;
  const height = level.wallHeight;
  const span = level.wallSpan;
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
    ),
    createWallChamferCorner(
      scene,
      material,
      "wallCornerNE",
      cornerInset,
      -cornerInset,
      centerY,
      height,
      thickness,
    ),
    createWallChamferCorner(
      scene,
      material,
      "wallCornerSE",
      cornerInset,
      cornerInset,
      centerY,
      height,
      thickness,
    ),
  ];
}
