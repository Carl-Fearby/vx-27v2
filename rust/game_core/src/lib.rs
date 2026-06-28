mod death;
mod flashlight;
mod floor_hole;
mod input;
mod level_config;
mod look;
mod player;
mod world;

use death::{player_death_reason, should_trigger_death, DeathState};
use flashlight::FlashlightState;
use input::{
    InputState, KEY_A, KEY_ARROW_DOWN, KEY_ARROW_LEFT, KEY_ARROW_RIGHT, KEY_ARROW_UP, KEY_D, KEY_S,
    KEY_W,
};
use player::PlayerState;
use wasm_bindgen::prelude::*;
use world::World;

#[wasm_bindgen]
pub struct GameCore {
    input: InputState,
    player: PlayerState,
    world: World,
    flashlight: FlashlightState,
    death: DeathState,
}

#[wasm_bindgen]
impl GameCore {
    #[wasm_bindgen(constructor)]
    pub fn new() -> GameCore {
        GameCore {
            input: InputState::default(),
            player: PlayerState::default(),
            world: World::default(),
            flashlight: FlashlightState::default(),
            death: DeathState::default(),
        }
    }

    pub fn reset(&mut self) {
        self.input = InputState::default();
        self.player.reset_to_spawn(self.world.player_spawn());
        self.flashlight = FlashlightState::default();
        self.death.clear();
    }

    pub fn load_level(&mut self, json: &str) -> Result<(), JsValue> {
        let world = World::from_level_json(json).map_err(|error| JsValue::from_str(&error))?;
        let spawn = world.player_spawn();
        self.world = world;
        self.player.reset_to_spawn(spawn);
        self.input.clear();
        self.death.clear();
        Ok(())
    }

    pub fn press_flashlight_toggle(&mut self) {
        self.flashlight.toggle();
    }

    pub fn flashlight_on(&self) -> bool {
        self.flashlight.is_active()
    }

    /// `[intensity, raise_blend]`
    pub fn write_flashlight_beam(&self, nightness: f32, out: &mut [f32]) {
        if out.len() < 2 {
            return;
        }

        let scale = self.flashlight.intensity_scale(nightness);
        if scale <= 0.05 {
            out[0] = 0.0;
            out[1] = self.flashlight.raise_blend();
            return;
        }

        out[0] = self.flashlight.intensity(nightness);
        out[1] = self.flashlight.raise_blend();
    }

    pub fn set_input(
        &mut self,
        forward: bool,
        backward: bool,
        left: bool,
        right: bool,
        look_up: bool,
        look_down: bool,
        look_left: bool,
        look_right: bool,
        jump: bool,
        sprint: bool,
        crouch: bool,
    ) {
        self.input.forward = forward;
        self.input.backward = backward;
        self.input.left = left;
        self.input.right = right;
        self.input.look_up = look_up;
        self.input.look_down = look_down;
        self.input.look_left = look_left;
        self.input.look_right = look_right;
        self.input.jump = jump;
        self.input.sprint = sprint;
        self.input.crouch = crouch;
    }

    pub fn clear_input(&mut self) {
        self.input.clear();
    }

    /// Legacy key-code path; prefer `set_input` from the bindings layer.
    pub fn set_key(&mut self, key: u32, pressed: bool) {
        use input::{
            KEY_A, KEY_ARROW_DOWN, KEY_ARROW_LEFT, KEY_ARROW_RIGHT, KEY_ARROW_UP, KEY_D, KEY_S,
            KEY_W,
        };
        match key {
            KEY_W => self.input.forward = pressed,
            KEY_S => self.input.backward = pressed,
            KEY_A => self.input.left = pressed,
            KEY_D => self.input.right = pressed,
            KEY_ARROW_UP => self.input.look_up = pressed,
            KEY_ARROW_DOWN => self.input.look_down = pressed,
            KEY_ARROW_LEFT => self.input.look_left = pressed,
            KEY_ARROW_RIGHT => self.input.look_right = pressed,
            _ => {}
        }
    }

    pub fn add_mouse_delta(&mut self, delta_x: f32, delta_y: f32) {
        self.player.add_mouse_delta(delta_x, delta_y);
    }

    pub fn set_invert_look_x(&mut self, invert: bool) {
        self.player.set_invert_look_x(invert);
    }

    pub fn set_invert_look_y(&mut self, invert: bool) {
        self.player.set_invert_look_y(invert);
    }

    pub fn set_mouse_look_ease(&mut self, ease: f32) {
        self.player.set_mouse_look_ease(ease);
    }

    pub fn set_keyboard_look_ease(&mut self, ease: f32) {
        self.player.set_keyboard_look_ease(ease);
    }

