import {
  Material,
  PBRMaterial,
  StandardMaterial,
  Texture,
  type BaseTexture,
} from "@babylonjs/core";

export type MaterialUvTransform = {
  uvScaleU: number;
  uvScaleV: number;
  uvOffsetU: number;
  uvOffsetV: number;
};

function addTexture(
  textures: Texture[],
  seen: Set<Texture>,
  texture: BaseTexture | null | undefined,
): void {
  if (!(texture instanceof Texture) || seen.has(texture)) {
    return;
  }
  seen.add(texture);
  textures.push(texture);
}

/** All UV-transformable textures on a material (glTF often binds several per slot). */
export function collectMaterialTextures(material: Material | null): Texture[] {
  if (!material) {
    return [];
  }

  const textures: Texture[] = [];
  const seen = new Set<Texture>();

  if (material instanceof PBRMaterial) {
    addTexture(textures, seen, material.albedoTexture);
    addTexture(textures, seen, material.metallicTexture);
    addTexture(textures, seen, material.bumpTexture);
    addTexture(textures, seen, material.emissiveTexture);
    addTexture(textures, seen, material.opacityTexture);
    addTexture(textures, seen, material.lightmapTexture);
    addTexture(textures, seen, material.ambientTexture);
    addTexture(textures, seen, material.reflectionTexture);
    return textures;
  }

  if (material instanceof StandardMaterial) {
    addTexture(textures, seen, material.diffuseTexture);
    addTexture(textures, seen, material.bumpTexture);
    addTexture(textures, seen, material.emissiveTexture);
    addTexture(textures, seen, material.opacityTexture);
    addTexture(textures, seen, material.ambientTexture);
    addTexture(textures, seen, material.specularTexture);
  }

  return textures;
}

/** Primary texture used to read/write the UV sliders (prefers albedo/diffuse). */
export function primaryMaterialTexture(material: Material | null): Texture | null {
  if (!material) {
    return null;
  }

  if (material instanceof PBRMaterial) {
    return material.albedoTexture instanceof Texture
      ? material.albedoTexture
      : collectMaterialTextures(material)[0] ?? null;
  }

  if (material instanceof StandardMaterial) {
    return material.diffuseTexture instanceof Texture
      ? material.diffuseTexture
      : collectMaterialTextures(material)[0] ?? null;
  }

  return null;
}

export function readMaterialUvTransform(material: Material | null): MaterialUvTransform {
  const texture = primaryMaterialTexture(material);
  return {
    uvScaleU: texture?.uScale ?? 1,
    uvScaleV: texture?.vScale ?? 1,
    uvOffsetU: texture?.uOffset ?? 0,
    uvOffsetV: texture?.vOffset ?? 0,
  };
}

/** Apply UV transform to every texture slot so normal/MR/emissive stay aligned with albedo. */
export function applyMaterialUvTransform(
  material: Material | null,
  transform: MaterialUvTransform,
): void {
  for (const texture of collectMaterialTextures(material)) {
    texture.uScale = transform.uvScaleU;
    texture.vScale = transform.uvScaleV;
    texture.uOffset = transform.uvOffsetU;
    texture.vOffset = transform.uvOffsetV;
  }
}
