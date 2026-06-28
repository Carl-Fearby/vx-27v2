"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  Color4,
  Engine,
  ImageProcessingConfiguration,
  FreeCamera,
  Mesh,
  MeshBuilder,
  PointerEventTypes,
  PBRMaterial,
  Quaternion,
  Ray,
  Scene,
  Vector3,
} from "@babylonjs/core";
import {
  createOutdoorSky,
  type OutdoorSky,
  type SkyTuningPreviewMode,
} from "@/lib/lighting/createOutdoorSky";
import {
  createViewmodelLighting,
  type ViewmodelLighting,
} from "@/lib/lighting/viewmodelLighting";
import { resolveViewmodelLightingZone } from "@/lib/lighting/lightingZones";
import { createPlayerFlashlight, type PlayerFlashlight } from "@/lib/lighting/createPlayerFlashlight";
import { createMotionBlur, type SceneMotionBlur } from "@/lib/postProcess/createMotionBlur";
import {
  createGameSoundManager,
  type GameSoundManager,
} from "@/lib/audio/soundManager";
import { createLaserTracerSystem, type LaserTracerSystem } from "@/lib/combat/laserTracers";
import { createTileableFloorMaterial } from "@/lib/floor/createTileableFloorMaterial";
import { createFloorWithHoles } from "@/lib/floor/createFloorWithHoles";
import DeathOverlay from "@/components/DeathOverlay";
import {
  FLOOR_ALBEDO_TINT,
} from "@/lib/floor/floorAssets";
import { DEATH_FADE_MS, DEATH_MIN_DISPLAY_MS } from "@/lib/floor/floorHoles";
import { createJumpBlocks } from "@/lib/arena/createJumpBlocks";
import { createIndustrialWallMaterial } from "@/lib/wall/createIndustrialWallMaterial";
import { createArenaPerimeterWalls } from "@/lib/wall/createArenaWalls";
import { createEastWallCatwalk } from "@/lib/wall/createEastWallCatwalk";
import { WALL_ALBEDO_TINT } from "@/lib/wall/wallAssets";
import {
  CATWALK_DECK_ALBEDO_TINT,
  CATWALK_EDGE_ALBEDO_TINT,
} from "@/lib/catwalk/catwalkAssets";
import {
  createCatwalkDeckMaterial,
  createCatwalkEdgeMaterial,
} from "@/lib/catwalk/createCatwalkMaterials";
import { createHazardPillarMaterial } from "@/lib/pillar/createHazardPillarMaterial";
import { loadCenterEnemy } from "@/lib/enemies/loadCenterEnemy";
import {
  createViewWeapon,
  type ViewWeapon,
} from "@/lib/weapons/createViewWeapon";
import { attachViewmodelOverlayPass } from "@/lib/weapons/viewmodelOverlayPass";
import type { LevelRuntime } from "@/lib/level/types";
import {
  PILLAR_ALBEDO_TINT,
} from "@/lib/pillar/pillarAssets";
import { createGameCore, type GameCoreInstance } from "@/lib/gameCore";
import {
  BINDING_ROWS,
  eventMatchesBinding,
  isBindingDown,
  syncGameCoreInput,
  type BindingAction,
  type KeyBindingsMap,
} from "@/lib/keyBindings";
import {
  applyFloorSurfaceTuning,
  applyPillarSurfaceTuning,
  applyWallSurfaceTuning,
  applyCatwalkDeckSurfaceTuning,
  applyCatwalkEdgeSurfaceTuning,
} from "@/lib/materialEdit/applySurfaceTuning";
import type {
  EditableSurfaceId,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";
import { pickEditableSurfaceAtPointer, tagEditableSurface } from "@/lib/scene/pickEditableSurface";
import type { OutdoorLightingTuning } from "@/lib/lighting/outdoorLightingTuning";
import type { FlashlightTuning } from "@/lib/lighting/flashlightTuning";
import type { MotionBlurTuning } from "@/lib/postProcess/motionBlurTuning";
import type { GameSettings } from "@/lib/settings";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import type { FireMode } from "@/lib/weapons/primaryWeapons";
import {
  DEFAULT_RECOIL_TUNING,
  resolveAdsRecoilScale,
  type RecoilTuning,
} from "@/lib/player/recoilTuning";
import type { ViewWeaponTuning } from "@/lib/weapons/viewWeaponTuning";
import type {
  RoundDisplayPoseMode,
  RoundDisplayTuning,
} from "@/lib/weapons/weaponRoundDisplayTuning";
import {
  safeExitPointerLock,
  safeRequestPointerLock,
  schedulePointerLockRecapture,
} from "@/lib/pointerLock";
import type { PlayerCoords } from "@/lib/playerCoords";
import {
  collisionTrimmedMove,
  createPlayerCollisionFootprintDebug,
  PLAYER_COLLISION_HALF_HEIGHT,
  PLAYER_COLLISION_RADIUS,
  playerFootY,
} from "@/lib/player/playerCollision";

type FpsSceneProps = Pick<
  GameSettings,
  | "invertLookX"
  | "invertLookY"
  | "mouseLookEase"
  | "keyboardLookEase"
  | "mouseLookSpeed"
  | "keyboardLookSpeed"
  | "maxLookRate"
  | "walkBobEnabled"
  | "walkBobAmplitudeCm"
  | "walkBobDurationSec"
  | "flyModeEnabled"
  | "showPlayerCollisionFootprint"
> & {
  bindings: KeyBindingsMap;
  outdoorTuning: OutdoorLightingTuning;
  flashlightTuning: FlashlightTuning;
  motionBlurTuning: MotionBlurTuning;
  viewWeaponTuning: ViewWeaponTuning;
  roundDisplayTuning: RoundDisplayTuning;
  recoilTuning: RecoilTuning;
  roundDisplayPreview?: { weapon: PrimaryWeaponId; mode: RoundDisplayPoseMode } | null;
  paused: boolean;
  pointerLockBlocked: boolean;
  materialEditMode: boolean;
  activePrimaryWeapon: PrimaryWeaponId;
  roundsInMag: number;
  activeLowAmmoThreshold: number;
  fireMode: FireMode;
  levelRuntime: LevelRuntime;
  surfaceTuning: SurfaceTuningState;
  onSurfacePick?: (surfaceId: EditableSurfaceId) => void;
  onToggleMaterialEditMode?: () => void;
  onPlayerCoords?: (coords: PlayerCoords) => void;
  onAimBlend?: (aimBlend: number) => void;
  onTryFirePrimary?: () => {
    weaponId: PrimaryWeaponId;
    roundsInMag: number;
    fireMode: FireMode;
  } | null;
  onReady?: () => void;
  skyPreviewModeRef?: React.MutableRefObject<
    ((mode: SkyTuningPreviewMode) => void) | null
  >;
};

function toMouseLookDelta(
  rawDx: number,
  rawDy: number,
  invertLookX: boolean,
  invertLookY: boolean,
): { dx: number; dy: number } {
  return {
    dx: invertLookX ? -rawDx : rawDx,
    // Browser +Y is down; the game uses +pitch for looking up.
    dy: invertLookY ? rawDy : -rawDy,
  };
}

function syncGameCoreSettings(
  gameCore: GameCoreInstance,
  settings: Pick<
    FpsSceneProps,
    | "invertLookX"
    | "invertLookY"
    | "mouseLookEase"
    | "keyboardLookEase"
    | "mouseLookSpeed"
    | "keyboardLookSpeed"
    | "maxLookRate"
    | "walkBobEnabled"
    | "walkBobAmplitudeCm"
    | "walkBobDurationSec"
  >,
) {
  gameCore.set_invert_look_x(settings.invertLookX);
  gameCore.set_invert_look_y(settings.invertLookY);
  gameCore.set_mouse_look_ease(settings.mouseLookEase);
  gameCore.set_keyboard_look_ease(settings.keyboardLookEase);
  gameCore.set_mouse_look_speed(settings.mouseLookSpeed);
  gameCore.set_keyboard_look_speed(settings.keyboardLookSpeed);
  gameCore.set_max_look_rate(settings.maxLookRate);
  gameCore.set_walk_bob_enabled(settings.walkBobEnabled);
  gameCore.set_walk_bob_amplitude_cm(settings.walkBobAmplitudeCm);
  gameCore.set_walk_bob_duration_sec(settings.walkBobDurationSec);
}

const PICK_DRAG_THRESHOLD_PX = 14;
/** Match GameEngine2 `HIP_FOV` — Babylon default ~46° feels much hotter than GE2 75°. */
const HIP_FOV_RADIANS = (75 * Math.PI) / 180;
const ADS_FOV_RADIANS = (41.6 * Math.PI) / 180;
const AIM_BLEND_IN_SPEED = 22;
const AIM_BLEND_OUT_SPEED = 11;
const FLY_SPEED = 10;
const FLY_FAST_SPEED = 28;
const LANDING_RAY_TOP = 120;
const LANDING_RAY_LENGTH = 260;
const WORLD_LAYER_MASK = 0x0fffffff;
const BULLET_MAX_RANGE = 80;
const BURST_SHOT_COUNT = 3;
const BURST_INTERVAL = 0.085;
const AUTO_FIRE_INTERVAL = 0.1;
const WALK_SPEED = 5;
const CROUCH_EYE_RATIO = 0.55;
const WALK_BOB_MIN_ACTIVITY_SPEED = 0.15;

const SCENE_BINDING_ACTIONS: BindingAction[] = BINDING_ROWS.map(
  (row) => row.id,
).filter((id) => id !== "openSettings");

function isSceneBindingCode(bindings: KeyBindingsMap, code: string): boolean {
  return SCENE_BINDING_ACTIONS.some((action) =>
    eventMatchesBinding(bindings, action, code),
  );
}

function syncFlyLookInput(
  gameCore: GameCoreInstance,
  bindings: KeyBindingsMap,
  pressed: ReadonlySet<string>,
) {
  gameCore.set_input(
    false,
    false,
    false,
    false,
    isBindingDown(bindings, "lookUp", pressed),
    isBindingDown(bindings, "lookDown", pressed),
    isBindingDown(bindings, "lookLeft", pressed),
    isBindingDown(bindings, "lookRight", pressed),
    false,
    false,
    false,
  );
}

function updateFlyPosition(
  camera: FreeCamera,
  flyPosition: Vector3,
  bindings: KeyBindingsMap,
  pressed: ReadonlySet<string>,
  deltaSeconds: number,
  scratch: {
    move: Vector3;
    forward: Vector3;
    right: Vector3;
  },
) {
  const speed = isBindingDown(bindings, "sprint", pressed)
    ? FLY_FAST_SPEED
    : FLY_SPEED;

  camera.getDirectionToRef(Vector3.Forward(), scratch.forward);
  camera.getDirectionToRef(Vector3.Right(), scratch.right);
  scratch.move.set(0, 0, 0);

  if (isBindingDown(bindings, "forward", pressed)) {
    scratch.move.addInPlace(scratch.forward);
  }
  if (isBindingDown(bindings, "backward", pressed)) {
    scratch.move.subtractInPlace(scratch.forward);
  }
  if (isBindingDown(bindings, "strafeRight", pressed)) {
    scratch.move.addInPlace(scratch.right);
  }
  if (isBindingDown(bindings, "strafeLeft", pressed)) {
    scratch.move.subtractInPlace(scratch.right);
  }
  if (isBindingDown(bindings, "jump", pressed)) {
    scratch.move.y += 1;
  }
  if (isBindingDown(bindings, "crouch", pressed)) {
    scratch.move.y -= 1;
  }

  if (scratch.move.lengthSquared() <= 0.0001) {
    return;
  }

  scratch.move.normalize().scaleInPlace(speed * deltaSeconds);
  flyPosition.addInPlace(scratch.move);
}

function springRecoilStep(
  value: number,
  velocity: number,
  target: number,
  stiffness: number,
  damping: number,
  dt: number,
): { value: number; velocity: number } {
  const nextVelocity =
    velocity + ((target - value) * stiffness - velocity * damping) * dt;
  return {
    value: value + nextVelocity * dt,
    velocity: nextVelocity,
  };
}

/** Sky/celestial = 0, arena geometry = 1 so walls paint over sun billboards. */
const WORLD_RENDERING_GROUP = 1;

export default function FpsScene(props: FpsSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameCoreRef = useRef<GameCoreInstance | null>(null);
  const [deathVisible, setDeathVisible] = useState(false);
  const [deathReason, setDeathReason] = useState("");
  const [deathMinDisplayEnd, setDeathMinDisplayEnd] = useState(0);
  const [deathFading, setDeathFading] = useState(false);
  const deathVisibleRef = useRef(false);
  const deathFadingRef = useRef(false);
  const levelRuntimeRef = useRef(props.levelRuntime);
  const settingsRef = useRef(props);
  const outdoorTuningRef = useRef(props.outdoorTuning);
  const flashlightTuningRef = useRef(props.flashlightTuning);
  const motionBlurTuningRef = useRef(props.motionBlurTuning);
  const viewWeaponTuningRef = useRef(props.viewWeaponTuning);
  const roundDisplayTuningRef = useRef(props.roundDisplayTuning);
  const recoilTuningRef = useRef(props.recoilTuning);
  const roundDisplayPreviewRef = useRef(props.roundDisplayPreview ?? null);
  const pausedRef = useRef(props.paused);
  const pointerLockBlockedRef = useRef(props.pointerLockBlocked);
  const materialEditModeRef = useRef(props.materialEditMode);
  const activePrimaryWeaponRef = useRef(props.activePrimaryWeapon);
  const roundsInMagRef = useRef(props.roundsInMag);
  const activeLowAmmoThresholdRef = useRef(props.activeLowAmmoThreshold);
  const fireModeRef = useRef(props.fireMode);
  const surfaceTuningRef = useRef(props.surfaceTuning);
  const onSurfacePickRef = useRef(props.onSurfacePick);
  const onPlayerCoordsRef = useRef(props.onPlayerCoords);
  const onAimBlendRef = useRef(props.onAimBlend);
  const onTryFirePrimaryRef = useRef(props.onTryFirePrimary);
  const onReadyRef = useRef(props.onReady);
  const onToggleEditModeRef = useRef<(() => void) | null>(null);
  const bindingsRef = useRef(props.bindings);
  const wasPausedRef = useRef(props.paused);
  const skyPreviewModeRef = useRef(props.skyPreviewModeRef);

  useEffect(() => {
    deathVisibleRef.current = deathVisible;
  }, [deathVisible]);

  useEffect(() => {
    deathFadingRef.current = deathFading;
  }, [deathFading]);

  const handleDeathFadeComplete = useCallback(() => {
    setDeathFading(false);
    gameCoreRef.current?.finish_death_overlay();
  }, []);

  const handleDeathRespawn = useCallback(() => {
    const gameCore = gameCoreRef.current;
    if (!gameCore) {
      return false;
    }
    const now = performance.now();
    if (!gameCore.plan_player_respawn(now, DEATH_FADE_MS)) {
      return false;
    }
    setDeathVisible(false);
    setDeathFading(true);
    return true;
  }, []);

  useEffect(() => {
    settingsRef.current = props;
    bindingsRef.current = props.bindings;
    outdoorTuningRef.current = props.outdoorTuning;
    flashlightTuningRef.current = props.flashlightTuning;
    motionBlurTuningRef.current = props.motionBlurTuning;
    viewWeaponTuningRef.current = props.viewWeaponTuning;
    roundDisplayTuningRef.current = props.roundDisplayTuning;
    recoilTuningRef.current = props.recoilTuning;
    roundDisplayPreviewRef.current = props.roundDisplayPreview ?? null;
    pausedRef.current = props.paused;
    pointerLockBlockedRef.current = props.pointerLockBlocked;
    materialEditModeRef.current = props.materialEditMode;
    activePrimaryWeaponRef.current = props.activePrimaryWeapon;
    roundsInMagRef.current = props.roundsInMag;
    activeLowAmmoThresholdRef.current = props.activeLowAmmoThreshold;
    fireModeRef.current = props.fireMode;
    surfaceTuningRef.current = props.surfaceTuning;
    onSurfacePickRef.current = props.onSurfacePick;
    onPlayerCoordsRef.current = props.onPlayerCoords;
    onAimBlendRef.current = props.onAimBlend;
    onTryFirePrimaryRef.current = props.onTryFirePrimary;
    onReadyRef.current = props.onReady;
    onToggleEditModeRef.current = props.onToggleMaterialEditMode ?? null;
    skyPreviewModeRef.current = props.skyPreviewModeRef;
  });

  useEffect(() => {
    const gameCore = gameCoreRef.current;
    if (!gameCore) {
      return;
    }

    syncGameCoreSettings(gameCore, settingsRef.current);
  }, [
    props.invertLookX,
    props.invertLookY,
    props.mouseLookEase,
    props.keyboardLookEase,
    props.mouseLookSpeed,
    props.keyboardLookSpeed,
    props.maxLookRate,
    props.walkBobEnabled,
    props.walkBobAmplitudeCm,
    props.walkBobDurationSec,
  ]);

  useEffect(() => {
    if (props.materialEditMode) {
      safeExitPointerLock();
    }
  }, [props.materialEditMode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let disposed = false;
    let gameCore: GameCoreInstance | null = null;
    let engine: Engine | null = null;
    let scene: Scene | null = null;
    let outdoorSky: OutdoorSky | null = null;
    let flashlight: PlayerFlashlight | null = null;
    let motionBlur: SceneMotionBlur | null = null;
    let detachViewmodelOverlay: (() => void) | null = null;
    let viewmodelLighting: ViewmodelLighting | null = null;
    let viewWeapon: ViewWeapon | null = null;
    let laserTracers: LaserTracerSystem | null = null;
    let sounds: GameSoundManager | null = null;
    const landingMeshes: Mesh[] = [];
    const editableMaterials: Partial<Record<EditableSurfaceId, PBRMaterial>> = {};
    let appliedTuningSnapshot = "";
    let appliedOutdoorTuningSnapshot = "";
    let appliedFlashlightTuningSnapshot = "";
    let appliedMotionBlurTuningSnapshot = "";

    const cleanupFns: Array<() => void> = [];

    const registerCleanup = (fn: () => void) => {
      cleanupFns.push(fn);
    };

    const applyAllSurfaceTuning = () => {
      const tuning = surfaceTuningRef.current;
      if (!tuning) {
        return;
      }
      if (editableMaterials.floor && tuning.floor) {
        applyFloorSurfaceTuning(
          editableMaterials.floor,
          tuning.floor,
          FLOOR_ALBEDO_TINT,
        );
      }
      if (editableMaterials.pillar && tuning.pillar) {
        applyPillarSurfaceTuning(
          editableMaterials.pillar,
          tuning.pillar,
          PILLAR_ALBEDO_TINT,
        );
      }
      if (editableMaterials.wall && tuning.wall) {
        applyWallSurfaceTuning(
          editableMaterials.wall,
          tuning.wall,
          WALL_ALBEDO_TINT,
        );
      }
      if (editableMaterials.catwalkDeck && tuning.catwalkDeck) {
        applyCatwalkDeckSurfaceTuning(
          editableMaterials.catwalkDeck,
          tuning.catwalkDeck,
          CATWALK_DECK_ALBEDO_TINT,
        );
      }
      if (editableMaterials.catwalkEdge && tuning.catwalkEdge) {
        applyCatwalkEdgeSurfaceTuning(
          editableMaterials.catwalkEdge,
          tuning.catwalkEdge,
          CATWALK_EDGE_ALBEDO_TINT,
        );
      }
    };

    void (async () => {
      gameCore = await createGameCore();
      const levelRuntime = levelRuntimeRef.current;
      gameCore.load_level(JSON.stringify(levelRuntime.config));
      gameCoreRef.current = gameCore;
      if (disposed || !canvas) {
        gameCore.free();
        return;
      }

      syncGameCoreSettings(gameCore, settingsRef.current);

      engine = new Engine(canvas, true, {
        preserveDrawingBuffer: true,
        stencil: true,
        adaptToDeviceRatio: true,
      });

      scene = new Scene(engine);
      scene.collisionsEnabled = true;
      scene.clearColor = new Color4(0, 0, 0, 0);
      scene.imageProcessingConfiguration.toneMappingEnabled = true;
      scene.imageProcessingConfiguration.toneMappingType =
        ImageProcessingConfiguration.TONEMAPPING_ACES;
      scene.imageProcessingConfiguration.exposure = 1;

      const camera = new FreeCamera(
        "fpsCamera",
        new Vector3(
          gameCore.position_x(),
          gameCore.position_y(),
          gameCore.position_z(),
        ),
        scene,
      );
      camera.minZ = 0.1;
      camera.maxZ = 10_000;
      camera.fov = HIP_FOV_RADIANS;
      camera.layerMask = WORLD_LAYER_MASK;
      camera.rotation.x = -gameCore.pitch();
      camera.rotation.y = gameCore.yaw();
      camera.applyGravity = false;
      camera.checkCollisions = true;
      camera.ellipsoid = new Vector3(
        PLAYER_COLLISION_RADIUS,
        PLAYER_COLLISION_HALF_HEIGHT,
        PLAYER_COLLISION_RADIUS,
      );
      camera.ellipsoidOffset = new Vector3(0, -PLAYER_COLLISION_HALF_HEIGHT, 0);
      camera.inputs.clear();
      scene.activeCamera = camera;

      scene.activeCameras = [camera];
      sounds = createGameSoundManager(() => camera.position);
      void sounds.preload();

      motionBlur = createMotionBlur(scene, camera, motionBlurTuningRef.current);
      appliedMotionBlurTuningSnapshot = JSON.stringify(motionBlurTuningRef.current);
      detachViewmodelOverlay = attachViewmodelOverlayPass(scene, camera);

      outdoorSky = await createOutdoorSky(scene, camera);
      if (disposed || !canvas) {
        outdoorSky.dispose();
        return;
      }
      viewmodelLighting = createViewmodelLighting(scene, outdoorSky.outdoorLights);

      const previewModeBridge = skyPreviewModeRef.current;
      if (previewModeBridge) {
        previewModeBridge.current = (mode) => {
          outdoorSky?.setTuningPreviewMode(mode);
        };
        registerCleanup(() => {
          previewModeBridge.current = null;
        });
      }

      const floorMaterial = createTileableFloorMaterial(scene);
      const pillarMaterial = createHazardPillarMaterial(scene);
      const wallMaterial = createIndustrialWallMaterial(scene);
      const catwalkDeckMaterial = createCatwalkDeckMaterial(scene);
      const catwalkEdgeMaterial = createCatwalkEdgeMaterial(scene);
      if (disposed || !canvas) {
        return;
      }

      editableMaterials.floor = floorMaterial;
      editableMaterials.pillar = pillarMaterial;
      editableMaterials.wall = wallMaterial;
      editableMaterials.catwalkDeck = catwalkDeckMaterial;
      editableMaterials.catwalkEdge = catwalkEdgeMaterial;
      applyAllSurfaceTuning();
      appliedTuningSnapshot = JSON.stringify(surfaceTuningRef.current);

      const platform = createFloorWithHoles(
        scene,
        floorMaterial,
        levelRuntime,
      );
      tagEditableSurface(platform, "floor");
      const pillarSpec = levelRuntime.pillar;
      const pillar = MeshBuilder.CreateCylinder(
        "pillar",
        {
          height: pillarSpec.height,
          diameter: pillarSpec.diameter,
          tessellation: 32,
        },
        scene,
      );
      tagEditableSurface(pillar, "pillar");
      pillar.position = new Vector3(
        pillarSpec.x,
        pillarSpec.height / 2,
        pillarSpec.z,
      );
      pillar.material = pillarMaterial;
      pillar.checkCollisions = true;

      const arenaWalls = createArenaPerimeterWalls(
        scene,
        wallMaterial,
        levelRuntime,
      );
      const eastCatwalk = createEastWallCatwalk(
        scene,
        catwalkDeckMaterial,
        catwalkEdgeMaterial,
        levelRuntime,
      );
      const jumpBlocks = createJumpBlocks(scene, levelRuntime.jumpBlocks);
      const arenaStructures = [...arenaWalls, ...eastCatwalk];
      for (const wall of arenaWalls) {
        tagEditableSurface(wall, "wall");
      }
      if (eastCatwalk[0]) {
        tagEditableSurface(eastCatwalk[0], "catwalkDeck");
      }
      for (const rail of eastCatwalk.slice(1)) {
        tagEditableSurface(rail, "catwalkEdge");
      }
      landingMeshes.push(platform, ...(eastCatwalk[0] ? [eastCatwalk[0]] : []), ...jumpBlocks);

      const [centerEnemyMeshes, loadedViewWeapon] = await Promise.all([
        loadCenterEnemy(scene),
        createViewWeapon(scene),
      ]);
      viewWeapon = loadedViewWeapon;
      laserTracers = createLaserTracerSystem(scene);
      if (disposed || !canvas) {
        return;
      }

      const levelSolidMeshes = [
        platform,
        pillar,
        ...arenaStructures,
        ...jumpBlocks,
        ...centerEnemyMeshes,
      ];
      for (const mesh of levelSolidMeshes) {
        mesh.renderingGroupId = WORLD_RENDERING_GROUP;
      }
      const shadowReceivers = [
        ...levelSolidMeshes,
        ...viewWeapon.shadowMeshes,
      ];
      const shadowCasters = levelSolidMeshes;

      const playerCollider = MeshBuilder.CreateSphere(
        "playerCollisionProbe",
        { diameter: PLAYER_COLLISION_RADIUS * 2, segments: 8 },
        scene,
      );
      playerCollider.isVisible = false;
      playerCollider.isPickable = false;
      playerCollider.checkCollisions = true;
      playerCollider.ellipsoid = new Vector3(
        PLAYER_COLLISION_RADIUS,
        PLAYER_COLLISION_HALF_HEIGHT,
        PLAYER_COLLISION_RADIUS,
      );
      playerCollider.ellipsoidOffset = new Vector3(
        0,
        -PLAYER_COLLISION_HALF_HEIGHT,
        0,
      );

      const collisionFootprintDebug = createPlayerCollisionFootprintDebug(scene);

      outdoorSky.shadows.addReceiver(platform);
      for (const mesh of shadowReceivers) {
        outdoorSky.shadows.addReceiver(mesh);
      }
      for (const mesh of shadowCasters) {
        outdoorSky.shadows.addCaster(mesh);
      }
      const shadowlessFillExclusions = [
        ...arenaWalls,
        ...viewWeapon.shadowMeshes,
      ];
      outdoorSky.excludeMeshesFromFillLights(shadowlessFillExclusions);
      viewmodelLighting.setFillBaseExclusions(shadowlessFillExclusions);
      viewmodelLighting.syncZone(
        resolveViewmodelLightingZone(),
        viewWeapon.shadowMeshes,
      );
      flashlight = createPlayerFlashlight(scene, shadowReceivers);
      flashlight.applyTuning(flashlightTuningRef.current);
      appliedFlashlightTuningSnapshot = JSON.stringify(flashlightTuningRef.current);
      await outdoorSky.shadows.prepareReceiverShaders(shadowReceivers, camera);
      await flashlight.prepareShadowShaders(shadowReceivers);

      if (!scene) {
        return;
      }
      const worldScene = scene;
      onReadyRef.current?.();

      let editPointerActive = false;
      let editPointerDownX = 0;
      let editPointerDownY = 0;
      let editLookAnchorX = 0;
      let editLookAnchorY = 0;
      let aimHeld = false;
      let shootHeld = false;
      let shootJustPressed = false;
      const pressedCodes = new Set<string>();

      const syncInput = () => {
        if (!gameCore) {
          return;
        }
        syncGameCoreInput(gameCore, bindingsRef.current, pressedCodes);
      };

      const pointerObserver = worldScene.onPointerObservable.add((pointerInfo) => {
        const event = pointerInfo.event as PointerEvent;
        if (pausedRef.current || !materialEditModeRef.current) {
          return;
        }

        if (pointerInfo.type === PointerEventTypes.POINTERDOWN) {
          if (event.button !== 0) {
            return;
          }
          editPointerActive = true;
          editPointerDownX = worldScene.pointerX;
          editPointerDownY = worldScene.pointerY;
          editLookAnchorX = worldScene.pointerX;
          editLookAnchorY = worldScene.pointerY;
          return;
        }

        if (pointerInfo.type === PointerEventTypes.POINTERMOVE) {
          if (!editPointerActive) {
            return;
          }
          const deltaX = worldScene.pointerX - editLookAnchorX;
          const deltaY = worldScene.pointerY - editLookAnchorY;
          const { dx, dy } = toMouseLookDelta(
            deltaX,
            deltaY,
            settingsRef.current.invertLookX,
            settingsRef.current.invertLookY,
          );
          if (dx !== 0 || dy !== 0) {
            gameCore?.add_mouse_delta(dx, dy);
          }
          editLookAnchorX = worldScene.pointerX;
          editLookAnchorY = worldScene.pointerY;
          return;
        }

        if (pointerInfo.type !== PointerEventTypes.POINTERUP || !editPointerActive) {
          return;
        }

        editPointerActive = false;

        const moved = Math.hypot(
          worldScene.pointerX - editPointerDownX,
          worldScene.pointerY - editPointerDownY,
        );
        if (moved > PICK_DRAG_THRESHOLD_PX) {
          return;
        }

        const surfaceId = pickEditableSurfaceAtPointer(
          worldScene,
          worldScene.pointerX,
          worldScene.pointerY,
          camera,
        );
        if (surfaceId) {
          onSurfacePickRef.current?.(surfaceId);
        }
      });

      const onKeyDown = (event: KeyboardEvent) => {
        if (pausedRef.current || deathVisibleRef.current) {
          return;
        }

        const bindings = bindingsRef.current;

        if (eventMatchesBinding(bindings, "materialEdit", event.code)) {
          onToggleEditModeRef.current?.();
          event.preventDefault();
          return;
        }

        if (eventMatchesBinding(bindings, "dayNightToggle", event.code)) {
          outdoorSky?.toggleDayNight();
          event.preventDefault();
          return;
        }

        if (
          !event.repeat &&
          eventMatchesBinding(bindings, "flashlightToggle", event.code)
        ) {
          gameCore?.press_flashlight_toggle();
          event.preventDefault();
          return;
        }

        if (!isSceneBindingCode(bindings, event.code)) {
          return;
        }

        if (eventMatchesBinding(bindings, "shoot", event.code) && !event.repeat) {
          shootJustPressed = true;
          shootHeld = true;
        }

        pressedCodes.add(event.code);
        syncInput();
        event.preventDefault();
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (!pressedCodes.has(event.code)) {
          return;
        }

        pressedCodes.delete(event.code);
        if (eventMatchesBinding(bindingsRef.current, "shoot", event.code)) {
          shootHeld = false;
        }
        syncInput();
        event.preventDefault();
      };

      const onWindowBlur = () => {
        aimHeld = false;
        shootHeld = false;
        shootJustPressed = false;
        if (pressedCodes.size === 0) {
          return;
        }

        pressedCodes.clear();
        gameCore?.clear_input();
      };

      const onMouseMove = (event: MouseEvent) => {
        if (
          pausedRef.current ||
          materialEditModeRef.current ||
          deathVisibleRef.current
        ) {
          return;
        }

        if (document.pointerLockElement !== canvas) {
          return;
        }

        const { dx, dy } = toMouseLookDelta(
          event.movementX,
          event.movementY,
          settingsRef.current.invertLookX,
          settingsRef.current.invertLookY,
        );
        gameCore?.add_mouse_delta(dx, dy);
      };

      const onMouseDown = (event: MouseEvent) => {
        if (event.button !== 0 && event.button !== 2) {
          return;
        }
        if (
          pausedRef.current ||
          materialEditModeRef.current ||
          deathVisibleRef.current
        ) {
          return;
        }
        if (event.button === 0) {
          shootJustPressed = true;
          shootHeld = true;
          event.preventDefault();
          return;
        }
        aimHeld = true;
        event.preventDefault();
      };

      const onMouseUp = (event: MouseEvent) => {
        if (event.button !== 0 && event.button !== 2) {
          return;
        }
        if (event.button === 0) {
          shootHeld = false;
          event.preventDefault();
          return;
        }
        aimHeld = false;
        event.preventDefault();
      };

      const onContextMenu = (event: MouseEvent) => {
        event.preventDefault();
      };

      const onCanvasClick = () => {
        if (
          pausedRef.current ||
          pointerLockBlockedRef.current ||
          materialEditModeRef.current ||
          deathVisibleRef.current ||
          document.pointerLockElement === canvas
        ) {
          return;
        }

        safeRequestPointerLock(canvas);
      };

      const handleResize = () => {
        engine?.resize();
      };

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      window.addEventListener("blur", onWindowBlur);
      window.addEventListener("mousemove", onMouseMove);
      window.addEventListener("mousedown", onMouseDown);
      window.addEventListener("mouseup", onMouseUp);
      window.addEventListener("resize", handleResize);
      canvas.addEventListener("click", onCanvasClick);
      canvas.addEventListener("contextmenu", onContextMenu);

      registerCleanup(() => {
        worldScene.onPointerObservable.remove(pointerObserver);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mousedown", onMouseDown);
        window.removeEventListener("mouseup", onMouseUp);
        window.removeEventListener("resize", handleResize);
        canvas.removeEventListener("click", onCanvasClick);
        canvas.removeEventListener("contextmenu", onContextMenu);
      });

      let prevMotionYaw = gameCore.yaw();
      let prevMotionPitch = gameCore.pitch() + gameCore.walk_bob_pitch();
      const previousCorePosition = new Vector3();
      const collisionDisplacement = new Vector3();
      const flyPosition = new Vector3();
      const flyScratch = {
        move: new Vector3(),
        forward: new Vector3(),
        right: new Vector3(),
      };
      const weaponPreviousPosition = camera.position.clone();
      const shotMuzzlePosition = new Vector3();
      const shotDirection = new Vector3();
      let recoilPitch = 0;
      let recoilPitchVel = 0;
      let recoilPitchTarget = 0;
      let recoilYaw = 0;
      let recoilYawVel = 0;
      let recoilYawTarget = 0;
      let footstepPhase = 0;
      let footstepActivity = 0;
      let previousFootstepX = gameCore.position_x();
      let previousFootstepZ = gameCore.position_z();
      let wasGroundedForFootstep = gameCore.on_ground();
      let aimFovBlend = 0;
      let aimBobBlend = 0;
      let flyModeActive = false;
      let collisionBlockedThisFrame = false;
      let autoFireCooldown = 0;
      let burstShotsRemaining = 0;
      let burstCooldown = 0;

      const resolveLandingEyeY = (
        x: number,
        currentY: number,
        z: number,
        eyeHeight: number,
      ) => {
        const rayOrigin = new Vector3(x, Math.max(currentY, LANDING_RAY_TOP), z);
        const ray = new Ray(rayOrigin, Vector3.Down(), LANDING_RAY_LENGTH);
        const hit = worldScene.pickWithRay(ray, (mesh) =>
          landingMeshes.includes(mesh as Mesh),
        );
        return (hit?.pickedPoint?.y ?? 0) + eyeHeight;
      };

      registerCleanup(() => collisionFootprintDebug.dispose());

      engine.runRenderLoop(() => {
        if (!gameCore || !scene) {
          return;
        }

        if (pausedRef.current && pressedCodes.size > 0) {
          pressedCodes.clear();
          gameCore.clear_input();
        }

        syncGameCoreSettings(gameCore, settingsRef.current);

        const tuningJson = JSON.stringify(surfaceTuningRef.current);
        if (tuningJson !== appliedTuningSnapshot) {
          applyAllSurfaceTuning();
          appliedTuningSnapshot = tuningJson;
        }

        const deltaSeconds = engine!.getDeltaTime() / 1000;
        autoFireCooldown = Math.max(0, autoFireCooldown - deltaSeconds);
        burstCooldown = Math.max(0, burstCooldown - deltaSeconds);
        const recoilTuning = recoilTuningRef.current ?? DEFAULT_RECOIL_TUNING;
        let recoilSpring = springRecoilStep(
          recoilPitch,
          recoilPitchVel,
          recoilPitchTarget,
          recoilTuning.springStiffness,
          recoilTuning.springDamping,
          deltaSeconds,
        );
        recoilPitch = recoilSpring.value;
        recoilPitchVel = recoilSpring.velocity;
        recoilSpring = springRecoilStep(
          recoilYaw,
          recoilYawVel,
          recoilYawTarget,
          recoilTuning.springStiffness,
          recoilTuning.springDamping,
          deltaSeconds,
        );
        recoilYaw = recoilSpring.value;
        recoilYawVel = recoilSpring.velocity;
        const previousFootstepPhase = footstepPhase;
        let horizontalFootstepSpeed = 0;
        const flyModeRequested =
          settingsRef.current.flyModeEnabled &&
          !materialEditModeRef.current &&
          !deathVisibleRef.current;

        if (flyModeRequested && !flyModeActive) {
          flyModeActive = true;
          flyPosition.copyFrom(camera.position);
          camera.checkCollisions = false;
          gameCore.clear_input();
        } else if (!flyModeRequested && flyModeActive) {
          flyModeActive = false;
          camera.checkCollisions = true;
          gameCore.sync_player_position(
            flyPosition.x,
            resolveLandingEyeY(
              flyPosition.x,
              flyPosition.y,
              flyPosition.z,
              gameCore.eye_height(),
            ),
            flyPosition.z,
          );
          gameCore.clear_input();
        }

        if (!pausedRef.current && !deathVisibleRef.current) {
          if (flyModeActive) {
            syncFlyLookInput(gameCore, bindingsRef.current, pressedCodes);
            gameCore.tick(deltaSeconds);
            camera.rotationQuaternion = Quaternion.RotationYawPitchRoll(
              gameCore.yaw() + recoilYaw,
              -(gameCore.pitch() + recoilPitch),
              0,
            );
            updateFlyPosition(
              camera,
              flyPosition,
              bindingsRef.current,
              pressedCodes,
              deltaSeconds,
              flyScratch,
            );
            collisionBlockedThisFrame = false;
          } else {
            syncGameCoreInput(gameCore, bindingsRef.current, pressedCodes);
            previousCorePosition.set(
              gameCore.position_x(),
              gameCore.position_y(),
              gameCore.position_z(),
            );
            gameCore.tick(deltaSeconds);
            collisionBlockedThisFrame = false;

            if (!gameCore.falling_through_hole()) {
              playerCollider.position.set(
                previousCorePosition.x,
                gameCore.position_y(),
                previousCorePosition.z,
              );
              collisionDisplacement.set(
                gameCore.position_x() - previousCorePosition.x,
                0,
                gameCore.position_z() - previousCorePosition.z,
              );
              playerCollider.moveWithCollisions(collisionDisplacement);
              collisionBlockedThisFrame = collisionTrimmedMove(
                previousCorePosition,
                collisionDisplacement,
                playerCollider.position,
              );
              gameCore.sync_player_position(
                playerCollider.position.x,
                gameCore.position_y(),
                playerCollider.position.z,
              );
              gameCore.try_begin_hole_fall();
            }

            if (gameCore.should_die_from_fall()) {
              const now = performance.now();
              if (gameCore.apply_player_death("fall", now, DEATH_MIN_DISPLAY_MS)) {
                safeExitPointerLock();
                setDeathReason(gameCore.death_reason());
                setDeathMinDisplayEnd(gameCore.death_min_display_end_ms());
                setDeathVisible(true);
              }
            }
          }

          outdoorSky?.tickDayNight(deltaSeconds);
        }

        const footstepX = flyModeActive ? flyPosition.x : gameCore.position_x();
        const footstepZ = flyModeActive ? flyPosition.z : gameCore.position_z();
        const footstepDelta = Math.hypot(
          footstepX - previousFootstepX,
          footstepZ - previousFootstepZ,
        );
        previousFootstepX = footstepX;
        previousFootstepZ = footstepZ;
        horizontalFootstepSpeed = footstepDelta / Math.max(deltaSeconds, 1 / 120);
        const bindings = bindingsRef.current;
        const crouching = isBindingDown(bindings, "crouch", pressedCodes);
        const sprinting = isBindingDown(bindings, "sprint", pressedCodes);
        const currentGrounded = gameCore.on_ground();
        const landedThisFrame =
          !wasGroundedForFootstep &&
          currentGrounded &&
          !pausedRef.current &&
          !deathVisibleRef.current &&
          !flyModeActive &&
          !materialEditModeRef.current &&
          !gameCore.falling_through_hole();
        if (landedThisFrame) {
          sounds?.playFootstep({
            volume: crouching ? 0.34 : 0.62,
            playbackRate: 0.94 + Math.random() * 0.08,
          });
          footstepPhase = 0;
          footstepActivity = 0;
        }
        wasGroundedForFootstep = currentGrounded;
        const canStep =
          !pausedRef.current &&
          !deathVisibleRef.current &&
          !flyModeActive &&
          !materialEditModeRef.current &&
          currentGrounded &&
          !gameCore.falling_through_hole() &&
          settingsRef.current.walkBobEnabled &&
          horizontalFootstepSpeed > WALK_BOB_MIN_ACTIVITY_SPEED;
        const footstepTarget = canStep ? 1 : 0;
        const duration = Math.min(Math.max(settingsRef.current.walkBobDurationSec, 0.25), 1.2);
        const durationT = (duration - 0.25) / (1.2 - 0.25);
        const walkFade = 4 + (6 - 4) * durationT;
        footstepActivity +=
          (footstepTarget - footstepActivity) *
          (1 - Math.exp(-walkFade * deltaSeconds));
        if (!canStep) {
          footstepActivity *= Math.exp(-10 * deltaSeconds);
          if (footstepActivity < 0.01) {
            footstepActivity = 0;
            footstepPhase = 0;
          }
        } else if (footstepActivity > 0.35) {
          const cycleHz = 1 / duration;
          const freqShare = 1.85 / (1.85 + 0.38 * WALK_SPEED);
          const bobFreq =
            cycleHz * freqShare +
            horizontalFootstepSpeed * ((cycleHz * (1 - freqShare)) / WALK_SPEED);
          footstepPhase += deltaSeconds * bobFreq * Math.PI * 2 * footstepActivity;
          const beforeHalf = Math.floor(previousFootstepPhase / Math.PI);
          const afterHalf = Math.floor(footstepPhase / Math.PI);
          for (let half = beforeHalf + 1; half <= afterHalf; half += 1) {
            const speedNorm = horizontalFootstepSpeed / Math.max(WALK_SPEED, 0.1);
            const playbackRate = Math.min(
              Math.max(0.94 + (speedNorm - 1) * 0.06, 0.9),
              1.08,
            );
            let volume = 0.5;
            if (crouching) volume *= 0.5;
            else if (sprinting) volume *= 1.08;
            const crouchScale = crouching ? CROUCH_EYE_RATIO : 1;
            sounds?.playFootstep({
              volume: volume * crouchScale,
              playbackRate,
            });
          }
        }

        outdoorSky?.update(camera);
        const outdoorTuningJson = JSON.stringify(outdoorTuningRef.current);
        if (outdoorTuningJson !== appliedOutdoorTuningSnapshot) {
          outdoorSky?.applyOutdoorTuning(outdoorTuningRef.current);
          appliedOutdoorTuningSnapshot = outdoorTuningJson;
        }

        const flashlightTuningJson = JSON.stringify(flashlightTuningRef.current);
        if (flashlightTuningJson !== appliedFlashlightTuningSnapshot) {
          flashlight?.applyTuning(flashlightTuningRef.current);
          appliedFlashlightTuningSnapshot = flashlightTuningJson;
        }

        const motionBlurTuningJson = JSON.stringify(motionBlurTuningRef.current);
        if (motionBlurTuningJson !== appliedMotionBlurTuningSnapshot) {
          motionBlur?.applyTuning(motionBlurTuningRef.current);
          appliedMotionBlurTuningSnapshot = motionBlurTuningJson;
        }

        const wantsAim =
          aimHeld || isBindingDown(bindingsRef.current, "aim", pressedCodes);
        const aimTarget = wantsAim ? 1 : 0;
        const rifleAimTarget =
          activePrimaryWeaponRef.current === "rifle" && wantsAim ? 1 : 0;
        const aimBlendSpeed =
          rifleAimTarget > aimFovBlend ? AIM_BLEND_IN_SPEED : AIM_BLEND_OUT_SPEED;
        aimFovBlend +=
          (rifleAimTarget - aimFovBlend) *
          (1 - Math.exp(-aimBlendSpeed * deltaSeconds));
        if (Math.abs(rifleAimTarget - aimFovBlend) < 0.001) {
          aimFovBlend = rifleAimTarget;
        }
        const aimBobSpeed =
          aimTarget > aimBobBlend ? AIM_BLEND_IN_SPEED : AIM_BLEND_OUT_SPEED;
        aimBobBlend +=
          (aimTarget - aimBobBlend) *
          (1 - Math.exp(-aimBobSpeed * deltaSeconds));
        if (Math.abs(aimTarget - aimBobBlend) < 0.001) {
          aimBobBlend = aimTarget;
        }
        camera.fov =
          HIP_FOV_RADIANS + (ADS_FOV_RADIANS - HIP_FOV_RADIANS) * aimFovBlend;
        onAimBlendRef.current?.(aimFovBlend);

        if (flyModeActive) {
          camera.position.copyFrom(flyPosition);
          camera.rotationQuaternion = Quaternion.RotationYawPitchRoll(
            gameCore.yaw() + recoilYaw,
            -(gameCore.pitch() + recoilPitch),
            0,
          );
        } else {
          const walkBobScale = 1 - aimBobBlend;
          camera.position.x = gameCore.position_x();
          camera.position.y =
            gameCore.position_y() + gameCore.walk_bob_y() * walkBobScale;
          camera.position.z = gameCore.position_z();
          // Yaw-pitch-roll (YXZ) — same as GE2; separate Euler axes skew roll when looking around.
          camera.rotationQuaternion = Quaternion.RotationYawPitchRoll(
            gameCore.yaw() + recoilYaw,
            -(
              gameCore.pitch() +
              gameCore.walk_bob_pitch() * walkBobScale +
              recoilPitch
            ),
            gameCore.walk_bob_roll() * walkBobScale,
          );
        }
        const lookYaw = gameCore.yaw();
        const lookBobScale = 1 - aimBobBlend;
        const lookPitch = flyModeActive
          ? gameCore.pitch()
          : gameCore.pitch() + gameCore.walk_bob_pitch() * lookBobScale;
        if (!pausedRef.current) {
          motionBlur?.setCameraMotion(
            lookYaw - prevMotionYaw,
            lookPitch - prevMotionPitch,
          );
        } else {
          motionBlur?.setCameraMotion(0, 0);
        }
        prevMotionYaw = lookYaw;
        prevMotionPitch = lookPitch;

        if (!pausedRef.current) {
          flashlight?.syncFromGameCore(
            gameCore,
            camera,
            outdoorSky?.getNightness() ?? 0,
          );
        }

        const weaponMoveSpeed = pausedRef.current
          ? 0
          : Vector3.Distance(camera.position, weaponPreviousPosition) /
            Math.max(deltaSeconds, 1 / 120);
        weaponPreviousPosition.copyFrom(camera.position);
        viewWeapon?.setActiveWeapon(activePrimaryWeaponRef.current);
        viewWeapon?.update(camera, {
          deltaSeconds,
          moveSpeed: weaponMoveSpeed,
          aimTarget,
          tuning: viewWeaponTuningRef.current,
          roundDisplayTuning: roundDisplayTuningRef.current,
          roundDisplayPreview: roundDisplayPreviewRef.current,
          roundCount: roundsInMagRef.current,
          roundDisplayLow: roundsInMagRef.current <= activeLowAmmoThresholdRef.current,
          recoilTuning,
          visible: !deathVisibleRef.current && !materialEditModeRef.current,
        });
        if (viewWeapon) {
          viewmodelLighting?.syncZone(
            resolveViewmodelLightingZone(),
            viewWeapon.shadowMeshes,
          );
        }
        const canShoot =
          !pausedRef.current &&
          !deathVisibleRef.current &&
          !materialEditModeRef.current &&
          !flyModeActive &&
          viewWeapon != null &&
          laserTracers != null &&
          sounds != null;
        const activeFireMode =
          activePrimaryWeaponRef.current === "pistol" ? "single" : fireModeRef.current;
        let shotsToFire = 0;
        if (canShoot) {
          if (burstShotsRemaining > 0 && burstCooldown <= 0) {
            shotsToFire = 1;
            burstShotsRemaining -= 1;
            burstCooldown = BURST_INTERVAL;
          } else if (activeFireMode === "auto" && shootHeld && autoFireCooldown <= 0) {
            shotsToFire = 1;
            autoFireCooldown = AUTO_FIRE_INTERVAL;
          } else if (activeFireMode === "burst" && shootJustPressed && burstShotsRemaining <= 0) {
            shotsToFire = 1;
            burstShotsRemaining = BURST_SHOT_COUNT - 1;
            burstCooldown = BURST_INTERVAL;
          } else if (activeFireMode === "single" && shootJustPressed) {
            shotsToFire = 1;
          }
        } else {
          burstShotsRemaining = 0;
        }
        shootJustPressed = false;

        for (let i = 0; i < shotsToFire; i += 1) {
          const shot = onTryFirePrimaryRef.current?.();
          if (!shot) {
            burstShotsRemaining = 0;
            break;
          }
          const recoilScale = resolveAdsRecoilScale(aimFovBlend);
          const pitchTargetDelta =
            recoilTuning.aimRecoilPitch *
            recoilScale *
            (0.85 + Math.random() * 0.3);
          const yawTargetDelta =
            (Math.random() - 0.5) *
            2 *
            recoilTuning.aimRecoilYaw *
            recoilScale;
          recoilPitchTarget += pitchTargetDelta;
          recoilYawTarget += yawTargetDelta;
          recoilPitchVel += pitchTargetDelta * recoilTuning.kickVelScale;
          recoilYawVel += yawTargetDelta * recoilTuning.kickVelScale;
          viewWeapon?.flashMuzzle();
          viewWeapon?.applyFireKick(aimFovBlend, recoilTuning);
          viewWeapon?.getMuzzleWorld(shotMuzzlePosition, shotDirection, camera);
          laserTracers?.spawn(shotMuzzlePosition, shotDirection, BULLET_MAX_RANGE);
          sounds?.playShot();
        }
        laserTracers?.update(deltaSeconds);

        onPlayerCoordsRef.current?.({
          x: flyModeActive ? flyPosition.x : gameCore.position_x(),
          y: flyModeActive ? flyPosition.y : gameCore.position_y(),
          z: flyModeActive ? flyPosition.z : gameCore.position_z(),
          yaw: gameCore.yaw(),
          pitch: gameCore.pitch(),
        });

        const showCollisionFootprint =
          settingsRef.current.showPlayerCollisionFootprint && !flyModeActive;
        collisionFootprintDebug.setEnabled(showCollisionFootprint);
        if (showCollisionFootprint) {
          collisionFootprintDebug.sync(
            playerCollider.position.x,
            playerFootY(gameCore.position_y(), gameCore.eye_height()),
            playerCollider.position.z,
            collisionBlockedThisFrame,
          );
        }

        scene.render();
      });
    })();

    return () => {
      disposed = true;

      for (const cleanup of cleanupFns.reverse()) {
        cleanup();
      }

      safeExitPointerLock();

      detachViewmodelOverlay?.();
      viewmodelLighting?.dispose();
      outdoorSky?.dispose();
      motionBlur?.dispose();
      flashlight?.dispose();
      viewWeapon?.dispose();
      laserTracers?.dispose();
      sounds?.dispose();
      scene?.dispose();
      engine?.dispose();
      gameCore?.free();
      gameCoreRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (props.paused || props.pointerLockBlocked) {
      safeExitPointerLock();
    }
  }, [props.paused, props.pointerLockBlocked]);

  useEffect(() => {
    if (
      wasPausedRef.current &&
      !props.paused &&
      !props.pointerLockBlocked &&
      !props.materialEditMode
    ) {
      const canvas = canvasRef.current;
      if (canvas) {
        schedulePointerLockRecapture(canvas);
      }
    }
    wasPausedRef.current = props.paused;
  }, [props.paused, props.pointerLockBlocked, props.materialEditMode]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={`babylon-canvas${props.materialEditMode ? " babylon-canvas--edit-mode" : ""}`}
        tabIndex={0}
      />
      <DeathOverlay
        canvasRef={canvasRef}
        visible={deathVisible}
        reason={deathReason}
        minDisplayEnd={deathMinDisplayEnd}
        fading={deathFading}
        onRespawn={handleDeathRespawn}
        onFadeComplete={handleDeathFadeComplete}
      />
    </>
  );
}
