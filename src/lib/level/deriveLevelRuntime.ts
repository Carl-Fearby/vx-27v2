import type {
  LevelConfig,
  LevelJumpBlock,
  LevelRuntime,
  WalkSurfaceSpec,
  WorldPayload,
} from "@/lib/level/types";

export const DEFAULT_LEVEL_ID = "square-arena";

export function levelJsonUrl(levelId = DEFAULT_LEVEL_ID): string {
  return `/levels/${levelId}.json`;
}

function jumpBlockSurface(block: LevelJumpBlock): WalkSurfaceSpec {
  return {
    id: block.id,
    minX: block.centerX - block.width / 2,
    maxX: block.centerX + block.width / 2,
    minZ: block.centerZ - block.depth / 2,
    maxZ: block.centerZ + block.depth / 2,
    footY: block.height,
    honorFloorHoles: false,
    overheadOnly: false,
  };
}

/** Turn authored level JSON into runtime geometry and walk surfaces. */
export function deriveLevelRuntime(config: LevelConfig): LevelRuntime {
  const platformHalf = config.size / 2;
  const wallOuterNorthZ = -(platformHalf + config.wallThickness);
  const wallOuterSouthZ = platformHalf + config.wallThickness;
  const wallOuterEastX = platformHalf + config.wallThickness;

  const walkSurfaces: WalkSurfaceSpec[] = [
    {
      id: "floor",
      minX: -platformHalf,
      maxX: platformHalf,
      minZ: -platformHalf,
      maxZ: platformHalf,
      footY: config.floorFootY,
      honorFloorHoles: true,
      overheadOnly: false,
    },
  ];

  let catwalk: LevelRuntime["catwalk"] = null;
  if (config.catwalk.enabled) {
    const westEdgeX = platformHalf - config.size * config.catwalk.overhangFraction;
    const deckFootY = config.wallHeight + config.catwalk.deckThickness;
    catwalk = {
      westEdgeX,
      eastEdgeX: wallOuterEastX,
      northZ: wallOuterNorthZ,
      southZ: wallOuterSouthZ,
      zSpan: wallOuterSouthZ - wallOuterNorthZ,
      deckThickness: config.catwalk.deckThickness,
      deckFootY,
      railThickness: config.catwalk.railThickness,
      railHeight: config.catwalk.railHeight,
    };
    walkSurfaces.push({
      id: "catwalk",
      minX: westEdgeX,
      maxX: wallOuterEastX,
      minZ: wallOuterNorthZ,
      maxZ: wallOuterSouthZ,
      footY: deckFootY,
      honorFloorHoles: false,
      overheadOnly: true,
    });
  }

  for (const block of config.jumpBlocks) {
    walkSurfaces.push(jumpBlockSurface(block));
  }

  return {
    config,
    meta: config.meta,
    platformSize: config.size,
    platformHalf,
    wallHeight: config.wallHeight,
    wallThickness: config.wallThickness,
    wallSpan: config.size,
    wallOuterNorthZ,
    wallOuterSouthZ,
    wallOuterEastX,
    floorFootY: config.floorFootY,
    floorSlabDepth: config.floorSlabDepth,
    floorHoles: config.floorHoles,
    playerSpawn: config.playerSpawn,
    pillar: config.pillar,
    catwalk,
    jumpBlocks: config.jumpBlocks,
    walkSurfaces,
  };
}

export function buildWorldPayload(runtime: LevelRuntime): WorldPayload {
  return {
    platformHalf: runtime.platformHalf,
    floorFootY: runtime.floorFootY,
    floorHoles: runtime.floorHoles,
    playerSpawn: runtime.playerSpawn,
    surfaces: runtime.walkSurfaces.map((surface) => ({
      minX: surface.minX,
      maxX: surface.maxX,
      minZ: surface.minZ,
      maxZ: surface.maxZ,
      footY: surface.footY,
      honorFloorHoles: surface.honorFloorHoles,
      overheadOnly: surface.overheadOnly,
    })),
  };
}

export function buildWorldPayloadJson(runtime: LevelRuntime): string {
  return JSON.stringify(buildWorldPayload(runtime));
}
