import { Engine } from "@babylonjs/core/Engines/engine";
import {
  Color3,
  Color4,
  DirectionalLight,
  Effect,
  HemisphericLight,
  ImageProcessingConfiguration,
  Material,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  ShaderMaterial,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
  type AbstractMesh,
  type Camera,
  type Nullable,
} from "@babylonjs/core";

import {
  createMoonHaloTexture,
  createSunCoreTexture,
  createSunDiscTexture,
  createSunSpikeTexture,
} from "@/lib/lighting/celestialTextures";
import {
  computeSkyNightBlend,
  DAY_CLEAR_COLOR,
  DAY_FOG_FAR,
  DAY_FOG_NEAR,
  DAY_NIGHT_FADE_DURATION,
  DAY_TONE_EXPOSURE,
  kelvinToRgb,
  lerp,
  lerpColor,
  MOON_DISC_SIZE,
  MOON_TEXTURE_URL,
  NIGHT_CLEAR_COLOR,
  NIGHT_FOG_FAR,
  NIGHT_FOG_NEAR,
  NIGHT_SKY_LAT_OFFSET,
  NIGHT_TONE_EXPOSURE,
  positionFromAngles,
  SKY_DAY_URL,
  SKY_MESH_RADIUS,
  SKY_NIGHT_URL,
  smoothstep,
  SUN_BOWL_RADIUS,
  SUN_CORE_SIZE,
  SUN_DISC_SIZE,
  SUN_SPIKE_SIZE,
} from "@/lib/lighting/tuning";
import {
  loadOutdoorLightingTuning,
  type OutdoorLightingTuning,
} from "@/lib/lighting/outdoorLightingTuning";

import {
  setupOutdoorShadows,
  type OutdoorShadows,
} from "@/lib/lighting/setupOutdoorShadows";
import {
  setupOutdoorFillLights,
  type OutdoorFillLights,
} from "@/lib/lighting/createOutdoorFillLights";
import { resolveSunMoonShadowCasters } from "@/lib/lighting/applyOutdoorDayNight";
import { applyHemisphereSettings } from "@/lib/lighting/hemisphereSettings";
import {
  loadDevDayNightMode,
  saveDevDayNightMode,
} from "@/lib/lighting/devDayNightStorage";

export type { OutdoorShadows };

const SKY_SHADER = "vxSkyDome";

Effect.ShadersStore[`${SKY_SHADER}VertexShader`] = `
precision highp float;
attribute vec3 position;
uniform mat4 world;
uniform mat4 worldViewProjection;
varying vec3 vWorldPos;

void main(void) {
  vWorldPos = (world * vec4(position, 1.0)).xyz;
  gl_Position = worldViewProjection * vec4(position, 1.0);
}
`;

Effect.ShadersStore[`${SKY_SHADER}FragmentShader`] = `
precision highp float;
uniform sampler2D uDay;
uniform sampler2D uNight;
uniform float uNightBlend;
uniform float uNightLatOffset;
uniform float uRotation;
uniform float uBrightness;
uniform vec3 cameraPosition;
varying vec3 vWorldPos;

const float INV_TWO_PI = 0.15915494309189535;
const float INV_PI = 0.3183098861837907;

vec2 dirToEquirectUV(vec3 d) {
  float lon = atan(d.z, d.x);
  float lat = asin(clamp(d.y, -1.0, 1.0));
  return vec2(lon * INV_TWO_PI + 0.5, 1.0 - (lat * INV_PI + 0.5));
}

void main(void) {
  vec3 dir = normalize(vWorldPos - cameraPosition);
  float cosR = cos(uRotation);
  float sinR = sin(uRotation);
  dir = vec3(
    cosR * dir.x + sinR * dir.z,
    dir.y,
    -sinR * dir.x + cosR * dir.z
  );
  vec2 dayUV = dirToEquirectUV(dir);
  vec2 nightUV = vec2(dayUV.x, clamp(dayUV.y - uNightLatOffset, 0.0, 1.0));
  vec3 dayColor = texture2D(uDay, dayUV).rgb;
  vec3 nightColor = texture2D(uNight, nightUV).rgb;
  vec3 skyColor = mix(dayColor, nightColor, uNightBlend);
  gl_FragColor = vec4(skyColor * uBrightness, 1.0);
}
`;

