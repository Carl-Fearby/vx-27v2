export const PILLAR_TEXTURE_ROOT = "/textures/pillar";

export const PILLAR_HEIGHT = 4;
export const PILLAR_DIAMETER = 2.4;
/** GameEngine2 `TEXTURE_TILE_SIZES.decal_hazard_stripes_worn`. */
export const PILLAR_TILE_SIZE = 2;
export const PILLAR_CIRCUMFERENCE = Math.PI * PILLAR_DIAMETER;
export const PILLAR_UV_U = PILLAR_CIRCUMFERENCE / PILLAR_TILE_SIZE;
export const PILLAR_UV_V = PILLAR_HEIGHT / PILLAR_TILE_SIZE;

export const PILLAR_PBR_MAPS = {
  albedo: `${PILLAR_TEXTURE_ROOT}/hazard_stripes_albedo.png`,
  normal: `${PILLAR_TEXTURE_ROOT}/hazard_stripes_normal.png`,
  roughness: `${PILLAR_TEXTURE_ROOT}/hazard_stripes_roughness.png`,
} as const;

export const PILLAR_PRELOAD_URLS = Object.values(PILLAR_PBR_MAPS);
