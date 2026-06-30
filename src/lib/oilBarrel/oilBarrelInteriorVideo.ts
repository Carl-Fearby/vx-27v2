import {
  Effect,
  Engine,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Scene,
  ShaderMaterial,
  Texture,
  TransformNode,
  Vector3,
  VideoTexture,
  type AbstractMesh,
  type Camera,
  type Node,
} from "@babylonjs/core";

import { computeInteriorFlameLayout } from "@/lib/oilBarrel/oilBarrelFlameLayout";
import {
  normalizeFlameTexVRange,
  normalizeFireTopFadeRange,
  type OilBarrelFireTuning,
} from "@/lib/oilBarrel/oilBarrelTuning";
import type { OilBarrelFireVideoConfig } from "@/lib/oilBarrel/overlayPackage";

/** GE2 OilBarrelInteriorVideo.js — bump to bust material cache after shader edits. */
const INTERIOR_VIDEO_SHADER = "oilBarrelInteriorVideoGe2v4";
export const OIL_INTERIOR_VIDEO_MESH_NAME = "oil_interior_video";

Effect.ShadersStore[`${INTERIOR_VIDEO_SHADER}VertexShader`] = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
uniform mat4 world;
varying vec2 vUv;
varying vec3 vWorldPos;

void main(void) {
  // Babylon plane UV origin differs from Three PlaneGeometry — remap to GE2 (0=bottom, 1=top).
  vUv = vec2(uv.x, 1.0 - uv.y);
  vec4 worldPos = world * vec4(position, 1.0);
  vWorldPos = worldPos.xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

Effect.ShadersStore[`${INTERIOR_VIDEO_SHADER}FragmentShader`] = `
precision highp float;
uniform sampler2D uColorTex;
uniform sampler2D uAlphaTex;
uniform float clipRadius;
uniform float clipTopY;
uniform float sampleV0;
uniform float sampleV1;
uniform float topFadeStart;
uniform float topFadeEnd;
uniform mat4 barrelMatrixInverse;
varying vec2 vUv;
varying vec3 vWorldPos;

void main(void) {
  vec4 local = barrelMatrixInverse * vec4(vWorldPos, 1.0);
  float r = length(local.xz);
  if (local.y < clipTopY && r > clipRadius) discard;

  vec2 uv = vec2(vUv.x, mix(sampleV0, sampleV1, clamp(vUv.y, 0.0, 1.0)));

  vec3 rgb = texture2D(uColorTex, uv).rgb;
  float matte = texture2D(uAlphaTex, uv).r;
  float lum = dot(rgb, vec3(0.2126, 0.7152, 0.0722));
  float key = smoothstep(0.05, 0.2, lum);
  float blueSpill = smoothstep(0.12, 0.42, rgb.b - max(rgb.r, rgb.g));
  float alpha = matte * key * (1.0 - blueSpill * 0.92);

  // Plane height for fade: 0=bottom, 1=top (GE2). Vertex vUv.y is flipped for Babylon video sampling.
  float planeHeight = 1.0 - vUv.y;
  float topFade = 1.0 - smoothstep(topFadeStart, topFadeEnd, planeHeight);
  alpha *= topFade;

  if (alpha < 0.004) discard;
  rgb *= alpha;
  gl_FragColor = vec4(rgb, alpha);
}
`;

let loadPromise: Promise<void> | null = null;
let colorVideoTexture: VideoTexture | null = null;
let alphaVideoTexture: VideoTexture | null = null;
let cachedScene: Scene | null = null;

export function resetOilBarrelInteriorVideoCache(): void {
  if (colorVideoTexture) {
    try {
      colorVideoTexture.dispose();
    } catch {
      /* scene may already be disposed */
    }
    colorVideoTexture = null;
  }
  if (alphaVideoTexture) {
    try {
      alphaVideoTexture.dispose();
    } catch {
      /* scene may already be disposed */
    }
    alphaVideoTexture = null;
  }
  loadPromise = null;
  cachedScene = null;
}

function interiorVideoCacheMatchesScene(scene: Scene): boolean {
  return (
    cachedScene === scene &&
    !scene.isDisposed &&
    videoTextureIsLive(colorVideoTexture) &&
    videoTextureIsLive(alphaVideoTexture)
  );
}

function videoTextureIsLive(texture: VideoTexture | null): boolean {
  if (!texture) {
    return false;
  }
  try {
    const internalTexture = texture.getInternalTexture();
    return Boolean(internalTexture?.isReady);
  } catch {
    return false;
  }
}

export function resumeOilBarrelInteriorVideoPlayback(): void {
  for (const texture of [colorVideoTexture, alphaVideoTexture]) {
    if (!videoTextureIsLive(texture)) {
      continue;
    }
    const video = texture?.video as HTMLVideoElement | undefined;
    if (!video) {
      continue;
    }
    if (video.paused || video.ended) {
      void video.play().catch(() => {});
    }
  }
}

function makeLoopingVideo(url: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = url;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  return video;
}

function waitForVideo(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    if (video.readyState >= 2) {
      resolve();
      return;
    }
    video.addEventListener(
      "loadeddata",
      () => {
        resolve();
      },
      { once: true },
    );
    video.addEventListener(
      "error",
      () => {
        reject(new Error(`Failed to load oil barrel interior video (${video.src})`));
      },
      { once: true },
    );
    video.load();
  });
}