import type { OutdoorLightRefs } from "@/lib/lighting/viewmodelLighting";

export type SkyTuningPreviewMode = "day" | "night" | null;

export type OutdoorSky = {
  root: TransformNode;
  update: (camera: Camera) => void;
  applyOutdoorTuning: (tuning: OutdoorLightingTuning) => void;
  tickDayNight: (deltaSeconds: number) => void;
  toggleDayNight: () => void;
  /** Snap to day/night for sky tuning tabs — null restores saved dev mode. */
  setTuningPreviewMode: (mode: SkyTuningPreviewMode) => void;
  isDay: () => boolean;
  getNightness: () => number;
  getSkyBlend: () => number;
  shadows: OutdoorShadows;
  outdoorLights: OutdoorLightRefs;
  /** Keep shadowless fill off vertical arena surfaces so wall-to-wall sun shadows read. */
  excludeMeshesFromFillLights: (meshes: AbstractMesh[]) => void;
  dispose: () => void;
};

function configureCelestialMesh(
  mesh: Mesh,
  material: Material,
  depthAlways = false,
) {
  mesh.isPickable = false;
  mesh.renderingGroupId = 0;
  mesh.applyFog = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.ignoreCameraMaxZ = true;
  mesh.cullingStrategy = Mesh.CULLINGSTRATEGY_OPTIMISTIC_INCLUSION;
  material.fogEnabled = false;
  material.disableDepthWrite = true;
  material.depthFunction = depthAlways ? Engine.ALWAYS : Engine.LEQUAL;
}

function configureSkyMesh(mesh: Mesh, material: Material) {
  configureCelestialMesh(mesh, material, true);
  mesh.hasVertexAlpha = false;
}

function createBillboard(
  name: string,
  texture: Texture,
  size: number,
  scene: Scene,
  parent: TransformNode,
  blend: "alpha" | "add" = "alpha",
  renderingGroupId = 0,
): Mesh {
  const mesh = MeshBuilder.CreatePlane(name, { size: 1 }, scene);
  mesh.parent = parent;
  mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
  mesh.scaling.set(size, size, 1);
  mesh.renderingGroupId = renderingGroupId;

  const material = new StandardMaterial(`${name}Mat`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.diffuseColor = new Color3(1, 1, 1);
  material.emissiveColor = new Color3(1, 1, 1);
  material.specularColor = Color3.Black();
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  material.alpha = 0;
  material.transparencyMode = Material.MATERIAL_ALPHABLEND;
  if (blend === "add") {
    material.alphaMode = Engine.ALPHA_ADD;
  }
  mesh.material = material;
  // LEQUAL — respect arena depth so sun discs don't bleed through walls.
  configureCelestialMesh(mesh, material, false);
  return mesh;
}

function placeCelestial(mesh: Mesh, worldPos: Nullable<Vector3>) {
  if (!worldPos) {
    mesh.isVisible = false;
    return;
  }
  mesh.position.copyFrom(worldPos.normalize().scale(SUN_BOWL_RADIUS));
  mesh.isVisible = true;
}

const moonOrientMatrix = Matrix.Identity();
const moonSphereQuat = new Quaternion();
const moonHaloQuat = new Quaternion();
const moonForward = new Vector3();
const moonRight = new Vector3();
const moonAdjUp = new Vector3();

function orientMoonToCamera(moonMesh: Mesh, moonHalo: Mesh) {
  if (moonMesh.position.lengthSquared() < 1e-6) {
    return;
  }

  moonMesh.position.normalizeToRef(moonForward).scaleInPlace(-1);

  moonRight.copyFromFloats(0, 1, 0);
  Vector3.CrossToRef(moonRight, moonForward, moonRight);
  if (moonRight.lengthSquared() < 1e-6) {
    moonRight.set(1, 0, 0);
  } else {
    moonRight.normalize();
  }

  Vector3.CrossToRef(moonForward, moonRight, moonAdjUp);
  moonAdjUp.normalize();

  // LROC near side sits on the sphere's local +X axis in Three.js.
  Matrix.FromXYZAxesToRef(moonForward, moonAdjUp, moonRight, moonOrientMatrix);
  Quaternion.FromRotationMatrixToRef(moonOrientMatrix, moonSphereQuat);
  if (!moonMesh.rotationQuaternion) {
    moonMesh.rotationQuaternion = moonSphereQuat.clone();
  } else {
    moonMesh.rotationQuaternion.copyFrom(moonSphereQuat);
  }

  // Halo plane normal aligns with the same moon-to-camera axis.
  Matrix.FromXYZAxesToRef(moonRight, moonAdjUp, moonForward, moonOrientMatrix);
  Quaternion.FromRotationMatrixToRef(moonOrientMatrix, moonHaloQuat);
  if (!moonHalo.rotationQuaternion) {
    moonHalo.rotationQuaternion = moonHaloQuat.clone();
  } else {
    moonHalo.rotationQuaternion.copyFrom(moonHaloQuat);
  }
}

async function loadSkyTexture(url: string, scene: Scene): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const texture = new Texture(
      url.includes("?") ? url : `${url}?v=seamless-v33-4k-webp`,
      scene,
      true,
      false,
      Texture.BILINEAR_SAMPLINGMODE,
      () => resolve(texture),
      (message) => reject(new Error(message ?? `Failed to load ${url}`)),
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.gammaSpace = true;
  });
}

