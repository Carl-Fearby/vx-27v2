/** GE2 LevelTextures: ground_concrete_asphalt_dirty @ 4m tile size. */
export const FLOOR_TEXTURE_ID = "ground_concrete_asphalt_dirty";
export const FLOOR_TEXTURE_ROOT = `/textures/${FLOOR_TEXTURE_ID}`;

export const FLOOR_PLATFORM_SIZE = 40;
export const FLOOR_TILE_WORLD_SIZE = 4;
/** Material albedo/normal UV scale — world-space floor UVs use `FLOOR_TILE_WORLD_SIZE`. */
export const FLOOR_UV_SCALE = 1.0;

/** Extruded deck depth (top y=0, bottom y=-depth). */
export const FLOOR_SLAB_DEPTH = 0.35;

/** GE2 MeshStandardMaterial — neutral albedo, no tint boost. */
export const FLOOR_ALBEDO_TINT = { r: 1, g: 1, b: 1 } as const;
/** GE2 LevelTextures NORMAL_SCALE. */
export const FLOOR_NORMAL_STRENGTH = 1.15;

export const FLOOR_PBR_MAPS = {
  albedo: `${FLOOR_TEXTURE_ROOT}/${FLOOR_TEXTURE_ID}_albedo_tileable.webp`,
  normal: `${FLOOR_TEXTURE_ROOT}/${FLOOR_TEXTURE_ID}_normal_placeholder.webp`,
  roughness: `${FLOOR_TEXTURE_ROOT}/${FLOOR_TEXTURE_ID}_roughness_placeholder.webp`,
} as const;

export const FLOOR_PRELOAD_URLS = Object.values(FLOOR_PBR_MAPS);
