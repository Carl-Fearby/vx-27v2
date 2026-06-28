import { Mesh, MeshBuilder, PBRMaterial, Scene } from "@babylonjs/core";
import {
  CATWALK_DECK_THICKNESS,
  CATWALK_RAIL_HEIGHT,
  CATWALK_RAIL_THICKNESS,
  CATWALK_WEST_EDGE_X,
  CATWALK_Z_SPAN,
  WALL_HEIGHT,
  WALL_OUTER_EAST_X,
  WALL_OUTER_NORTH_Z,
  WALL_OUTER_SOUTH_Z,
} from "@/lib/wall/wallAssets";

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

/**
 * Catwalk slab on top of the east wall (and north/south wall tops at the ends),
 * running the full outer north → south extent. Overhangs west 140% of the original 25% reach (35% of deck width).
 */
export function createEastWallCatwalk(
  scene: Scene,
  deckMaterial: PBRMaterial,
  edgeMaterial: PBRMaterial,
): Mesh[] {
  const westEdgeX = CATWALK_WEST_EDGE_X;
  const eastEdgeX = WALL_OUTER_EAST_X;
  const deckWidth = eastEdgeX - westEdgeX;
  const deckBottomY = WALL_HEIGHT;
  const deckTopY = deckBottomY + CATWALK_DECK_THICKNESS;
  const deckCenterY = deckBottomY + CATWALK_DECK_THICKNESS * 0.5;
  const deckCenterX = (westEdgeX + eastEdgeX) * 0.5;
  const deckCenterZ = (WALL_OUTER_NORTH_Z + WALL_OUTER_SOUTH_Z) * 0.5;
  const railCenterY = deckTopY + CATWALK_RAIL_HEIGHT * 0.5;
  const railHalf = CATWALK_RAIL_THICKNESS * 0.5;
  const endRailWidth = deckWidth - CATWALK_RAIL_THICKNESS * 2;

  const deck = createCatwalkBox(
    scene,
    deckMaterial,
    "catwalkDeck",
    deckWidth,
    CATWALK_DECK_THICKNESS,
    CATWALK_Z_SPAN,
    deckCenterX,
    deckCenterY,
    deckCenterZ,
  );

  const railWest = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailWest",
    CATWALK_RAIL_THICKNESS,
    CATWALK_RAIL_HEIGHT,
    CATWALK_Z_SPAN,
    westEdgeX + railHalf,
    railCenterY,
    deckCenterZ,
  );

  const railEast = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailEast",
    CATWALK_RAIL_THICKNESS,
    CATWALK_RAIL_HEIGHT,
    CATWALK_Z_SPAN,
    eastEdgeX - railHalf,
    railCenterY,
    deckCenterZ,
  );

  const railNorth = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailNorth",
    endRailWidth,
    CATWALK_RAIL_HEIGHT,
    CATWALK_RAIL_THICKNESS,
    deckCenterX,
    railCenterY,
    WALL_OUTER_NORTH_Z + railHalf,
  );

  const railSouth = createCatwalkBox(
    scene,
    edgeMaterial,
    "catwalkRailSouth",
    endRailWidth,
    CATWALK_RAIL_HEIGHT,
    CATWALK_RAIL_THICKNESS,
    deckCenterX,
    railCenterY,
    WALL_OUTER_SOUTH_Z - railHalf,
  );

  return [deck, railWest, railEast, railNorth, railSouth];
}
