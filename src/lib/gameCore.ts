export interface GameCoreModule {
  default: (module_or_path?: WebAssembly.Module | string) => Promise<unknown>;
  GameCore: new () => GameCoreInstance;
}

export interface GameCoreInstance {
  free(): void;
  reset(): void;
  set_input(
    forward: boolean,
    backward: boolean,
    left: boolean,
    right: boolean,
    look_up: boolean,
    look_down: boolean,
    look_left: boolean,
    look_right: boolean,
    jump: boolean,
    sprint: boolean,
    crouch: boolean,
  ): void;
  clear_input(): void;
  add_mouse_delta(deltaX: number, deltaY: number): void;
  set_invert_look_x(invert: boolean): void;
  set_invert_look_y(invert: boolean): void;
  set_mouse_look_ease(ease: number): void;
  set_keyboard_look_ease(ease: number): void;
  set_mouse_look_speed(speed: number): void;
  set_keyboard_look_speed(speed: number): void;
  set_max_look_rate(rate: number): void;
  set_walk_bob_enabled(enabled: boolean): void;
  set_walk_bob_amplitude_cm(amplitudeCm: number): void;
  set_walk_bob_duration_sec(durationSec: number): void;
  tick(deltaSeconds: number): void;
  position_x(): number;
  position_y(): number;
  position_z(): number;
  yaw(): number;
  pitch(): number;
  walk_bob_y(): number;
  walk_bob_pitch(): number;
  walk_bob_roll(): number;
  on_ground(): boolean;
  press_flashlight_toggle(): void;
  flashlight_on(): boolean;
  write_flashlight_beam(nightness: number, out: Float32Array): void;
}

const WASM_BASE_PATH = "/wasm/game_core";

let modulePromise: Promise<GameCoreModule> | null = null;

export async function loadGameCoreModule(): Promise<GameCoreModule> {
  if (!modulePromise) {
    modulePromise = (async () => {
      const wasm = (await import(
        /* webpackIgnore: true */
        `${WASM_BASE_PATH}/game_core.js`
      )) as GameCoreModule;

      await wasm.default(`${WASM_BASE_PATH}/game_core_bg.wasm`);
      return wasm;
    })();
  }

  return modulePromise;
}

export async function createGameCore(): Promise<GameCoreInstance> {
  const wasm = await loadGameCoreModule();
  return new wasm.GameCore();
}