export async function ensureOilBarrelInteriorVideo(
  scene: Scene,
  videoConfig: OilBarrelFireVideoConfig,
): Promise<void> {
  if (scene.isDisposed) {
    return;
  }
  if (interiorVideoCacheMatchesScene(scene)) {
    resumeOilBarrelInteriorVideoPlayback();
    return;
  }

  resetOilBarrelInteriorVideoCache();
  cachedScene = scene;

  if (loadPromise) {
    await loadPromise;
    if (interiorVideoCacheMatchesScene(scene)) {
      resumeOilBarrelInteriorVideoPlayback();
      return;
    }
    if (cachedScene !== scene || scene.isDisposed) {
      return;
    }
  }

  loadPromise = (async () => {
    try {
      const colorVideo = makeLoopingVideo(videoConfig.color);
      const alphaVideo = makeLoopingVideo(videoConfig.alpha);
      await Promise.all([waitForVideo(colorVideo), waitForVideo(alphaVideo)]);

      if (scene.isDisposed || cachedScene !== scene) {
        return;
      }

      // invertY=true matches Three.js VideoTexture (GE2 default).
      colorVideoTexture = new VideoTexture(
        "oilBarrelInteriorColor",
        colorVideo,
        scene,
        false,
        true,
      );
      alphaVideoTexture = new VideoTexture(
        "oilBarrelInteriorAlpha",
        alphaVideo,
        scene,
        false,
        true,
      );

      colorVideoTexture.gammaSpace = true;
      alphaVideoTexture.gammaSpace = false;
      for (const tex of [colorVideoTexture, alphaVideoTexture]) {
        tex.wrapU = Texture.CLAMP_ADDRESSMODE;
        tex.wrapV = Texture.CLAMP_ADDRESSMODE;
      }
      colorVideo.play().catch(() => {});
      alphaVideo.play().catch(() => {});
    } catch (error) {
      resetOilBarrelInteriorVideoCache();
      throw error;
    } finally {
      loadPromise = null;
    }
  })();

  await loadPromise;
  resumeOilBarrelInteriorVideoPlayback();
}

function createInteriorVideoMaterial(
  scene: Scene,
  videoConfig: OilBarrelFireVideoConfig,
  innerRadius: number,
  clipTopY: number,
  tuning: OilBarrelFireTuning,
  materialSuffix: string,
): ShaderMaterial {
  const { sampleV0, sampleV1 } = normalizeFlameTexVRange(tuning);
  const material = new ShaderMaterial(
    `oilBarrelInteriorVideoMat_${materialSuffix}`,
    scene,
    { vertex: INTERIOR_VIDEO_SHADER, fragment: INTERIOR_VIDEO_SHADER },
    {
      attributes: ["position", "uv"],
      uniforms: [
        "world",
        "worldViewProjection",
        "clipRadius",
        "clipTopY",
        "sampleV0",
        "sampleV1",
        "topFadeStart",
        "topFadeEnd",
        "barrelMatrixInverse",
      ],
      samplers: ["uColorTex", "uAlphaTex"],
      needAlphaBlending: true,
    },
  );

  material.backFaceCulling = false;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  material.alphaMode = Engine.ALPHA_PREMULTIPLIED;
  material.disableDepthWrite = true;
  material.forceDepthWrite = false;
  material.depthFunction = Engine.LEQUAL;
  material.zOffset = -4;
  material.fogEnabled = false;
  material.needDepthPrePass = false;

  if (colorVideoTexture) {
    material.setTexture("uColorTex", colorVideoTexture);
  }
  if (alphaVideoTexture) {
    material.setTexture("uAlphaTex", alphaVideoTexture);
  }

  material.setFloat(
    "clipRadius",
    innerRadius * videoConfig.clipRadiusFactor,
  );
  material.setFloat("clipTopY", clipTopY);
  material.setFloat("sampleV0", sampleV0);
  material.setFloat("sampleV1", sampleV1);
  const { topFadeStart, topFadeEnd } = normalizeFireTopFadeRange(tuning);
  material.setFloat("topFadeStart", topFadeStart);
  material.setFloat("topFadeEnd", topFadeEnd);
  material.setMatrix("barrelMatrixInverse", Matrix.Identity());

  return material;
}

