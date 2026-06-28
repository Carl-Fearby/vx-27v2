use crate::input::InputState;
use crate::level_config::LevelPlayerSpawn;
use crate::look::{
    apply_look_velocities, clamp_look_velocities, update_keyboard_look_velocity,
    update_mouse_look_velocity, LookInput, LookTuning, LookVelocity,
};

const WALK_SPEED: f32 = 5.0;
const RUN_SPEED: f32 = 8.0;
const CROUCH_SPEED_MULT: f32 = 0.5;
const CROUCH_EYE_RATIO: f32 = 0.55;
/// Full crouch down / stand up transition (ease-in-out).
const CROUCH_TRANSITION_SEC: f32 = 0.32;
const GRAVITY: f32 = 22.0;
/// Mirrors GE2 `PlayerController.js` jump impulse.
const JUMP_VELOCITY: f32 = 8.5;
const MAX_PITCH: f32 = 1.48;
const WALK_BOB_AMPLITUDE_CM: f32 = 18.6;
const WALK_BOB_DURATION_SEC: f32 = 0.41;
const WALK_BOB_PITCH_SCALE: f32 = 0.9;
const WALK_BOB_ROLL_SCALE: f32 = 0.8;
const WALK_BOB_PITCH_PER_AMP: f32 = 0.008 / 0.034;
const WALK_BOB_ROLL_PER_AMP: f32 = 0.004 / 0.034;
const WALK_BOB_MIN_ACTIVITY_SPEED: f32 = 0.15;
pub const PLAYER_RADIUS: f32 = 0.4;
pub const EYE_HEIGHT: f32 = 1.8;
const SPAWN_X: f32 = 0.0;
const SPAWN_Y: f32 = EYE_HEIGHT;
const SPAWN_Z: f32 = -8.0;
const SPAWN_YAW: f32 = 0.0;

#[derive(Clone, Copy, Debug)]
pub struct PlayerState {
    pub x: f32,
    pub y: f32,
    pub z: f32,
    pub yaw: f32,
    pub pitch: f32,
    pub velocity_y: f32,
    pub on_ground: bool,
    pub invert_look_x: bool,
    pub invert_look_y: bool,
    pub look_tuning: LookTuning,
    pub mouse_look_vel: LookVelocity,
    pub keyboard_look_vel: LookVelocity,
    pub pending_mouse_dx: f32,
    pub pending_mouse_dy: f32,
    pub prev_jump: bool,
    pub eye_height: f32,
    pub walk_bob_enabled: bool,
    pub walk_bob_amplitude_cm: f32,
    pub walk_bob_duration_sec: f32,
    pub walk_bob_y: f32,
    pub walk_bob_pitch: f32,
    pub walk_bob_roll: f32,
    walk_bob_phase: f32,
    walk_bob_activity: f32,
    crouch_blend: CrouchBlend,
    pub falling_through_hole: bool,
    pub hole_fall_vel_y: f32,
}

#[derive(Clone, Copy, Debug)]
struct CrouchBlend {
    factor: f32,
    from: f32,
    to: f32,
    elapsed: f32,
}

impl Default for CrouchBlend {
    fn default() -> Self {
        Self {
            factor: 0.0,
            from: 0.0,
            to: 0.0,
            elapsed: 0.0,
        }
    }
}

impl CrouchBlend {
    fn tick(&mut self, want_crouch: bool, delta_seconds: f32) -> f32 {
        let target = if want_crouch { 1.0 } else { 0.0 };

        if (self.to - target).abs() > f32::EPSILON {
            self.from = self.factor;
            self.to = target;
            self.elapsed = 0.0;
        }

        if (self.factor - self.to).abs() < 1e-4 {
            self.factor = self.to;
            return self.factor;
        }

        self.elapsed = (self.elapsed + delta_seconds).min(CROUCH_TRANSITION_SEC);
        let t = (self.elapsed / CROUCH_TRANSITION_SEC).clamp(0.0, 1.0);
        let eased = ease_in_out_cubic(t);
        self.factor = self.from + (self.to - self.from) * eased;
        self.factor
    }
}