    pub fn set_mouse_look_speed(&mut self, speed: f32) {
        self.player.set_mouse_look_speed(speed);
    }

    pub fn set_keyboard_look_speed(&mut self, speed: f32) {
        self.player.set_keyboard_look_speed(speed);
    }

    pub fn set_max_look_rate(&mut self, rate: f32) {
        self.player.set_max_look_rate(rate);
    }

    pub fn set_walk_bob_enabled(&mut self, enabled: bool) {
        self.player.set_walk_bob_enabled(enabled);
    }

    pub fn set_walk_bob_amplitude_cm(&mut self, amplitude_cm: f32) {
        self.player.set_walk_bob_amplitude_cm(amplitude_cm);
    }

    pub fn set_walk_bob_duration_sec(&mut self, duration_sec: f32) {
        self.player.set_walk_bob_duration_sec(duration_sec);
    }

    pub fn tick(&mut self, delta_seconds: f32) {
        if !self.death.active {
            self.player.tick(&self.input, delta_seconds, &self.world);
        }
        self.flashlight.tick(delta_seconds);
    }

    pub fn try_begin_hole_fall(&mut self) {
        if self.death.active {
            return;
        }
        self.world.try_begin_hole_fall(&mut self.player);
    }

    pub fn foot_y(&self) -> f32 {
        self.player.foot_y()
    }

    pub fn eye_height(&self) -> f32 {
        self.player.eye_height
    }

    pub fn falling_through_hole(&self) -> bool {
        self.player.falling_through_hole
    }

    pub fn death_active(&self) -> bool {
        self.death.active
    }

    pub fn death_reason(&self) -> String {
        self.death.reason.clone()
    }

    pub fn death_min_display_end_ms(&self) -> f64 {
        self.death.min_display_end_ms
    }

    pub fn should_die_from_fall(&self) -> bool {
        should_trigger_death(
            self.death.active,
            self.player.foot_y(),
            self.world.floor_foot_y(),
            floor_hole::DEATH_FALL_DROP,
        ) || self.world.hole_fall_should_die(&self.player)
    }

    pub fn apply_player_death(&mut self, kind: &str, now_ms: f64, min_display_ms: f64) -> bool {
        if self.death.active {
            return false;
        }
        self.death.active = true;
        self.death.reason = player_death_reason(kind).to_string();
        self.death.min_display_end_ms = now_ms + min_display_ms.max(0.0);
        self.death.fade_end_ms = f64::INFINITY;
        self.input.clear();
        true
    }

    pub fn plan_player_respawn(&mut self, now_ms: f64, fade_ms: f64) -> bool {
        if !self.death.active {
            return false;
        }
        self.player.reset();
        self.input.clear();
        self.death.fade_end_ms = now_ms + fade_ms.max(0.0);
        self.death.active = false;
        self.death.reason.clear();
        self.death.min_display_end_ms = 0.0;
        true
    }

    pub fn finish_death_overlay(&mut self) {
        self.death.clear();
    }

    pub fn sync_player_position(&mut self, x: f32, y: f32, z: f32) {
        self.player.x = x;
        self.player.y = y;
        self.player.z = z;
    }

    pub fn position_x(&self) -> f32 {
        self.player.x
    }

    pub fn position_y(&self) -> f32 {
        self.player.y
    }

    pub fn position_z(&self) -> f32 {
        self.player.z
    }

    pub fn yaw(&self) -> f32 {
        self.player.yaw
    }

    pub fn pitch(&self) -> f32 {
        self.player.pitch
    }

    pub fn walk_bob_y(&self) -> f32 {
        self.player.walk_bob_y
    }

    pub fn walk_bob_pitch(&self) -> f32 {
        self.player.walk_bob_pitch
    }

    pub fn walk_bob_roll(&self) -> f32 {
        self.player.walk_bob_roll
    }

    pub fn on_ground(&self) -> bool {
        self.player.on_ground
    }
}

#[wasm_bindgen]
pub fn key_w() -> u32 {
    KEY_W
}

#[wasm_bindgen]
pub fn key_a() -> u32 {
    KEY_A
}

#[wasm_bindgen]
pub fn key_s() -> u32 {
    KEY_S
}

#[wasm_bindgen]
pub fn key_d() -> u32 {
    KEY_D
}

#[wasm_bindgen]
pub fn key_arrow_up() -> u32 {
    KEY_ARROW_UP
}

#[wasm_bindgen]
pub fn key_arrow_down() -> u32 {
    KEY_ARROW_DOWN
}

#[wasm_bindgen]
pub fn key_arrow_left() -> u32 {
    KEY_ARROW_LEFT
}

#[wasm_bindgen]
pub fn key_arrow_right() -> u32 {
    KEY_ARROW_RIGHT
}
