import { Mesh, MeshBuilder, PBRMaterial, Scene } from "@babylonjs/core";
import type { CatwalkRuntime, LevelRuntime } from "@/lib/level/types";

function createCatwalkBox(
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
  const mesh = MeshBuilder.CreateBox(name, { width, height, depth }, scene);
  mesh.position.set(centerX, centerY, centerZ);
  mesh.material = material;
  mesh.checkCollisions = false;
  mesh.receiveShadows = true;
  return mesh;
}

function createEastWallCatwalkFromRuntime(
  scene: Scene,
  deckMaterial: PBRMaterial,
  edgeMaterial: PBRMaterial,
  catwalk: CatwalkRuntime,
  wallHeight: number,
): Mesh[] {
  const westEdgeX = catwalk.westEdgeX;
  const eastEdgeX = catwalk.eastEdgeX;
  const deckWidth = eastEdgeX - westEdgeX;
  const deckBottomY = wallHeight;
  const deckTopY = deckBottomY + catwalk.deckThickness;
  const deckCenterY = deckBottomY + catwalk.deckThickness * 0.5;
  const deckCenterX = (westEdgeX + eastEdgeX) * 0.5;
  const deckCenterZ = (catwalk.northZ + catwalk.southZ) * 0.5;
  const railCenterY = deckTopY + catwalk.railHeight * 0.5;
  const railHalf = catwalk.railThickness * 0.5;
  const endRailWidth = deckWidth - catwalk.railThickness * 2;

  const deck = createCatwalkBox(
    scene,
    deckMaterial,
    "catwalkDeck",
    deckWidth,
    catwalk.deckThickness,
    catwalk.zSpan,
    deckCenterX,
    deckCenterY,
    deckCenterZ,
  );

  const railWest = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailWest",
    catwalk.railThickness,
    catwalk.railHeight,
    catwalk.zSpan,
    westEdgeX + railHalf,
    railCenterY,
    deckCenterZ,
  );

  const railEast = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailEast",
    catwalk.railThickness,
    catwalk.railHeight,
    catwalk.zSpan,
    eastEdgeX - railHalf,
    railCenterY,
    deckCenterZ,
  );

  const railNorth = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailNorth",
    endRailWidth,
    catwalk.railHeight,
    catwalk.railThickness,
    deckCenterX,
    railCenterY,
    catwalk.northZ + railHalf,
  );

  const railSouth = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailSouth",
    endRailWidth,
    catwalk.railHeight,
    catwalk.railThickness,
    deckCenterX,
    railCenterY,
    catwalk.southZ - railHalf,
  );

  return [deck, railWest, railEast, railNorth, railSouth];
}

export function createEastWallCatwalk(
  scene: Scene,
  deckMaterial: PBRMaterial,
  edgeMaterial: PBRMaterial,
  level: LevelRuntime,
): Mesh[] {
  if (!level.catwalk) {
    return [];
  }

  return createEastWallCatwalkFromRuntime(
    scene,
    deckMaterial,
    edgeMaterial,
    level.catwalk,
    level.wallHeight,
  );
}