fn ease_in_out_cubic(t: f32) -> f32 {
    if t < 0.5 {
        4.0 * t * t * t
    } else {
        1.0 - (-2.0 * t + 2.0).powi(3) / 2.0
    }
}

fn eye_height_from_crouch_factor(factor: f32) -> f32 {
    EYE_HEIGHT * (1.0 - factor * (1.0 - CROUCH_EYE_RATIO))
}

impl Default for PlayerState {
    fn default() -> Self {
        Self {
            x: SPAWN_X,
            y: SPAWN_Y,
            z: SPAWN_Z,
            yaw: SPAWN_YAW,
            pitch: 0.0,
            velocity_y: 0.0,
            on_ground: true,
            invert_look_x: false,
            invert_look_y: false,
            look_tuning: LookTuning::default(),
            mouse_look_vel: LookVelocity::default(),
            keyboard_look_vel: LookVelocity::default(),
            pending_mouse_dx: 0.0,
            pending_mouse_dy: 0.0,
            prev_jump: false,
            eye_height: EYE_HEIGHT,
            walk_bob_enabled: true,
            walk_bob_amplitude_cm: WALK_BOB_AMPLITUDE_CM,
            walk_bob_duration_sec: WALK_BOB_DURATION_SEC,
            walk_bob_y: 0.0,
            walk_bob_pitch: 0.0,
            walk_bob_roll: 0.0,
            walk_bob_phase: 0.0,
            walk_bob_activity: 0.0,
            crouch_blend: CrouchBlend::default(),
            falling_through_hole: false,
            hole_fall_vel_y: -2.0,
        }
    }
}

impl PlayerState {
    pub fn foot_y(&self) -> f32 {
        self.y - self.eye_height
    }

    pub fn set_foot_y(&mut self, foot_y: f32) {
        self.y = foot_y + self.eye_height;
    }

    pub fn begin_hole_fall(&mut self) {
        self.falling_through_hole = true;
        self.hole_fall_vel_y = -2.0;
        self.on_ground = false;
        self.velocity_y = self.hole_fall_vel_y;
    }
}

impl PlayerState {
    pub fn reset_to_spawn(&mut self, spawn: LevelPlayerSpawn) {
        let look_tuning = self.look_tuning;
        let invert_look_x = self.invert_look_x;
        let invert_look_y = self.invert_look_y;
        let walk_bob_enabled = self.walk_bob_enabled;
        let walk_bob_amplitude_cm = self.walk_bob_amplitude_cm;
        let walk_bob_duration_sec = self.walk_bob_duration_sec;

        *self = Self::default();
        self.look_tuning = look_tuning;
        self.invert_look_x = invert_look_x;
        self.invert_look_y = invert_look_y;
        self.walk_bob_enabled = walk_bob_enabled;
        self.walk_bob_amplitude_cm = walk_bob_amplitude_cm;
        self.walk_bob_duration_sec = walk_bob_duration_sec;
        self.x = spawn.x;
        self.z = spawn.z;
        self.yaw = spawn.yaw;
        self.eye_height = EYE_HEIGHT;
        self.y = spawn.foot_y + self.eye_height;
    }

    pub fn reset(&mut self) {
        self.reset_to_spawn(LevelPlayerSpawn {
            x: SPAWN_X,
            z: SPAWN_Z,
            foot_y: 0.0,
            yaw: SPAWN_YAW,
        });
    }

    pub fn set_invert_look_x(&mut self, invert: bool) {
        self.invert_look_x = invert;
    }

    pub fn set_invert_look_y(&mut self, invert: bool) {
        self.invert_look_y = invert;
    }