export async function createOilBarrelInteriorVideoMesh(
  scene: Scene,
  parent: TransformNode,
  videoConfig: OilBarrelFireVideoConfig,
  innerRadius: number,
  floorY: number,
  clipTopY: number,
  tuning: OilBarrelFireTuning,
): Promise<Mesh | null> {
  if (!tuning.interiorFire) {
    return null;
  }

  await ensureOilBarrelInteriorVideo(scene, videoConfig);
  resumeOilBarrelInteriorVideoPlayback();

  const layout = computeInteriorFlameLayout(
    innerRadius,
    floorY,
    clipTopY,
    tuning,
    videoConfig.aspect,
    videoConfig.floorLift,
  );

  const mesh = MeshBuilder.CreatePlane(
    OIL_INTERIOR_VIDEO_MESH_NAME,
    { width: layout.width, height: layout.height, sideOrientation: Mesh.DOUBLESIDE },
    scene,
  );
  mesh.parent = parent;
  mesh.position.set(layout.x, layout.y, layout.z);
  mesh.rotationQuaternion = null;
  mesh.rotation.set(0, 0, 0);
  mesh.isPickable = false;
  mesh.receiveShadows = false;

  const material = createInteriorVideoMaterial(
    scene,
    videoConfig,
    innerRadius,
    clipTopY,
    tuning,
    `${parent.uniqueId}-${Date.now()}`,
  );
  mesh.material = material;
  await material.forceCompilationAsync(mesh);
  resumeOilBarrelInteriorVideoPlayback();

  mesh.metadata = {
    ...mesh.metadata,
    isOilBarrelInteriorVideo: true,
    objectEditorExcludeFromMeasurements: true,
    innerRadius,
    floorY,
    clipTopY,
    baseVideoWidth: layout.width,
    baseVideoHeight: layout.height,
  };

  return mesh;
}

function applyInteriorVideoLayoutToMesh(
  mesh: Mesh,
  layout: ReturnType<typeof computeInteriorFlameLayout>,
): void {
  const baseWidth = mesh.metadata?.baseVideoWidth;
  const baseHeight = mesh.metadata?.baseVideoHeight;
  if (
    typeof baseWidth === "number" &&
    baseWidth > 0 &&
    typeof baseHeight === "number" &&
    baseHeight > 0
  ) {
    mesh.scaling.x = layout.width / baseWidth;
    mesh.scaling.y = layout.height / baseHeight;
  }
  mesh.position.set(layout.x, layout.y, layout.z);
}

export function refreshOilBarrelInteriorVideoLayout(
  mesh: Mesh,
  videoConfig: OilBarrelFireVideoConfig,
  innerRadius: number,
  floorY: number,
  clipTopY: number,
  tuning: OilBarrelFireTuning,
): void {
  const layout = computeInteriorFlameLayout(
    innerRadius,
    floorY,
    clipTopY,
    tuning,
    videoConfig.aspect,
    videoConfig.floorLift,
  );
  applyInteriorVideoLayoutToMesh(mesh, layout);
  applyOilBarrelInteriorVideoTuning([mesh], tuning);
}

export function applyOilBarrelInteriorVideoTuning(
  videoMeshes: Mesh[],
  tuning: OilBarrelFireTuning,
): void {
  const { sampleV0, sampleV1 } = normalizeFlameTexVRange(tuning);
  const { topFadeStart, topFadeEnd } = normalizeFireTopFadeRange(tuning);

  for (const mesh of videoMeshes) {
    const material = mesh.material as ShaderMaterial | null;
    if (!material) {
      continue;
    }
    material.setFloat("sampleV0", sampleV0);
    material.setFloat("sampleV1", sampleV1);
    material.setFloat("topFadeStart", topFadeStart);
    material.setFloat("topFadeEnd", topFadeEnd);
  }
}

function findOilBarrelRoot(node: AbstractMesh | TransformNode): TransformNode | null {
  let current: Node | null = node;
  while (current) {
    if (current instanceof TransformNode && current.name === "oil_barrel") {
      return current;
    }
    current = current.parent;
  }
  return null;
}

const _localCam = new Vector3();
const _barrelInverse = Matrix.Identity();

/** GE2 `billboardFireYawOnly` + barrelMatrixInverse update. */
export function tickOilBarrelInteriorVideo(
  camera: Camera,
  videoMeshes: Mesh[],
): void {
  for (const mesh of videoMeshes) {
    if (!mesh.isVisible) continue;

    const barrel = findOilBarrelRoot(mesh);
    if (!barrel) continue;

    barrel.computeWorldMatrix(true);
    barrel.getWorldMatrix().invertToRef(_barrelInverse);
    const material = mesh.material as ShaderMaterial | null;
    material?.setMatrix("barrelMatrixInverse", _barrelInverse);

    Vector3.TransformCoordinatesToRef(
      camera.position,
      _barrelInverse,
      _localCam,
    );
    mesh.rotationQuaternion = null;
    mesh.rotation.set(0, Math.atan2(_localCam.x, _localCam.z), 0);
  }
}

export function collectOilBarrelInteriorVideoMeshes(root: TransformNode): Mesh[] {
  return root
    .getChildMeshes(false, (mesh) => mesh.name === OIL_INTERIOR_VIDEO_MESH_NAME)
    .filter((mesh): mesh is Mesh => mesh instanceof Mesh);
}
