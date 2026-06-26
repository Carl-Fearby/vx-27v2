import { Vector3 } from "@babylonjs/core";

/** Babylon cubemap face corners (must match PanoramaToCubeMapTools). */
const FACE_CORNERS = {
  right: [
    new Vector3(1, -1, 1),
    new Vector3(-1, -1, 1),
    new Vector3(1, 1, 1),
    new Vector3(-1, 1, 1),
  ],
  left: [
    new Vector3(-1, -1, -1),
    new Vector3(1, -1, -1),
    new Vector3(-1, 1, -1),
    new Vector3(1, 1, -1),
  ],
  up: [
    new Vector3(-1, -1, -1),
    new Vector3(-1, -1, 1),
    new Vector3(1, -1, -1),
    new Vector3(1, -1, 1),
  ],
  down: [
    new Vector3(1, 1, -1),
    new Vector3(1, 1, 1),
    new Vector3(-1, 1, -1),
    new Vector3(-1, 1, 1),
  ],
  front: [
    new Vector3(1, -1, -1),
    new Vector3(1, -1, 1),
    new Vector3(1, 1, -1),
    new Vector3(1, 1, 1),
  ],
  back: [
    new Vector3(-1, -1, 1),
    new Vector3(-1, -1, -1),
    new Vector3(-1, 1, 1),
    new Vector3(-1, 1, -1),
  ],
} as const;

/** Must match EquiRectangularCubeTexture._FacesMapping. */
export const SKY_CUBE_FACE_ORDER = [
  "right",
  "left",
  "up",
  "down",
  "front",
  "back",
] as const;

/**
 * Same mapping as the vxSkyDome shader (atan2(z,x) + asin(y) with V flip).
 */
export function directionToSkyEquirectUv(
  x: number,
  y: number,
  z: number,
): [u: number, v: number] {
  const lon = Math.atan2(z, x);
  const lat = Math.asin(Math.max(-1, Math.min(1, y)));
  const u = lon / (2 * Math.PI) + 0.5;
  const v = 1.0 - (lat / Math.PI + 0.5);
  return [u, v];
}

export function directionToNightEquirectUv(
  x: number,
  y: number,
  z: number,
  nightLatOffset: number,
): [u: number, v: number] {
  const [u, v] = directionToSkyEquirectUv(x, y, z);
  return [u, Math.max(0, Math.min(1, v - nightLatOffset))];
}

/** PBR environment maps expect linear radiance; sky textures are sRGB. */
export function srgbChannelToLinear(channel: number): number {
  return channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4;
}

/**
 * Stars are tiny bright texels — they read as pinpoints on a glossy floor.
 * Soften only the night map used for floor IBL.
 */
export function softenNightEnvironmentHighlight(
  r: number,
  g: number,
  b: number,
  knee = 0.38,
): [r: number, g: number, b: number] {
  const lum = r * 0.2126 + g * 0.7152 + b * 0.0722;
  if (lum <= knee) {
    return [r, g, b];
  }
  const scale = knee / lum;
  return [r * scale, g * scale, b * scale];
}

function sampleEquirectBilinear(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  u: number,
  v: number,
  options: { softenNightStars?: boolean } = {},
): [r: number, g: number, b: number] {
  let uWrapped = u % 1;
  if (uWrapped < 0) {
    uWrapped += 1;
  }
  const vClamped = Math.max(0, Math.min(1, v));

  const fx = uWrapped * (width - 1);
  const fy = vClamped * (height - 1);
  const x0 = Math.floor(fx);
  const y0 = Math.floor(fy);
  const x1 = Math.min(x0 + 1, width - 1);
  const y1 = Math.min(y0 + 1, height - 1);
  const tx = fx - x0;
  const ty = fy - y0;

  const sample = (px: number, py: number) => {
    const idx = (py * width + px) * 4;
    return [data[idx], data[idx + 1], data[idx + 2]] as const;
  };

  const c00 = sample(x0, y0);
  const c10 = sample(x1, y0);
  const c01 = sample(x0, y1);
  const c11 = sample(x1, y1);

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  let r =
    lerp(lerp(c00[0], c10[0], tx), lerp(c01[0], c11[0], tx), ty) / 255;
  let g =
    lerp(lerp(c00[1], c10[1], tx), lerp(c01[1], c11[1], tx), ty) / 255;
  let b =
    lerp(lerp(c00[2], c10[2], tx), lerp(c01[2], c11[2], tx), ty) / 255;

  r = srgbChannelToLinear(r);
  g = srgbChannelToLinear(g);
  b = srgbChannelToLinear(b);

  if (options.softenNightStars) {
    [r, g, b] = softenNightEnvironmentHighlight(r, g, b);
  }

  return [r, g, b];
}