    pub fn set_mouse_look_ease(&mut self, ease: f32) {
        self.look_tuning.mouse_look_ease = ease.max(0.0);
    }

    pub fn set_keyboard_look_ease(&mut self, ease: f32) {
        self.look_tuning.keyboard_look_ease = ease.max(0.0);
    }

    pub fn set_mouse_look_speed(&mut self, speed: f32) {
        self.look_tuning.mouse_look_speed = speed.max(0.1);
    }

    pub fn set_keyboard_look_speed(&mut self, speed: f32) {
        self.look_tuning.keyboard_look_speed = speed.max(0.1);
    }

    pub fn set_max_look_rate(&mut self, rate: f32) {
        self.look_tuning.max_look_rate = rate.max(0.5);
    }

    pub fn set_walk_bob_enabled(&mut self, enabled: bool) {
        self.walk_bob_enabled = enabled;
    }

    pub fn set_walk_bob_amplitude_cm(&mut self, amplitude_cm: f32) {
        self.walk_bob_amplitude_cm = amplitude_cm.clamp(0.0, 20.0);
    }

    pub fn set_walk_bob_duration_sec(&mut self, duration_sec: f32) {
        self.walk_bob_duration_sec = duration_sec.clamp(0.25, 1.2);
    }

    pub fn add_mouse_delta(&mut self, delta_x: f32, delta_y: f32) {
        self.pending_mouse_dx += delta_x;
        self.pending_mouse_dy += delta_y;
    }

    fn update_walk_bob(&mut self, horizontal_speed: f32, crouch_factor: f32, delta_seconds: f32) {
        let dt = delta_seconds.max(0.001);
        let fade = (-10.0 * dt).exp();
        let duration = self.walk_bob_duration_sec.clamp(0.25, 1.2);
        let duration_t = (duration - 0.25) / (1.2 - 0.25);
        let walk_smooth = 5.0 + (12.0 - 5.0) * duration_t;
        let walk_fade = 4.0 + (6.0 - 4.0) * duration_t;
        let bob_ease = 1.0 - (-walk_smooth * dt).exp();
        let moving = horizontal_speed > WALK_BOB_MIN_ACTIVITY_SPEED;
        let activity_target = if self.walk_bob_enabled && moving && self.on_ground {
            1.0
        } else {
            0.0
        };

        self.walk_bob_activity +=
            (activity_target - self.walk_bob_activity) * (1.0 - (-walk_fade * dt).exp());

        if activity_target < f32::EPSILON {
            self.walk_bob_activity *= fade;
            self.walk_bob_y *= fade;
            self.walk_bob_pitch *= fade;
            self.walk_bob_roll *= fade;
            self.walk_bob_phase = 0.0;
            if self.walk_bob_y.abs() < 1e-5
                && self.walk_bob_pitch.abs() < 1e-5
                && self.walk_bob_roll.abs() < 1e-5
            {
                self.walk_bob_y = 0.0;
                self.walk_bob_pitch = 0.0;
                self.walk_bob_roll = 0.0;
                self.walk_bob_activity = 0.0;
            }
            return;
        }

        if self.walk_bob_activity < 0.01 {
            self.walk_bob_y *= fade;
            self.walk_bob_pitch *= fade;
            self.walk_bob_roll *= fade;
            self.walk_bob_phase = 0.0;
            return;
        }

        let amp = self.walk_bob_amplitude_cm.clamp(0.0, 20.0) / 100.0;
        let cycle_hz = 1.0 / duration;
        let freq_share = 1.85 / (1.85 + 0.38 * WALK_SPEED.max(0.1));
        let bob_freq = cycle_hz * freq_share
            + horizontal_speed * ((cycle_hz * (1.0 - freq_share)) / WALK_SPEED.max(0.1));
        let speed_factor = (horizontal_speed / WALK_SPEED.max(0.1)).clamp(0.4, 1.2);
        let crouch_scale = 1.0 - crouch_factor * (1.0 - CROUCH_EYE_RATIO);
        let intensity = speed_factor * crouch_scale * self.walk_bob_activity;

        self.walk_bob_phase += dt * bob_freq * std::f32::consts::TAU * self.walk_bob_activity;

        let target_y = self.walk_bob_phase.sin() * amp * intensity;
        let target_pitch = self.walk_bob_phase.cos()
            * amp
            * WALK_BOB_PITCH_PER_AMP
            * WALK_BOB_PITCH_SCALE
            * intensity;
        let target_roll = (self.walk_bob_phase * 0.5).sin()
            * amp
            * WALK_BOB_ROLL_PER_AMP
            * WALK_BOB_ROLL_SCALE
            * intensity;

        self.walk_bob_y += (target_y - self.walk_bob_y) * bob_ease;
        self.walk_bob_pitch += (target_pitch - self.walk_bob_pitch) * bob_ease;
        self.walk_bob_roll += (target_roll - self.walk_bob_roll) * bob_ease;
    }

