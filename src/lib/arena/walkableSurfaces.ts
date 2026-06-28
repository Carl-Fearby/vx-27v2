import {
  CATWALK_DECK_THICKNESS,
  CATWALK_WEST_EDGE_X,
  WALL_HEIGHT,
  WALL_OUTER_EAST_X,
  WALL_OUTER_NORTH_Z,
  WALL_OUTER_SOUTH_Z,
} from "@/lib/wall/wallAssets";

/** Keep in sync with `rust/game_core/src/player.rs` `EYE_HEIGHT`. */
export const PLAYER_EYE_HEIGHT = 1.8;

export type WalkableSurfaceSpec = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  footY: number;
  honorFloorHoles: boolean;
  /** Deck overhead — only supports player near deck height (Rust `overhead_only`). */
  overheadOnly?: boolean;
};

export type JumpBlockSpec = {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
};

export function eyeHeightOnSurface(footY: number): number {
  return footY + PLAYER_EYE_HEIGHT;
}

export function jumpBlockSurface(block: JumpBlockSpec): WalkableSurfaceSpec {
  return {
    id: block.id,
    minX: block.centerX - block.width / 2,
    maxX: block.centerX + block.width / 2,
    minZ: block.centerZ - block.depth / 2,
    maxZ: block.centerZ + block.depth / 2,
    footY: block.height,
    honorFloorHoles: false,
  };
}

/** East-wall catwalk deck — matches `createEastWallCatwalk` geometry. */
export function getCatwalkSurface(): WalkableSurfaceSpec {
  const deckTopY = WALL_HEIGHT + CATWALK_DECK_THICKNESS;
  return {
    id: "catwalk",
    minX: CATWALK_WEST_EDGE_X,
    maxX: WALL_OUTER_EAST_X,
    minZ: WALL_OUTER_NORTH_Z,
    maxZ: WALL_OUTER_SOUTH_Z,
    footY: deckTopY,
    honorFloorHoles: false,
    overheadOnly: true,
  };
}

/** Southwest arena — clustered near debug spawn (~x -11, z -13). */
export const JUMP_BLOCKS: JumpBlockSpec[] = [
  {
    id: "jumpBlockLow",
    centerX: -14,
    centerZ: -15.5,
    width: 2,
    depth: 2,
    height: 0.5,
  },
  {
    id: "jumpBlockMid",
    centerX: -11.5,
    centerZ: -13,
    width: 2,
    depth: 2,
    height: 1,
  },
  {
    id: "jumpBlockHigh",
    centerX: -9,
    centerZ: -10.5,
    width: 2.5,
    depth: 2.5,
    height: 1.5,
  },
];

export function getAllWalkableSurfaces(): WalkableSurfaceSpec[] {
  return [getCatwalkSurface(), ...JUMP_BLOCKS.map(jumpBlockSurface)];
}