function buildCubeFace(
  imageData: ImageData,
  corners: readonly Vector3[],
  size: number,
  sampleDirection: (x: number, y: number, z: number) => [u: number, v: number],
  sampleOptions: { softenNightStars?: boolean } = {},
): Float32Array {
  const pixels = new Float32Array(size * size * 3);
  const rotDx1 = corners[1].subtract(corners[0]).scale(1 / size);
  const rotDx2 = corners[3].subtract(corners[2]).scale(1 / size);

  let fy = 0;
  for (let y = 0; y < size; y += 1) {
    let xv1 = corners[0].clone();
    let xv2 = corners[2].clone();
    for (let x = 0; x < size; x += 1) {
      const dir = xv2.subtract(xv1).scale(fy).add(xv1);
      dir.normalize();
      const [u, v] = sampleDirection(dir.x, dir.y, dir.z);
      const [r, g, b] = sampleEquirectBilinear(
        imageData.data,
        imageData.width,
        imageData.height,
        u,
        v,
        sampleOptions,
      );
      const offset = (y * size + x) * 3;
      pixels[offset] = r;
      pixels[offset + 1] = g;
      pixels[offset + 2] = b;
      xv1 = xv1.add(rotDx1);
      xv2 = xv2.add(rotDx2);
    }
    fy += 1 / size;
  }

  return pixels;
}

export function buildSkyMatchedCubemapFaces(
  imageData: ImageData,
  size: number,
  options: { nightLatOffset?: number; softenNightStars?: boolean } = {},
): Float32Array[] {
  const nightLatOffset = options.nightLatOffset ?? 0;
  const sampleDirection =
    nightLatOffset > 0
      ? (x: number, y: number, z: number) =>
          directionToNightEquirectUv(x, y, z, nightLatOffset)
      : directionToSkyEquirectUv;

  return SKY_CUBE_FACE_ORDER.map((faceName) =>
    buildCubeFace(
      imageData,
      FACE_CORNERS[faceName],
      size,
      sampleDirection,
      { softenNightStars: options.softenNightStars },
    ),
  );
}

export function blendCubemapFaces(
  dayFaces: Float32Array[],
  nightFaces: Float32Array[],
  nightBlend: number,
): Float32Array[] {
  if (nightBlend <= 0) {
    return dayFaces;
  }
  if (nightBlend >= 1) {
    return nightFaces;
  }

  return dayFaces.map((dayFace, faceIndex) => {
    const nightFace = nightFaces[faceIndex];
    const blended = new Float32Array(dayFace.length);
    for (let index = 0; index < dayFace.length; index += 1) {
      blended[index] =
        dayFace[index] + (nightFace[index] - dayFace[index]) * nightBlend;
    }
    return blended;
  });
}

export async function loadEquirectImageData(url: string): Promise<ImageData> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.crossOrigin = "anonymous";
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error(`Failed to load ${url}`));
    el.src = url;
  });

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(`Failed to read image data from ${url}`);
  }
  context.drawImage(image, 0, 0);
  return context.getImageData(0, 0, canvas.width, canvas.height);
}