    fn apply_look_input(&mut self, input: &InputState, delta_seconds: f32) {
        let raw_yaw = (input.look_right as i8 - input.look_left as i8) as f32;
        let want_yaw = if self.invert_look_x {
            -raw_yaw
        } else {
            raw_yaw
        };
        let raw_pitch = (input.look_up as i8 - input.look_down as i8) as f32;
        let want_pitch = if self.invert_look_y {
            -raw_pitch
        } else {
            raw_pitch
        };

        let look_input = LookInput {
            mouse_dx: self.pending_mouse_dx,
            mouse_dy: self.pending_mouse_dy,
            want_yaw,
            want_pitch,
        };

        update_mouse_look_velocity(
            &mut self.mouse_look_vel,
            look_input,
            self.look_tuning,
            delta_seconds,
        );
        update_keyboard_look_velocity(
            &mut self.keyboard_look_vel,
            look_input,
            self.look_tuning,
            delta_seconds,
        );

        clamp_look_velocities(
            &mut self.mouse_look_vel,
            &mut self.keyboard_look_vel,
            self.look_tuning.max_look_rate,
        );
        apply_look_velocities(
            &mut self.yaw,
            &mut self.pitch,
            self.mouse_look_vel,
            self.keyboard_look_vel,
            self.look_tuning.max_look_rate,
            MAX_PITCH,
            delta_seconds,
        );

        self.pending_mouse_dx = 0.0;
        self.pending_mouse_dy = 0.0;
    }

