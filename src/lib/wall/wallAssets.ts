import { PILLAR_HEIGHT } from "@/lib/pillar/pillarAssets";
import { FLOOR_PLATFORM_SIZE } from "@/lib/floor/floorAssets";

/** Neutral native albedo — multiplied by material-edit brightness. */
export const WALL_ALBEDO_TINT = { r: 0.55, g: 0.55, b: 0.55 } as const;

/** Match arena pillar height (GE2 `wallHeight`). */
export const WALL_HEIGHT = PILLAR_HEIGHT;

/** GE2 level1 `wallThickness`. */
export const WALL_THICKNESS = 0.5;

export const WALL_PLATFORM_HALF = FLOOR_PLATFORM_SIZE / 2;
/** Match floor edge — corner chamfers fill the junction instead of overlapping past the deck. */
export const WALL_SPAN = FLOOR_PLATFORM_SIZE;

/** East-wall catwalk — west overhang as a fraction of deck width (base 25%, scaled to 140%). */
export const CATWALK_BASE_OVERHANG_FRACTION = 0.25;
export const CATWALK_OVERHANG_SCALE = 1.4;
export const CATWALK_OVERHANG_FRACTION =
  CATWALK_BASE_OVERHANG_FRACTION * CATWALK_OVERHANG_SCALE;
export const CATWALK_OVERHANG = FLOOR_PLATFORM_SIZE * CATWALK_OVERHANG_FRACTION;
export const CATWALK_WEST_EDGE_X = WALL_PLATFORM_HALF - CATWALK_OVERHANG;
/** Outer faces of the north/south perimeter walls. */
export const WALL_OUTER_NORTH_Z = -(WALL_PLATFORM_HALF + WALL_THICKNESS);
export const WALL_OUTER_SOUTH_Z = WALL_PLATFORM_HALF + WALL_THICKNESS;
/** Outer face of the east perimeter wall. */
export const WALL_OUTER_EAST_X = WALL_PLATFORM_HALF + WALL_THICKNESS;
/** Full run along the east wall, including north/south wall top thickness. */
export const CATWALK_Z_SPAN = WALL_OUTER_SOUTH_Z - WALL_OUTER_NORTH_Z;
export const CATWALK_DECK_THICKNESS = 0.22;
export const CATWALK_RAIL_THICKNESS = 0.07;
export const CATWALK_RAIL_HEIGHT = 0.9;

