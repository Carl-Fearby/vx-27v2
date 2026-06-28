export interface GameCoreModule {
  default: (
    module_or_path?:
      | WebAssembly.Module
      | string
      | { module_or_path?: WebAssembly.Module | string },
  ) => Promise<unknown>;
  GameCore: new () => GameCoreInstance;
}

export interface GameCoreInstance {
  free(): void;
  reset(): void;
  load_level(json: string): void;
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
  try_begin_hole_fall(): void;
  sync_player_position(x: number, y: number, z: number): void;
  position_x(): number;
  position_y(): number;
  position_z(): number;
  yaw(): number;
  pitch(): number;
  walk_bob_y(): number;
  walk_bob_pitch(): number;
  walk_bob_roll(): number;
  on_ground(): boolean;
  foot_y(): number;
  eye_height(): number;
  falling_through_hole(): boolean;
  death_active(): boolean;
  death_reason(): string;
  death_min_display_end_ms(): number;
  should_die_from_fall(): boolean;
  apply_player_death(kind: string, nowMs: number, minDisplayMs: number): boolean;
  plan_player_respawn(nowMs: number, fadeMs: number): boolean;
  finish_death_overlay(): void;
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

      await wasm.default({
        module_or_path: `${WASM_BASE_PATH}/game_core_bg.wasm`,
      });
      return wasm;
    })();
  }

  return modulePromise;
}

export async function createGameCore(): Promise<GameCoreInstance> {
  const wasm = await loadGameCoreModule();
  return new wasm.GameCore();
}
