/** Catwalk deck — industrial grating / worn metal plate. */
export const CATWALK_DECK_TEXTURE_ID = "ground_concrete_asphalt_dirty";
export const CATWALK_DECK_TEXTURE_ROOT = `/textures/${CATWALK_DECK_TEXTURE_ID}`;
export const CATWALK_DECK_TILE_WORLD_SIZE = 2;

/** Catwalk parapet / edge rail — painted steel. */
export const CATWALK_EDGE_TEXTURE_ID = "wall_poured_concrete_industrial";
export const CATWALK_EDGE_TEXTURE_ROOT = `/textures/${CATWALK_EDGE_TEXTURE_ID}`;
export const CATWALK_EDGE_TILE_WORLD_SIZE = 1.5;

export const CATWALK_DECK_PBR_MAPS = {
  albedo: `${CATWALK_DECK_TEXTURE_ROOT}/${CATWALK_DECK_TEXTURE_ID}_albedo_tileable.webp`,
  normal: `${CATWALK_DECK_TEXTURE_ROOT}/${CATWALK_DECK_TEXTURE_ID}_normal_placeholder.webp`,
  roughness: `${CATWALK_DECK_TEXTURE_ROOT}/${CATWALK_DECK_TEXTURE_ID}_roughness_placeholder.webp`,
} as const;

export const CATWALK_EDGE_PBR_MAPS = {
  albedo: `${CATWALK_EDGE_TEXTURE_ROOT}/${CATWALK_EDGE_TEXTURE_ID}_albedo_tileable.webp`,
  normal: `${CATWALK_EDGE_TEXTURE_ROOT}/${CATWALK_EDGE_TEXTURE_ID}_normal_placeholder.webp`,
  roughness: `${CATWALK_EDGE_TEXTURE_ROOT}/${CATWALK_EDGE_TEXTURE_ID}_roughness_placeholder.webp`,
} as const;

export const CATWALK_NORMAL_STRENGTH = 1.1;