    pub fn tick(&mut self, input: &InputState, delta_seconds: f32, world: &super::world::World) {
        self.apply_look_input(input, delta_seconds);

        if self.falling_through_hole {
            world.tick_hole_fall(self, delta_seconds);
            self.walk_bob_y = 0.0;
            self.walk_bob_pitch = 0.0;
            self.walk_bob_roll = 0.0;
            self.walk_bob_activity = 0.0;
            return;
        }

        let mut move_x = 0.0;
        let mut move_z = 0.0;

        if input.forward {
            move_x += self.yaw.sin();
            move_z += self.yaw.cos();
        }
        if input.backward {
            move_x -= self.yaw.sin();
            move_z -= self.yaw.cos();
        }
        if input.left {
            move_x -= self.yaw.cos();
            move_z += self.yaw.sin();
        }
        if input.right {
            move_x += self.yaw.cos();
            move_z -= self.yaw.sin();
        }

        let move_len = (move_x * move_x + move_z * move_z).sqrt();
        if move_len > 0.0 {
            move_x /= move_len;
            move_z /= move_len;
        }

        let mut speed = WALK_SPEED;
        let crouch_factor = self.crouch_blend.tick(input.crouch, delta_seconds);
        self.eye_height = eye_height_from_crouch_factor(crouch_factor);

        if crouch_factor > f32::EPSILON {
            let crouch_speed_mult = 1.0 - crouch_factor * (1.0 - CROUCH_SPEED_MULT);
            speed *= crouch_speed_mult;
        } else if input.sprint && self.on_ground {
            speed = RUN_SPEED;
        }

        let horizontal_speed = move_len * speed;
        let prev_x = self.x;
        let prev_z = self.z;
        self.x += move_x * speed * delta_seconds;
        self.z += move_z * speed * delta_seconds;

        if self.on_ground
            && world.blocks_walk_onto_ledge(
                self.x,
                self.z,
                self.y,
                self.foot_y(),
                self.eye_height,
            )
        {
            self.x = prev_x;
            self.z = prev_z;
        }

        if input.jump && !self.prev_jump && self.on_ground && crouch_factor < 0.05 && !input.crouch
        {
            self.velocity_y = JUMP_VELOCITY;
            self.on_ground = false;
        }
        self.prev_jump = input.jump;

        if self.on_ground {
            self.velocity_y = 0.0;
        } else {
            self.velocity_y -= GRAVITY * delta_seconds;
        }

        self.y += self.velocity_y * delta_seconds;
        world.resolve_player(self, self.eye_height);
        self.update_walk_bob(horizontal_speed, crouch_factor, delta_seconds);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::input::InputState;
    use crate::world::World;

    #[test]
    fn mouse_horizontal_delta_changes_yaw() {
        let mut player = PlayerState::default();
        let input = InputState::default();
        let world = crate::level_config::square_arena_world();

        player.add_mouse_delta(10.0, 0.0);
        player.tick(&input, 1.0 / 60.0, &world);

        assert!(player.yaw > 0.0);
    }

    #[test]
    fn mouse_left_delta_pans_left() {
        let mut player = PlayerState::default();
        let input = InputState::default();
        let world = crate::level_config::square_arena_world();

        player.add_mouse_delta(-10.0, 0.0);
        player.tick(&input, 1.0 / 60.0, &world);

        assert!(player.yaw < 0.0);
    }

    #[test]
    fn mouse_vertical_delta_changes_pitch() {
        let mut player = PlayerState::default();
        let input = InputState::default();
        let world = crate::level_config::square_arena_world();

        player.add_mouse_delta(0.0, 10.0);
        player.tick(&input, 1.0 / 60.0, &world);

        assert!(player.pitch > 0.0);
    }

    #[test]
    fn arrow_left_and_right_pan_in_matching_directions() {
        let mut left = PlayerState::default();
        let mut right = PlayerState::default();
        let mut input = InputState::default();
        let world = crate::level_config::square_arena_world();

        input.look_left = true;
        for _ in 0..20 {
            left.tick(&input, 1.0 / 60.0, &world);
        }
        input.look_left = false;
        input.look_right = true;
        for _ in 0..20 {
            right.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(left.yaw < 0.0);
        assert!(right.yaw > 0.0);
    }

    #[test]
    fn invert_look_x_flips_arrow_pan() {
        let mut player = PlayerState {
            invert_look_x: true,
            ..PlayerState::default()
        };
        let mut input = InputState::default();
        input.look_right = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..20 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.yaw < 0.0);
    }

    #[test]
    fn invert_look_y_flips_arrow_pan() {
        let mut player = PlayerState {
            invert_look_y: true,
            ..PlayerState::default()
        };
        let mut input = InputState::default();
        input.look_up = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..20 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.pitch < 0.0);
    }

