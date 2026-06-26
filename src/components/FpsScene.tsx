"use client";

import { useEffect, useRef } from "react";
import {
  Color4,
  Engine,
  ImageProcessingConfiguration,
  FreeCamera,
  MeshBuilder,
  PointerEventTypes,
  PBRMaterial,
  Quaternion,
  Scene,
  Vector3,
} from "@babylonjs/core";
import { createOutdoorSky, type OutdoorSky } from "@/lib/lighting/createOutdoorSky";
import { createPlayerFlashlight, type PlayerFlashlight } from "@/lib/lighting/createPlayerFlashlight";
import { createTileableFloorMaterial } from "@/lib/floor/createTileableFloorMaterial";
import {
  FLOOR_ALBEDO_TINT,
  FLOOR_PLATFORM_SIZE,
} from "@/lib/floor/floorAssets";
import { createHazardPillarMaterial } from "@/lib/pillar/createHazardPillarMaterial";
import {
  PILLAR_DIAMETER,
  PILLAR_HEIGHT,
} from "@/lib/pillar/pillarAssets";
import { createGameCore, type GameCoreInstance } from "@/lib/gameCore";
import {
  BINDING_ROWS,
  eventMatchesBinding,
  syncGameCoreInput,
  type BindingAction,
  type KeyBindingsMap,
} from "@/lib/keyBindings";
import { applyFloorSurfaceTuning, applyPillarSurfaceTuning } from "@/lib/materialEdit/applySurfaceTuning";
import type {
  EditableSurfaceId,
  SurfaceTuningState,
} from "@/lib/materialEdit/types";
import { pickEditableSurfaceAtPointer, tagEditableSurface } from "@/lib/scene/pickEditableSurface";
import type { OutdoorLightingTuning } from "@/lib/lighting/outdoorLightingTuning";
import type { FlashlightTuning } from "@/lib/lighting/flashlightTuning";
import type { GameSettings } from "@/lib/settings";
import {
  safeExitPointerLock,
  safeRequestPointerLock,
  schedulePointerLockRecapture,
} from "@/lib/pointerLock";
import type { PlayerCoords } from "@/lib/playerCoords";

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
> & {
  bindings: KeyBindingsMap;
  outdoorTuning: OutdoorLightingTuning;
  flashlightTuning: FlashlightTuning;
  paused: boolean;
  materialEditMode: boolean;
  surfaceTuning: SurfaceTuningState;
  onSurfacePick?: (surfaceId: EditableSurfaceId) => void;
  onToggleMaterialEditMode?: () => void;
  onPlayerCoords?: (coords: PlayerCoords) => void;
  onFps?: (fps: number) => void;
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

const SCENE_BINDING_ACTIONS: BindingAction[] = BINDING_ROWS.map(
  (row) => row.id,
).filter((id) => id !== "openSettings");

function isSceneBindingCode(bindings: KeyBindingsMap, code: string): boolean {
  return SCENE_BINDING_ACTIONS.some((action) =>
    eventMatchesBinding(bindings, action, code),
  );
}

export default function FpsScene(props: FpsSceneProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameCoreRef = useRef<GameCoreInstance | null>(null);
  const settingsRef = useRef(props);
  const outdoorTuningRef = useRef(props.outdoorTuning);
  const flashlightTuningRef = useRef(props.flashlightTuning);
  const pausedRef = useRef(props.paused);
  const materialEditModeRef = useRef(props.materialEditMode);
  const surfaceTuningRef = useRef(props.surfaceTuning);
  const onSurfacePickRef = useRef(props.onSurfacePick);
  const onPlayerCoordsRef = useRef(props.onPlayerCoords);
  const onFpsRef = useRef(props.onFps);
  const onToggleEditModeRef = useRef<(() => void) | null>(null);
  const bindingsRef = useRef(props.bindings);
  const wasPausedRef = useRef(props.paused);

  settingsRef.current = props;
  bindingsRef.current = props.bindings;
  outdoorTuningRef.current = props.outdoorTuning;
  flashlightTuningRef.current = props.flashlightTuning;
  pausedRef.current = props.paused;
  materialEditModeRef.current = props.materialEditMode;
  surfaceTuningRef.current = props.surfaceTuning;
  onSurfacePickRef.current = props.onSurfacePick;
  onPlayerCoordsRef.current = props.onPlayerCoords;
  onFpsRef.current = props.onFps;

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
    const editableMaterials: Partial<Record<EditableSurfaceId, PBRMaterial>> = {};
    let appliedTuningSnapshot = "";
    let appliedOutdoorTuningSnapshot = "";
    let appliedFlashlightTuningSnapshot = "";

    const cleanupFns: Array<() => void> = [];

    const registerCleanup = (fn: () => void) => {
      cleanupFns.push(fn);
    };

    const applyAllSurfaceTuning = () => {
      const tuning = surfaceTuningRef.current;
      if (!tuning?.floor || !tuning?.pillar) {
        return;
      }
      if (editableMaterials.floor) {
        applyFloorSurfaceTuning(
          editableMaterials.floor,
          tuning.floor,
          FLOOR_ALBEDO_TINT,
        );
      }
      if (editableMaterials.pillar) {
        applyPillarSurfaceTuning(editableMaterials.pillar, tuning.pillar, {
          r: 1,
          g: 1,
          b: 1,
        });
      }
    };

    void (async () => {
      gameCore = await createGameCore();
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
      scene.clearColor = new Color4(0.72, 0.85, 0.94, 1);
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
      camera.rotation.x = -gameCore.pitch();
      camera.rotation.y = gameCore.yaw();
      camera.applyGravity = false;
      camera.checkCollisions = false;
      camera.inputs.clear();
      scene.activeCamera = camera;

      outdoorSky = await createOutdoorSky(scene, camera);
      if (disposed || !canvas) {
        outdoorSky.dispose();
        return;
      }

      const [floorMaterial, pillarMaterial] = await Promise.all([
        createTileableFloorMaterial(scene),
        createHazardPillarMaterial(scene),
      ]);
      if (disposed || !canvas) {
        return;
      }

      editableMaterials.floor = floorMaterial;
      editableMaterials.pillar = pillarMaterial;
      applyAllSurfaceTuning();
      appliedTuningSnapshot = JSON.stringify(surfaceTuningRef.current);

      const platform = MeshBuilder.CreateGround(
        "platform",
        { width: FLOOR_PLATFORM_SIZE, height: FLOOR_PLATFORM_SIZE },
        scene,
      );
      tagEditableSurface(platform, "floor");
      platform.material = floorMaterial;
      const pillar = MeshBuilder.CreateCylinder(
        "pillar",
        { height: PILLAR_HEIGHT, diameter: PILLAR_DIAMETER, tessellation: 32 },
        scene,
      );
      tagEditableSurface(pillar, "pillar");
      pillar.position = new Vector3(6, PILLAR_HEIGHT / 2, 2);
      pillar.material = pillarMaterial;

      outdoorSky.shadows.addReceiver(platform);
      outdoorSky.shadows.addReceiver(pillar);
      outdoorSky.shadows.addCaster(pillar);
      await outdoorSky.shadows.prepareReceiverShaders([platform, pillar]);
      flashlight = createPlayerFlashlight(scene, [platform, pillar]);
      flashlight.applyTuning(flashlightTuningRef.current);
      appliedFlashlightTuningSnapshot = JSON.stringify(flashlightTuningRef.current);

      if (!scene) {
        return;
      }
      const worldScene = scene;

      let editPointerActive = false;
      let editPointerDownX = 0;
      let editPointerDownY = 0;
      let editLookAnchorX = 0;
      let editLookAnchorY = 0;
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
        if (pausedRef.current) {
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

        pressedCodes.add(event.code);
        syncInput();
        event.preventDefault();
      };

      const onKeyUp = (event: KeyboardEvent) => {
        if (!pressedCodes.has(event.code)) {
          return;
        }

        pressedCodes.delete(event.code);
        syncInput();
        event.preventDefault();
      };

      const onWindowBlur = () => {
        if (pressedCodes.size === 0) {
          return;
        }

        pressedCodes.clear();
        gameCore?.clear_input();
      };

      const onMouseMove = (event: MouseEvent) => {
        if (pausedRef.current || materialEditModeRef.current) {
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

      const onCanvasClick = () => {
        if (
          pausedRef.current ||
          materialEditModeRef.current ||
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
      window.addEventListener("resize", handleResize);
      canvas.addEventListener("click", onCanvasClick);

      registerCleanup(() => {
        worldScene.onPointerObservable.remove(pointerObserver);
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        window.removeEventListener("blur", onWindowBlur);
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("resize", handleResize);
        canvas.removeEventListener("click", onCanvasClick);
      });

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

        let deltaSeconds = 0;
        if (!pausedRef.current) {
          syncGameCoreInput(gameCore, bindingsRef.current, pressedCodes);
          deltaSeconds = engine!.getDeltaTime() / 1000;
          gameCore.tick(deltaSeconds);
          outdoorSky?.tickDayNight(deltaSeconds);
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

        camera.position.x = gameCore.position_x();
        camera.position.y = gameCore.position_y() + gameCore.walk_bob_y();
        camera.position.z = gameCore.position_z();
        // Yaw-pitch-roll (YXZ) — same as GE2; separate Euler axes skew roll when looking around.
        camera.rotationQuaternion = Quaternion.RotationYawPitchRoll(
          gameCore.yaw(),
          -(gameCore.pitch() + gameCore.walk_bob_pitch()),
          gameCore.walk_bob_roll(),
        );

        if (!pausedRef.current) {
          flashlight?.syncFromGameCore(
            gameCore,
            camera,
            outdoorSky?.getNightness() ?? 0,
          );
        }

        onPlayerCoordsRef.current?.({
          x: gameCore.position_x(),
          y: gameCore.position_y(),
          z: gameCore.position_z(),
          yaw: gameCore.yaw(),
          pitch: gameCore.pitch(),
        });

        onFpsRef.current?.(engine!.getFps());

        scene.render();
      });
    })();

    return () => {
      disposed = true;

      for (const cleanup of cleanupFns.reverse()) {
        cleanup();
      }

      safeExitPointerLock();

      outdoorSky?.dispose();
      flashlight?.dispose();
      scene?.dispose();
      engine?.dispose();
      gameCore?.free();
      gameCoreRef.current = null;
    };
  }, []);

  onToggleEditModeRef.current = props.onToggleMaterialEditMode ?? null;

  useEffect(() => {
    if (props.paused) {
      safeExitPointerLock();
    }
  }, [props.paused]);

  useEffect(() => {
    if (wasPausedRef.current && !props.paused && !props.materialEditMode) {
      const canvas = canvasRef.current;
      if (canvas) {
        schedulePointerLockRecapture(canvas);
      }
    }
    wasPausedRef.current = props.paused;
  }, [props.paused, props.materialEditMode]);

  return (
    <canvas
      ref={canvasRef}
      className={`babylon-canvas${props.materialEditMode ? " babylon-canvas--edit-mode" : ""}`}
      tabIndex={0}
    />
  );
}
