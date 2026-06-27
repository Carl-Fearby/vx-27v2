import {
  Mesh,
  MeshBuilder,
  PBRMaterial,
  Scene,
} from "@babylonjs/core";
import {
  WALL_HEIGHT,
  WALL_PLATFORM_HALF,
  WALL_SPAN,
  WALL_THICKNESS,
} from "@/lib/wall/wallAssets";

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