    #[test]
    fn arrow_up_and_down_pan_in_matching_directions() {
        let mut up = PlayerState::default();
        let mut down = PlayerState::default();
        let mut input = InputState::default();
        let world = crate::level_config::square_arena_world();

        input.look_up = true;
        for _ in 0..20 {
            up.tick(&input, 1.0 / 60.0, &world);
        }
        input.look_up = false;
        input.look_down = true;
        for _ in 0..20 {
            down.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(up.pitch > 0.0);
        assert!(down.pitch < 0.0);
    }

    #[test]
    fn a_and_d_move_left_and_right() {
        let mut left = PlayerState::default();
        let mut right = PlayerState::default();
        let mut input = InputState::default();
        let world = crate::level_config::square_arena_world();
        let start_x = left.x;

        input.left = true;
        left.tick(&input, 1.0, &world);
        input.left = false;
        input.right = true;
        right.tick(&input, 1.0, &world);

        assert!(left.x < start_x);
        assert!(right.x > start_x);
    }

    #[test]
    fn arrow_keys_rotate_view() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.look_right = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..20 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.yaw > 0.0);
    }

    #[test]
    fn player_moves_forward_with_w() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.forward = true;
        let world = crate::level_config::square_arena_world();

        player.tick(&input, 1.0, &world);

        assert!(player.z > SPAWN_Z);
    }

    #[test]
    fn walk_bob_activates_while_moving_on_ground() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.forward = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..30 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.walk_bob_activity > 0.0);
        assert!(
            player.walk_bob_y.abs() > 0.0
                || player.walk_bob_pitch.abs() > 0.0
                || player.walk_bob_roll.abs() > 0.0
        );
    }

    #[test]
    fn walk_bob_fades_when_disabled() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.forward = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..30 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        player.set_walk_bob_enabled(false);
        input.forward = false;
        for _ in 0..60 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.walk_bob_y.abs() < 0.001);
        assert!(player.walk_bob_pitch.abs() < 0.001);
        assert!(player.walk_bob_roll.abs() < 0.001);
    }

    #[test]
    fn walk_bob_settles_when_movement_stops() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.forward = true;
        let world = crate::level_config::square_arena_world();

        for _ in 0..40 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        input.forward = false;
        for _ in 0..90 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.walk_bob_y.abs() < 0.001);
        assert!(player.walk_bob_pitch.abs() < 0.001);
        assert!(player.walk_bob_roll.abs() < 0.001);
        assert!(player.walk_bob_activity < 0.01);
    }

    #[test]
    fn jump_reaches_configured_height() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        let world = crate::level_config::square_arena_world();
        let start_y = player.y;

        input.jump = true;
        player.tick(&input, 1.0 / 120.0, &world);
        input.jump = false;

        let mut peak = player.y;
        for _ in 0..240 {
            player.tick(&input, 1.0 / 120.0, &world);
            peak = peak.max(player.y);
        }

        assert!((peak - (start_y + 1.64)).abs() < 0.08);
    }

    #[test]
    fn crouch_lowers_camera_with_ease_in_out() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        let world = crate::level_config::square_arena_world();
        let stand_y = player.y;

        input.crouch = true;
        for _ in 0..6 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.y < stand_y);
        let mid_y = player.y;

        for _ in 0..24 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        let crouch_y = player.y;
        assert!(crouch_y < mid_y);

        input.crouch = false;
        for _ in 0..6 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!(player.y > crouch_y);
        assert!(player.y < stand_y);

        for _ in 0..24 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!((player.y - stand_y).abs() < 0.03);
        assert!((player.eye_height - EYE_HEIGHT).abs() < 0.03);
    }

    #[test]
    fn crouch_eye_height_eases_toward_target() {
        let mut player = PlayerState::default();
        let mut input = InputState::default();
        input.crouch = true;
        let world = crate::level_config::square_arena_world();

        assert!((player.eye_height - EYE_HEIGHT).abs() < 0.001);

        for _ in 0..12 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        let crouch_eye = EYE_HEIGHT * CROUCH_EYE_RATIO;
        assert!(player.eye_height < EYE_HEIGHT);
        assert!(player.eye_height > crouch_eye + 0.05);

        input.crouch = false;
        for _ in 0..60 {
            player.tick(&input, 1.0 / 60.0, &world);
        }

        assert!((player.eye_height - EYE_HEIGHT).abs() < 0.02);
    }
}
