import type { FloorHole } from "@/lib/floor/floorHoles";

export type LevelMeta = {
  id: string;
  name: string;
  objective: string;
};

export type LevelPlayerSpawn = {
  x: number;
  z: number;
  footY: number;
  yaw: number;
};

export type LevelPillar = {
  x: number;
  z: number;
  height: number;
  diameter: number;
};

export type LevelCatwalk = {
  enabled: boolean;
  deckThickness: number;
  overhangFraction: number;
  railThickness: number;
  railHeight: number;
};

export type LevelJumpBlock = {
  id: string;
  centerX: number;
  centerZ: number;
  width: number;
  depth: number;
  height: number;
};

/** Authoring format — `public/levels/*.json`. */
export type LevelConfig = {
  meta: LevelMeta;
  size: number;
  wallHeight: number;
  wallThickness: number;
  floorFootY: number;
  floorSlabDepth: number;
  playerSpawn: LevelPlayerSpawn;
  floorHoles: FloorHole[];
  pillar: LevelPillar;
  catwalk: LevelCatwalk;
  jumpBlocks: LevelJumpBlock[];
};

export type WalkSurfaceSpec = {
  id: string;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  footY: number;
  honorFloorHoles: boolean;
  overheadOnly: boolean;
};

export type CatwalkRuntime = {
  westEdgeX: number;
  eastEdgeX: number;
  northZ: number;
  southZ: number;
  zSpan: number;
  deckThickness: number;
  deckFootY: number;
  railThickness: number;
  railHeight: number;
};

/** Derived geometry + gameplay surfaces for Babylon and WASM. */
export type LevelRuntime = {
  config: LevelConfig;
  meta: LevelMeta;
  platformSize: number;
  platformHalf: number;
  wallHeight: number;
  wallThickness: number;
  wallSpan: number;
  wallOuterNorthZ: number;
  wallOuterSouthZ: number;
  wallOuterEastX: number;
  floorFootY: number;
  floorSlabDepth: number;
  floorHoles: FloorHole[];
  playerSpawn: LevelPlayerSpawn;
  pillar: LevelPillar;
  catwalk: CatwalkRuntime | null;
  jumpBlocks: LevelJumpBlock[];
  walkSurfaces: WalkSurfaceSpec[];
};

/** Payload sent to Rust — derived from `LevelRuntime`, not authored directly. */
export type WorldPayload = {
  platformHalf: number;
  floorFootY: number;
  floorHoles: FloorHole[];
  playerSpawn: LevelPlayerSpawn;
  surfaces: Array<{
    minX: number;
    maxX: number;
    minZ: number;
    maxZ: number;
    footY: number;
    honorFloorHoles: boolean;
    overheadOnly: boolean;
  }>;
};
