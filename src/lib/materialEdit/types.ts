export const EDITABLE_SURFACE_IDS = [
  "floor",
  "pillar",
  "wall",
  "catwalkDeck",
  "catwalkEdge",
] as const;

export type EditableSurfaceId = (typeof EDITABLE_SURFACE_IDS)[number];

export type SurfaceMaterialTuning = {
  /** Texture repeats on U — lower values = larger texture. */
  uvScaleU: number;
  /** Texture repeats on V — lower values = larger texture. */
  uvScaleV: number;
  roughness: number;
  metallic: number;
  /** Clear-coat layer strength (0–1). */
  shininess: number;
  clearCoatRoughness: number;
  specularIntensity: number;
  environmentIntensity: number;
  normalStrength: number;
  albedoBrightness: number;
};

export type SurfaceTuningState = Record<EditableSurfaceId, SurfaceMaterialTuning>;