async function loadMoonTexture(url: string, scene: Scene): Promise<Texture> {
  return new Promise((resolve, reject) => {
    const texture = new Texture(
      url,
      scene,
      true,
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
      () => resolve(texture),
      (message) => reject(new Error(message ?? `Failed to load ${url}`)),
    );
    texture.wrapU = Texture.WRAP_ADDRESSMODE;
    texture.wrapV = Texture.CLAMP_ADDRESSMODE;
    texture.gammaSpace = true;
  });
}

export async function createOutdoorSky(
  scene: Scene,
  camera: Camera,
): Promise<OutdoorSky> {
  const root = new TransformNode("skyRoot", scene);

  const [dayTexture, nightTexture, moonTexture] = await Promise.all([
    loadSkyTexture(SKY_DAY_URL, scene),
    loadSkyTexture(SKY_NIGHT_URL, scene),
    loadMoonTexture(MOON_TEXTURE_URL, scene),
  ]);

  const skyMesh = MeshBuilder.CreateSphere(
    "skyDome",
    {
      diameter: SKY_MESH_RADIUS * 2,
      segments: 64,
      sideOrientation: Mesh.BACKSIDE,
    },
    scene,
  );
  skyMesh.parent = root;

  const skyMaterial = new ShaderMaterial(
    "skyDomeMat",
    scene,
    { vertex: SKY_SHADER, fragment: SKY_SHADER },
    {
      attributes: ["position"],
      uniforms: [
        "world",
        "worldViewProjection",
        "cameraPosition",
        "uNightBlend",
        "uNightLatOffset",
        "uRotation",
        "uBrightness",
      ],
      samplers: ["uDay", "uNight"],
      needAlphaBlending: false,
    },
  );
  skyMaterial.backFaceCulling = false;
  skyMaterial.fogEnabled = false;
  skyMaterial.disableDepthWrite = true;
  skyMaterial.depthFunction = Engine.ALWAYS;
  skyMaterial.setTexture("uDay", dayTexture);
  skyMaterial.setTexture("uNight", nightTexture);
  skyMaterial.setFloat("uNightBlend", 0);
  skyMaterial.setFloat("uNightLatOffset", NIGHT_SKY_LAT_OFFSET);
  skyMaterial.setFloat("uRotation", 0);
  skyMaterial.setFloat("uBrightness", 1);
  skyMesh.material = skyMaterial;
  configureSkyMesh(skyMesh, skyMaterial);

  await skyMaterial.forceCompilationAsync(skyMesh);

  const sunSpikes = createBillboard(
    "skySunSpikes",
    createSunSpikeTexture(),
    SUN_SPIKE_SIZE,
    scene,
    root,
    "add",
    0,
  );
  const sunDisc = createBillboard(
    "skySun",
    createSunDiscTexture(),
    SUN_DISC_SIZE,
    scene,
    root,
    "add",
    1,
  );
  const sunCore = createBillboard(
    "skySunCore",
    createSunCoreTexture(),
    SUN_CORE_SIZE,
    scene,
    root,
    "add",
    2,
  );

  const moonMesh = MeshBuilder.CreateSphere(
    "skyMoon",
    { diameter: MOON_DISC_SIZE, segments: 32 },
    scene,
  );
  moonMesh.parent = root;
  const moonMaterial = new StandardMaterial("skyMoonMat", scene);
  moonMaterial.diffuseTexture = moonTexture;
  moonMaterial.diffuseColor = Color3.White();
  moonMaterial.emissiveTexture = moonTexture;
  moonMaterial.emissiveColor = Color3.White();
  moonMaterial.specularColor = Color3.Black();
  moonMaterial.disableLighting = true;
  moonMaterial.backFaceCulling = false;
  moonMaterial.alpha = 0;
  moonMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
  moonMesh.material = moonMaterial;
  configureCelestialMesh(moonMesh, moonMaterial);

  const moonHaloSize = MOON_DISC_SIZE * 1.4;
  const moonHalo = MeshBuilder.CreatePlane("skyMoonHalo", { size: 1 }, scene);
  moonHalo.parent = root;
  moonHalo.scaling.set(moonHaloSize, moonHaloSize, 1);
  const moonHaloTexture = createMoonHaloTexture();
  const moonHaloMaterial = new StandardMaterial("skyMoonHaloMat", scene);
  moonHaloMaterial.diffuseTexture = moonHaloTexture;
  moonHaloMaterial.emissiveTexture = moonHaloTexture;
  moonHaloMaterial.diffuseColor = Color3.White();
  moonHaloMaterial.emissiveColor = Color3.White();
  moonHaloMaterial.specularColor = Color3.Black();
  moonHaloMaterial.disableLighting = true;
  moonHaloMaterial.backFaceCulling = false;
  moonHaloMaterial.useAlphaFromDiffuseTexture = true;
  moonHaloMaterial.alpha = 0;
  moonHaloMaterial.transparencyMode = Material.MATERIAL_ALPHABLEND;
  moonHaloMaterial.alphaMode = Engine.ALPHA_ADD;
  moonHalo.material = moonHaloMaterial;
  configureCelestialMesh(moonHalo, moonHaloMaterial);

  const hemi = new HemisphericLight("hemiLight", new Vector3(0.2, 1, 0.1), scene);
  hemi.specular = Color3.Black();
  const sun = new DirectionalLight(
    "sunLight",
    new Vector3(-1, -1, -0.2),
    scene,
  );
  sun.intensity = 0;
  const moon = new DirectionalLight(
    "moonLight",
    new Vector3(1, -1, 0.5),
    scene,
  );
  moon.intensity = 0;

  const shadows = setupOutdoorShadows(scene, sun, moon, camera);
  const fillLights = setupOutdoorFillLights(scene);
  const outdoorLights: OutdoorLightRefs = {
    hemi,
    sun,
    moon,
    fill: fillLights.fill,
    westFill: fillLights.westFill,
  };

  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType =
    ImageProcessingConfiguration.TONEMAPPING_ACES;

  let isDayMode = loadDevDayNightMode();
  let targetNightness = isDayMode ? 0 : 1;
  let currentNightness = targetNightness;
  let currentSkyBlend = 0;
  let tuningPreviewMode: SkyTuningPreviewMode = null;
  let outdoorTuning = loadOutdoorLightingTuning();

  const resolveTargetNightness = () => {
    if (tuningPreviewMode === "day") {
      return 0;
    }
    if (tuningPreviewMode === "night") {
      return 1;
    }
    return isDayMode ? 0 : 1;
  };

  const initialSunRgb = kelvinToRgb(outdoorTuning.sunTemperature);
  sun.diffuse = new Color3(initialSunRgb.r, initialSunRgb.g, initialSunRgb.b);
  sun.specular = new Color3(initialSunRgb.r, initialSunRgb.g, initialSunRgb.b);
  const initialMoonRgb = kelvinToRgb(outdoorTuning.moonTemperature);
  moon.diffuse = new Color3(initialMoonRgb.r, initialMoonRgb.g, initialMoonRgb.b);
  moon.specular = new Color3(initialMoonRgb.r, initialMoonRgb.g, initialMoonRgb.b);

  const applyHemisphere = (nightness: number) => {
    const dayHemi = outdoorTuning.hemiDay;
    const nightHemi = outdoorTuning.hemiNight;
    applyHemisphereSettings(
      hemi,
      {
        temperature: lerp(dayHemi.temperature, nightHemi.temperature, nightness),
        intensity: lerp(dayHemi.intensity, nightHemi.intensity, nightness),
      },
      { sheltered: true },
    );
  };

  const applyAtmosphere = (nightness: number, skyBlend: number) => {
    const clear = lerpColor(DAY_CLEAR_COLOR, NIGHT_CLEAR_COLOR, nightness);
    scene.clearColor = new Color4(clear.r, clear.g, clear.b, 1);
    scene.fogMode = Scene.FOGMODE_LINEAR;
    scene.fogStart = lerp(DAY_FOG_NEAR, NIGHT_FOG_NEAR, nightness);
    scene.fogEnd = lerp(DAY_FOG_FAR, NIGHT_FOG_FAR, nightness);
    scene.fogColor = new Color3(clear.r, clear.g, clear.b);
    skyMaterial.setFloat("uNightBlend", skyBlend);
    scene.imageProcessingConfiguration.exposure = lerp(
      DAY_TONE_EXPOSURE,
      NIGHT_TONE_EXPOSURE,
      nightness,
    );
  };

  const setBillboardAlpha = (mesh: Mesh, opacity: number) => {
    const mat = mesh.material as StandardMaterial;
    mat.alpha = opacity;
  };

  const applyDayNight = (nightness: number) => {
    const sunElev = lerp(
      outdoorTuning.sunElevation,
      -outdoorTuning.sunElevation,
      nightness,
    );
    const moonElev = lerp(
      -outdoorTuning.moonElevation,
      outdoorTuning.moonElevation,
      nightness,
    );
    const sunPos = positionFromAngles(outdoorTuning.sunAzimuth, sunElev);
    const moonPos = positionFromAngles(outdoorTuning.moonAzimuth, moonElev);

    sun.position.set(sunPos.x, sunPos.y, sunPos.z);
    moon.position.set(moonPos.x, moonPos.y, moonPos.z);
    sun.direction = new Vector3(-sunPos.x, -sunPos.y, -sunPos.z).normalize();
    moon.direction = new Vector3(-moonPos.x, -moonPos.y, -moonPos.z).normalize();

    const sunFactor = smoothstep(-2, 5, sunElev);
    const moonFactor = smoothstep(-2, 5, moonElev);
    const skyBlend = computeSkyNightBlend(nightness, sunFactor, moonFactor);

    const sunRgb = kelvinToRgb(outdoorTuning.sunTemperature);
    sun.diffuse = new Color3(sunRgb.r, sunRgb.g, sunRgb.b);
    const rawSunIntensity = outdoorTuning.sunIntensity * sunFactor;
    const rawMoonIntensity = outdoorTuning.moonIntensity * moonFactor;
    const { sun: sunKeyOn, moon: moonKeyOn } = resolveSunMoonShadowCasters(
      rawSunIntensity,
      rawMoonIntensity,
    );

    sun.intensity = sunKeyOn ? rawSunIntensity : 0;
    sun.specular = sunKeyOn
      ? new Color3(sunRgb.r, sunRgb.g, sunRgb.b)
      : Color3.Black();

    const moonKelvin = kelvinToRgb(outdoorTuning.moonTemperature);
    const moonRgb = new Color3(moonKelvin.r, moonKelvin.g, moonKelvin.b);
    moon.diffuse = moonRgb;
    moon.intensity = moonKeyOn ? rawMoonIntensity : 0;
    moon.specular = moonKeyOn ? moonRgb : Color3.Black();

    fillLights.applyNightness(nightness, true);
    applyAtmosphere(nightness, skyBlend);
    applyHemisphere(nightness);

    const { sun: sunShadow, moon: moonShadow } = resolveSunMoonShadowCasters(
      rawSunIntensity,
      rawMoonIntensity,
    );
    shadows.applyDirectionalShadows(
      sunShadow,
      moonShadow,
      outdoorTuning.shadowDepth,
    );
    shadows.syncFrusta(sun, moon);

    const moonLit = moon.intensity > 0.001;

    currentSkyBlend = skyBlend;

    const sunVector = new Vector3(sunPos.x, sunPos.y, sunPos.z);
    const moonVector = new Vector3(moonPos.x, moonPos.y, moonPos.z);
    placeCelestial(sunSpikes, sunVector);
    placeCelestial(sunDisc, sunVector);
    placeCelestial(sunCore, sunVector);
    placeCelestial(moonMesh, moonVector);
    placeCelestial(moonHalo, moonVector);

    setBillboardAlpha(sunDisc, sunFactor);
    setBillboardAlpha(sunCore, sunFactor);
    setBillboardAlpha(sunSpikes, sunFactor * 0.6);
    sunSpikes.isVisible = sunFactor > 0.01;
    sunDisc.isVisible = sunFactor > 0.01;
    sunCore.isVisible = sunFactor > 0.01;

    moonMaterial.alpha = moonFactor;
    moonMesh.isVisible = moonLit;
    setBillboardAlpha(moonHalo, moonLit ? moonFactor * 0.28 : 0);
  };

  const snapDayNight = () => {
    targetNightness = resolveTargetNightness();
    currentNightness = targetNightness;
    applyDayNight(currentNightness);
  };

  applyDayNight(currentNightness);

  return {
    root,
    update(activeCamera) {
      root.position.copyFrom(activeCamera.position);
      if (moonMesh.isVisible) {
        orientMoonToCamera(moonMesh, moonHalo);
      }
    },
    applyOutdoorTuning(tuning) {
      outdoorTuning = tuning;
      applyDayNight(currentNightness);
    },
    tickDayNight(deltaSeconds) {
      targetNightness = resolveTargetNightness();
      if (tuningPreviewMode !== null) {
        if (currentNightness !== targetNightness) {
          currentNightness = targetNightness;
          applyDayNight(currentNightness);
        }
        return;
      }

      if (currentNightness < targetNightness) {
        currentNightness = Math.min(
          targetNightness,
          currentNightness + deltaSeconds / DAY_NIGHT_FADE_DURATION,
        );
      } else if (currentNightness > targetNightness) {
        currentNightness = Math.max(
          targetNightness,
          currentNightness - deltaSeconds / DAY_NIGHT_FADE_DURATION,
        );
      }
      applyDayNight(currentNightness);
    },
    toggleDayNight() {
      isDayMode = !isDayMode;
      if (tuningPreviewMode === null) {
        targetNightness = isDayMode ? 0 : 1;
      }
      saveDevDayNightMode(isDayMode);
    },
    setTuningPreviewMode(mode) {
      tuningPreviewMode = mode;
      snapDayNight();
    },
    isDay() {
      return isDayMode;
    },
    getNightness() {
      return currentNightness;
    },
    getSkyBlend() {
      return currentSkyBlend;
    },
    shadows,
    outdoorLights,
    excludeMeshesFromFillLights(meshes) {
      fillLights.excludeMeshesFromFill(meshes);
    },
    dispose() {
      shadows.dispose();
      fillLights.dispose();
      root.dispose();
      dayTexture.dispose();
      nightTexture.dispose();
      moonTexture.dispose();
      skyMaterial.dispose();
    },
  };
}
