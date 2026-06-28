import {
  Color3,
  FreeCamera,
  Matrix,
  Mesh,
  MeshBuilder,
  PointLight,
  Quaternion,
  Scene,
  StandardMaterial,
  Texture,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import { SceneLoader } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/loaders/glTF";
import { GE2_PLAYER_WEAPON_MODELS } from "@/lib/assets/ge2ImportedAssets";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import type {
  ViewWeaponPose,
  ViewWeaponTuning,
} from "@/lib/weapons/viewWeaponTuning";
import { createWeaponRoundDisplay } from "@/lib/weapons/weaponRoundDisplay";
import { createRifleReticleRoundOverlay } from "@/lib/weapons/rifleReticleRoundOverlay";
import { configureViewWeaponMesh } from "@/lib/lighting/configureViewWeaponMaterials";
import {
  DEFAULT_ROUND_DISPLAY_TUNING,
  resolveRoundDisplayPoseForWeapon,
  type RoundDisplayPoseMode,
  type RoundDisplayTuning,
} from "@/lib/weapons/weaponRoundDisplayTuning";

export type RoundDisplayPreview = {
  weapon: PrimaryWeaponId;
  mode: RoundDisplayPoseMode;
};

export type ViewWeaponUpdateOptions = {
  deltaSeconds: number;
  moveSpeed: number;
  aimTarget: number;
  tuning: ViewWeaponTuning;
  visible: boolean;
  roundDisplayTuning: RoundDisplayTuning;
  roundDisplayPreview?: RoundDisplayPreview | null;
  roundCount?: number;
  roundDisplayLow?: boolean;
  roundDisplayHp?: number;
  roundDisplayStamina?: number;
};

export type ViewWeapon = {
  root: TransformNode;
  shadowMeshes: Mesh[];
  setActiveWeapon: (weapon: PrimaryWeaponId) => void;
  flashMuzzle: () => void;
  getMuzzleWorld: (
    outPosition: Vector3,
    outDirection: Vector3,
    camera?: FreeCamera,
  ) => void;
  update: (camera: FreeCamera, options: ViewWeaponUpdateOptions) => void;
  dispose: () => void;
};

const FIT_PROFILES = {
  rifle: { targetLength: 0.62 },
  pistol: { targetLength: 0.36 },
} as const;

const AIM_BLEND_IN_SPEED = 22;
const AIM_BLEND_OUT_SPEED = 11;
const SWAY_ROT_STIFFNESS = 28;
const SWAY_ROT_DAMPING = 4.2;
const SWAY_ROT_KICK = 1.05;
const SWAY_POS_STIFFNESS = 32;
const SWAY_POS_DAMPING = 4.8;
const SWAY_POS_KICK = 0.038;
const BOB_LERP = 6.5;
const BOB_ACTIVITY_LERP = 3.2;
const BOB_POS_Y = 0.03;
const BOB_POS_X = 0.014;
const BOB_POS_Z = 0.009;
const BOB_ROLL = 0.022;
const IDLE_STILL_DELAY_SEC = 2;
const IDLE_STILL_SPEED = 0.35;
const IDLE_FADE_SPEED = 2.8;
const IDLE_BREATHE_FREQ = 0.4;
const IDLE_POS_Y = 0.0055;
const IDLE_POS_X = 0.0028;
const IDLE_POS_Z = 0.0016;
const IDLE_ROLL = 0.0045;
const IDLE_PITCH = 0.0022;
const WALK_SPEED = 5;
const WALK_FREQ_BASE = 1.65;
const WALK_FREQ_PER_SPEED = 0.38;
const ADS_SWAY_MULT = 0.22;
/** Hip-only body vs eye parallax (off when ADS). GE2 ViewWeapon.js */
const BODY_LEVEL_LOOK_UP_Y = 0.28;
const BODY_LEVEL_LOOK_UP_Z = 0.05;
const BODY_LEVEL_LOOK_DOWN_Y = 0.34;
const BODY_LEVEL_LOOK_DOWN_Z = 0.08;
const BODY_LOOK_RELEASE_SPEED = 4.5;
const DEFAULT_BODY_LOOK_UP_AMOUNT = 1.35;
const DEFAULT_BODY_LOOK_DOWN_AMOUNT = 1.35;
const BODY_LOOK_PITCH_LIMIT = Math.PI / 2 - 0.05;
const RETICLE_TEXTURE_URL = "/crosshair/gun-crosshair.png";
const MUZZLE_FLASH_DURATION_SEC = 0.06;

const VIEWMODEL_RENDERING_GROUP = 3;
export const VIEWMODEL_LAYER_MASK = 0x10000000;

type ReticlePose = {
  posX: number;
  posY: number;
  posZ: number;
  rotX: number;
  rotY: number;
  rotZ: number;
  planeWidth: number;
  planeHeight: number;
};

const RETICLE_HIP_POSE: ReticlePose = {
  posX: 0.271,
  posY: 0.558,
  posZ: -0.159,
  rotX: -0.1463,
  rotY: 0.5449,
  rotZ: -0.0331,
  planeWidth: 0.061,
  planeHeight: 0.0486,
};

const RETICLE_ADS_POSE: ReticlePose = {
  posX: 0.211,
  posY: 0.546,
  posZ: -0.284,
  rotX: -0.0134,
  rotY: 0.6274,
  rotZ: -0.0446,
  planeWidth: 0.0836,
  planeHeight: 0.0643,
};

function wrapAngle(delta: number): number {
  if (delta > Math.PI) return delta - Math.PI * 2;
  if (delta < -Math.PI) return delta + Math.PI * 2;
  return delta;
}

function springStep(
  value: number,
  velocity: number,
  stiffness: number,
  damping: number,
  dt: number,
): { value: number; velocity: number } {
  const nextVelocity = velocity + (-value * stiffness - velocity * damping) * dt;
  return {
    value: value + nextVelocity * dt,
    velocity: nextVelocity,
  };
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Track pitch when tilting in; ease only when returning toward the horizon. */
function blendParallaxScalar(
  current: number,
  target: number,
  dt: number,
  releaseSpeed: number,
): number {
  if (Math.abs(target) >= Math.abs(current)) {
    return target;
  }
  const ease = 1 - Math.exp(-releaseSpeed * dt);
  return current + (target - current) * ease;
}

function blendPose(
  hip: ViewWeaponPose,
  ads: ViewWeaponPose,
  t: number,
): ViewWeaponPose {
  if (t <= 0) return hip;
  if (t >= 1) return ads;
  return {
    posX: lerp(hip.posX, ads.posX, t),
    posY: lerp(hip.posY, ads.posY, t),
    posZ: lerp(hip.posZ, ads.posZ, t),
    rotX: lerp(hip.rotX, ads.rotX, t),
    rotY: lerp(hip.rotY, ads.rotY, t),
    rotZ: lerp(hip.rotZ, ads.rotZ, t),
    scale: lerp(hip.scale, ads.scale, t),
  };
}

function blendReticlePose(hip: ReticlePose, ads: ReticlePose, t: number): ReticlePose {
  if (t <= 0) return hip;
  if (t >= 1) return ads;
  return {
    posX: lerp(hip.posX, ads.posX, t),
    posY: lerp(hip.posY, ads.posY, t),
    posZ: lerp(hip.posZ, ads.posZ, t),
    rotX: lerp(hip.rotX, ads.rotX, t),
    rotY: lerp(hip.rotY, ads.rotY, t),
    rotZ: lerp(hip.rotZ, ads.rotZ, t),
    planeWidth: lerp(hip.planeWidth, ads.planeWidth, t),
    planeHeight: lerp(hip.planeHeight, ads.planeHeight, t),
  };
}

function fitModel(root: TransformNode, profile: PrimaryWeaponId) {
  root.computeWorldMatrix(true);
  const bounds = root.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const center = bounds.min.add(bounds.max).scale(0.5);
  root.position.subtractInPlace(center);
  if (size.x > 0.001) {
    root.scaling.scaleInPlace(FIT_PROFILES[profile].targetLength / size.x);
  }
}

function createRifleReticle(scene: Scene): Mesh {
  const texture = new Texture(RETICLE_TEXTURE_URL, scene, false, true);
  texture.hasAlpha = true;

  const material = new StandardMaterial("rifleReticleMaterial", scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;

  const mesh = MeshBuilder.CreatePlane("rifleReticle", { size: 1 }, scene);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = VIEWMODEL_RENDERING_GROUP;
  mesh.layerMask = VIEWMODEL_LAYER_MASK;
  mesh.rotationQuaternion = new Quaternion();
  return mesh;
}

function createMuzzleAnchor(
  scene: Scene,
  weaponRoot: TransformNode,
  weapon: PrimaryWeaponId,
): { anchor: TransformNode; flash: PointLight } {
  weaponRoot.computeWorldMatrix(true);
  const bounds = weaponRoot.getHierarchyBoundingVectors(true);
  const size = bounds.max.subtract(bounds.min);
  const center = bounds.min.add(bounds.max).scale(0.5);
  const anchor = new TransformNode(`${weapon}MuzzleAnchor`, scene);
  anchor.parent = weaponRoot;
  anchor.position.set(
    bounds.min.x - size.x * 0.04,
    center.y + (weapon === "rifle" ? size.y * 0.08 : size.y * 0.03),
    center.z,
  );

  const flash = new PointLight(`${weapon}MuzzleFlash`, Vector3.Zero(), scene);
  flash.parent = anchor;
  flash.diffuse = new Color3(0.33, 0.8, 1);
  flash.specular = new Color3(0.55, 0.9, 1);
  flash.intensity = 0;
  flash.range = 12;
  flash.includedOnlyMeshes = [];
  return { anchor, flash };
}

function prepareViewMesh(mesh: Mesh) {
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = VIEWMODEL_RENDERING_GROUP;
  mesh.layerMask = VIEWMODEL_LAYER_MASK;
  configureViewWeaponMesh(mesh);
}

async function loadWeaponModel(
  scene: Scene,
  weapon: PrimaryWeaponId,
  shadowMeshes: Mesh[],
): Promise<TransformNode> {
  const result = await SceneLoader.ImportMeshAsync(
    "",
    GE2_PLAYER_WEAPON_MODELS[weapon],
    "",
    scene,
  );
  const root = new TransformNode(`viewWeapon_${weapon}`, scene);
  for (const mesh of result.meshes) {
    if (mesh === result.meshes[0]) {
      continue;
    }
    mesh.parent = root;
    if (mesh instanceof Mesh) {
      prepareViewMesh(mesh);
      shadowMeshes.push(mesh);
    }
  }
  fitModel(root, weapon);
  root.scaling.x *= -1;
  root.setEnabled(false);
  return root;
}

export async function createViewWeapon(scene: Scene): Promise<ViewWeapon> {
  const root = new TransformNode("viewWeaponRoot", scene);
  const sway = new TransformNode("viewWeaponSway", scene);
  const pivot = new TransformNode("viewWeaponPivot", scene);
  sway.parent = root;
  pivot.parent = sway;

  const shadowMeshes: Mesh[] = [];
  const [rifle, pistol] = await Promise.all([
    loadWeaponModel(scene, "rifle", shadowMeshes),
    loadWeaponModel(scene, "pistol", shadowMeshes),
  ]);
  rifle.parent = pivot;
  pistol.parent = pivot;
  const rifleReticle = createRifleReticle(scene);
  rifleReticle.parent = sway;
  const rifleReticleRoundOverlay = createRifleReticleRoundOverlay(scene, rifleReticle);
  const rifleReticleAnchor = new TransformNode("rifleReticleAnchor", scene);
  rifleReticleAnchor.parent = rifle;
  const muzzleAnchors = {
    rifle: createMuzzleAnchor(scene, rifle, "rifle"),
    pistol: createMuzzleAnchor(scene, pistol, "pistol"),
  };

  const rifleRoundDisplay = createWeaponRoundDisplay(
    scene,
    sway,
    rifle,
    "rifle",
    DEFAULT_ROUND_DISPLAY_TUNING.rifle.hip,
  );
  const pistolRoundDisplay = createWeaponRoundDisplay(
    scene,
    sway,
    pistol,
    "pistol",
    DEFAULT_ROUND_DISPLAY_TUNING.pistol.hip,
  );

  let activeWeapon: PrimaryWeaponId = "rifle";
  let prevPitch = 0;
  let prevYaw = 0;
  let lookInitialized = false;
  let swayPitch = 0;
  let swayYaw = 0;
  let swayPitchVel = 0;
  let swayYawVel = 0;
  let swayPosX = 0;
  let swayPosY = 0;
  let swayPosXVel = 0;
  let swayPosYVel = 0;
  let bobPhase = 0;
  let bobActivity = 0;
  let smoothBobY = 0;
  let smoothBobX = 0;
  let smoothBobZ = 0;
  let smoothBobRoll = 0;
  let idleStillTime = 0;
  let idlePhase = 0;
  let idleBlend = 0;
  let aimBlend = 0;
  let smoothParallaxY = 0;
  let smoothParallaxZ = 0;
  let muzzleFlashTime = 0;

  const forward = new Vector3();
  const up = new Vector3();
  const right = new Vector3();
  const muzzleCameraForward = new Vector3();
  const cameraEuler = new Vector3();
  const reticleSwayInverse = new Matrix();
  const reticleLocalMatrix = new Matrix();
  const reticleLocalScale = new Vector3();
  const reticleLocalPosition = new Vector3();
  const reticleLocalRotation = rifleReticle.rotationQuaternion ?? new Quaternion();
  rifleReticle.rotationQuaternion = reticleLocalRotation;

  const setActiveWeapon = (weapon: PrimaryWeaponId) => {
    activeWeapon = weapon;
    rifle.setEnabled(weapon === "rifle");
    pistol.setEnabled(weapon === "pistol");
  };
  setActiveWeapon(activeWeapon);

  return {
    root,
    shadowMeshes,
    setActiveWeapon,
    flashMuzzle() {
      const active = muzzleAnchors[activeWeapon];
      active.flash.diffuse = new Color3(0.33, 0.8, 1);
      active.flash.specular = new Color3(0.55, 0.9, 1);
      active.flash.intensity = 5;
      muzzleFlashTime = MUZZLE_FLASH_DURATION_SEC;
    },
    getMuzzleWorld(outPosition, outDirection, camera) {
      const active = muzzleAnchors[activeWeapon];
      root.computeWorldMatrix(true);
      sway.computeWorldMatrix(true);
      pivot.computeWorldMatrix(true);
      active.anchor.computeWorldMatrix(true);
      outPosition.copyFrom(active.anchor.getAbsolutePosition());
      if (camera) {
        camera.getDirectionToRef(Vector3.Forward(), muzzleCameraForward);
        outDirection.copyFrom(muzzleCameraForward).normalize();
        return;
      }
      outDirection.set(0, 0, 1);
    },
    update(camera, options) {
      const {
        deltaSeconds,
        moveSpeed,
        aimTarget,
        tuning,
        visible,
        roundCount,
        roundDisplayLow = false,
        roundDisplayHp = 100,
        roundDisplayStamina = 1,
        roundDisplayTuning,
        roundDisplayPreview = null,
      } = options;
      root.setEnabled(visible);
      if (!visible || !camera.rotationQuaternion) {
        return;
      }
      if (muzzleFlashTime > 0) {
        muzzleFlashTime = Math.max(0, muzzleFlashTime - deltaSeconds);
        if (muzzleFlashTime <= 0) {
          muzzleAnchors.rifle.flash.intensity = 0;
          muzzleAnchors.pistol.flash.intensity = 0;
        }
      }

      const clampedAimTarget = Math.min(Math.max(aimTarget, 0), 1);
      const aimSpeed =
        clampedAimTarget > aimBlend ? AIM_BLEND_IN_SPEED : AIM_BLEND_OUT_SPEED;
      const aimEase = 1 - Math.exp(-aimSpeed * deltaSeconds);
      aimBlend += (clampedAimTarget - aimBlend) * aimEase;
      if (Math.abs(clampedAimTarget - aimBlend) < 0.001) {
        aimBlend = clampedAimTarget;
      }
      const bobSteady = 1 - aimBlend;
      const hipParallax = 1 - aimBlend;

      camera.rotationQuaternion.toEulerAnglesToRef(cameraEuler);
      const pitch = cameraEuler.x;
      // Camera pitch is negated vs gameCore; match GE2 PlayerController (up = positive).
      const pitchNorm = Math.max(
        -1,
        Math.min(1, -pitch / BODY_LOOK_PITCH_LIMIT),
      );

      let targetParallaxY = 0;
      let targetParallaxZ = 0;
      if (pitchNorm > 0) {
        targetParallaxY =
          pitchNorm *
          DEFAULT_BODY_LOOK_UP_AMOUNT *
          hipParallax *
          BODY_LEVEL_LOOK_UP_Y;
        targetParallaxZ =
          pitchNorm *
          DEFAULT_BODY_LOOK_UP_AMOUNT *
          hipParallax *
          BODY_LEVEL_LOOK_UP_Z;
      } else if (pitchNorm < 0) {
        const downBlend = -pitchNorm * DEFAULT_BODY_LOOK_DOWN_AMOUNT * hipParallax;
        targetParallaxY = downBlend * BODY_LEVEL_LOOK_DOWN_Y;
        targetParallaxZ = downBlend * BODY_LEVEL_LOOK_DOWN_Z;
      }

      smoothParallaxY = blendParallaxScalar(
        smoothParallaxY,
        targetParallaxY,
        deltaSeconds,
        BODY_LOOK_RELEASE_SPEED,
      );
      smoothParallaxZ = blendParallaxScalar(
        smoothParallaxZ,
        targetParallaxZ,
        deltaSeconds,
        BODY_LOOK_RELEASE_SPEED,
      );

      const yaw = cameraEuler.y;
      if (!lookInitialized) {
        prevPitch = pitch;
        prevYaw = yaw;
        lookInitialized = true;
      }
      const deltaPitch = wrapAngle(pitch - prevPitch);
      const deltaYaw = wrapAngle(yaw - prevYaw);
      prevPitch = pitch;
      prevYaw = yaw;

      const swayScale = lerp(1, ADS_SWAY_MULT, aimBlend);
      swayPitchVel += -deltaPitch * SWAY_ROT_KICK * aimBlend;
      swayYawVel += -deltaYaw * SWAY_ROT_KICK;
      swayPosXVel += -deltaYaw * SWAY_POS_KICK;
      swayPosYVel += deltaPitch * SWAY_POS_KICK * aimBlend;

      let spring = springStep(
        swayPitch,
        swayPitchVel,
        SWAY_ROT_STIFFNESS,
        SWAY_ROT_DAMPING,
        deltaSeconds,
      );
      swayPitch = spring.value;
      swayPitchVel = spring.velocity;
      spring = springStep(
        swayYaw,
        swayYawVel,
        SWAY_ROT_STIFFNESS,
        SWAY_ROT_DAMPING,
        deltaSeconds,
      );
      swayYaw = spring.value;
      swayYawVel = spring.velocity;
      spring = springStep(
        swayPosX,
        swayPosXVel,
        SWAY_POS_STIFFNESS,
        SWAY_POS_DAMPING,
        deltaSeconds,
      );
      swayPosX = spring.value;
      swayPosXVel = spring.velocity;
      spring = springStep(
        swayPosY,
        swayPosYVel,
        SWAY_POS_STIFFNESS,
        SWAY_POS_DAMPING,
        deltaSeconds,
      );
      swayPosY = spring.value;
      swayPosYVel = spring.velocity;

      const activityTarget = moveSpeed > IDLE_STILL_SPEED ? 1 : 0;
      bobActivity +=
        (activityTarget - bobActivity) *
        (1 - Math.exp(-BOB_ACTIVITY_LERP * deltaSeconds));
      const speedFactor = Math.min(moveSpeed / WALK_SPEED, 1.2);
      const bobIntensity = bobSteady * bobActivity * speedFactor;
      if (bobIntensity > 0.01) {
        bobPhase +=
          deltaSeconds *
          (WALK_FREQ_BASE + moveSpeed * WALK_FREQ_PER_SPEED) *
          Math.PI *
          2 *
          bobIntensity;
      } else if (aimBlend > 0.95) {
        bobPhase = 0;
      }

      const targetBobY = Math.sin(bobPhase) * BOB_POS_Y * bobIntensity;
      const targetBobX =
        Math.sin(bobPhase * 0.5 + Math.PI * 0.2) * BOB_POS_X * bobIntensity;
      const targetBobZ = Math.cos(bobPhase) * BOB_POS_Z * bobIntensity;
      const targetBobRoll = Math.sin(bobPhase * 0.5) * BOB_ROLL * bobIntensity;
      const bobEase = 1 - Math.exp(-BOB_LERP * (1 + aimBlend * 6) * deltaSeconds);
      smoothBobY += (targetBobY - smoothBobY) * bobEase;
      smoothBobX += (targetBobX - smoothBobX) * bobEase;
      smoothBobZ += (targetBobZ - smoothBobZ) * bobEase;
      smoothBobRoll += (targetBobRoll - smoothBobRoll) * bobEase;

      if (moveSpeed <= IDLE_STILL_SPEED) {
        idleStillTime += deltaSeconds;
      } else {
        idleStillTime = 0;
      }
      const idleTarget =
        idleStillTime >= IDLE_STILL_DELAY_SEC ? bobSteady : 0;
      idleBlend +=
        (idleTarget - idleBlend) *
        (1 - Math.exp(-IDLE_FADE_SPEED * deltaSeconds));
      idlePhase += deltaSeconds * IDLE_BREATHE_FREQ * Math.PI * 2;
      const idleY = Math.sin(idlePhase) * IDLE_POS_Y * idleBlend;
      const idleX = Math.sin(idlePhase * 0.62 + 0.35) * IDLE_POS_X * idleBlend;
      const idleZ = Math.cos(idlePhase * 0.48) * IDLE_POS_Z * idleBlend;
      const idleRoll = Math.sin(idlePhase * 0.78 + 1.05) * IDLE_ROLL * idleBlend;
      const idlePitch = Math.sin(idlePhase * 0.41 + 0.2) * IDLE_PITCH * idleBlend;

      root.rotationQuaternion = camera.rotationQuaternion.clone();
      root.position.copyFrom(camera.position);

      camera.getDirectionToRef(Vector3.Forward(), forward);
      camera.getDirectionToRef(Vector3.Up(), up);
      camera.getDirectionToRef(Vector3.Right(), right);

      const pose = blendPose(
        tuning[activeWeapon].hip,
        tuning[activeWeapon].ads,
        aimBlend,
      );
      const reticlePose = blendReticlePose(
        RETICLE_HIP_POSE,
        RETICLE_ADS_POSE,
        aimBlend,
      );
      root.position
        .addInPlace(right.scale(pose.posX))
        .addInPlace(up.scale(pose.posY))
        .addInPlace(forward.scale(-pose.posZ));

      const appliedParallaxY = smoothParallaxY * hipParallax;
      const appliedParallaxZ = smoothParallaxZ * hipParallax;
      if (
        Math.abs(appliedParallaxY) > 0.0001 ||
        Math.abs(appliedParallaxZ) > 0.0001
      ) {
        root.position.addInPlace(up.scale(-appliedParallaxY));
        root.position.addInPlace(forward.scale(-appliedParallaxZ));
      }

      pivot.position.set(0, 0, 0);
      pivot.rotation.set(pose.rotX, pose.rotY + Math.PI, pose.rotZ);
      pivot.scaling.setAll(pose.scale);
      sway.rotation.set(
        swayPitch * swayScale + smoothBobRoll * bobSteady + idleRoll + idlePitch,
        swayYaw * swayScale,
        0,
      );
      sway.position.set(
        swayPosX * swayScale + smoothBobX * bobSteady + idleX,
        swayPosY * swayScale + smoothBobY * bobSteady + idleY,
        smoothBobZ * bobSteady + idleZ,
      );
      rifleReticle.setEnabled(activeWeapon === "rifle");
      if (activeWeapon === "rifle") {
        rifleReticleAnchor.position.set(
          reticlePose.posX,
          reticlePose.posY,
          reticlePose.posZ,
        );
        rifleReticleAnchor.rotation.set(
          reticlePose.rotX,
          reticlePose.rotY,
          reticlePose.rotZ,
        );
        rifleReticleAnchor.scaling.setAll(1);
        rifleReticleAnchor.computeWorldMatrix(true);
        sway.computeWorldMatrix(true);
        sway.getWorldMatrix().invertToRef(reticleSwayInverse);
        rifleReticleAnchor
          .getWorldMatrix()
          .multiplyToRef(reticleSwayInverse, reticleLocalMatrix);
        reticleLocalMatrix.decompose(
          reticleLocalScale,
          reticleLocalRotation,
          reticleLocalPosition,
        );
        rifleReticle.position.copyFrom(reticleLocalPosition);
        rifleReticle.rotationQuaternion?.copyFrom(reticleLocalRotation);
        rifleReticle.scaling.set(
          reticlePose.planeWidth,
          reticlePose.planeHeight,
          1,
        );
        const rifleRoundCount =
          typeof roundCount === "number" ? roundCount : 80;
        rifleReticleRoundOverlay.setRoundCount(
          rifleRoundCount,
          roundDisplayLow,
          aimBlend,
          true,
        );
      } else {
        rifleReticleRoundOverlay.setRoundCount(0, false, 0, false);
      }

      const previewWeapon = roundDisplayPreview?.weapon ?? null;
      const showRifleRoundDisplay =
        activeWeapon === "rifle" || previewWeapon === "rifle";
      const showPistolRoundDisplay =
        activeWeapon === "pistol" || previewWeapon === "pistol";

      rifleRoundDisplay.mesh.setEnabled(showRifleRoundDisplay);
      pistolRoundDisplay.mesh.setEnabled(showPistolRoundDisplay);

      const riflePose = resolveRoundDisplayPoseForWeapon(
        "rifle",
        roundDisplayTuning,
        aimBlend,
        roundDisplayPreview,
      );
      const pistolPose = resolveRoundDisplayPoseForWeapon(
        "pistol",
        roundDisplayTuning,
        aimBlend,
        roundDisplayPreview,
      );

      if (showRifleRoundDisplay) {
        rifleRoundDisplay.syncPose(riflePose, sway);
      }
      if (showPistolRoundDisplay) {
        pistolRoundDisplay.syncPose(pistolPose, sway);
      }

      const activeRoundDisplay =
        activeWeapon === "pistol" ? pistolRoundDisplay : rifleRoundDisplay;
      const resolvedRoundCount =
        typeof roundCount === "number"
          ? roundCount
          : activeWeapon === "pistol"
            ? 12
            : 80;
      activeRoundDisplay.setCount(
        resolvedRoundCount,
        roundDisplayLow,
        roundDisplayHp,
        roundDisplayStamina,
      );
    },
    dispose() {
      rifleReticleRoundOverlay.dispose();
      rifleRoundDisplay.dispose();
      pistolRoundDisplay.dispose();
      root.dispose(false, true);
    },
  };
}
