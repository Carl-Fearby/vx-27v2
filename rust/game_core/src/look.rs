const MOUSE_SENS_BASE: f32 = 0.0022;
const ARROW_MAX_SPEED_BASE: f32 = 2.2;
const ARROW_ACCEL_BASE: f32 = 5.6;
const MOUSE_ACCEL_BASE: f32 = 5.6;
const LOOK_DAMP: f32 = 5.5;

pub const DEFAULT_MOUSE_LOOK_SPEED: f32 = 7.0;
pub const DEFAULT_MOUSE_LOOK_EASE: f32 = 1.0;
pub const DEFAULT_KEYBOARD_LOOK_SPEED: f32 = 5.0;
pub const DEFAULT_KEYBOARD_LOOK_EASE: f32 = 0.0;
pub const DEFAULT_MAX_LOOK_RATE: f32 = 10.0;

#[derive(Clone, Copy, Debug, Default)]
pub struct LookVelocity {
    pub yaw: f32,
    pub pitch: f32,
}

#[derive(Clone, Copy, Debug)]
pub struct LookTuning {
    pub mouse_look_speed: f32,
    pub mouse_look_ease: f32,
    pub keyboard_look_speed: f32,
    pub keyboard_look_ease: f32,
    pub max_look_rate: f32,
}

impl Default for LookTuning {
    fn default() -> Self {
        Self {
            mouse_look_speed: DEFAULT_MOUSE_LOOK_SPEED,
            mouse_look_ease: DEFAULT_MOUSE_LOOK_EASE,
            keyboard_look_speed: DEFAULT_KEYBOARD_LOOK_SPEED,
            keyboard_look_ease: DEFAULT_KEYBOARD_LOOK_EASE,
            max_look_rate: DEFAULT_MAX_LOOK_RATE,
        }
    }
}

#[derive(Clone, Copy, Debug, Default)]
pub struct LookInput {
    pub mouse_dx: f32,
    pub mouse_dy: f32,
    pub want_yaw: f32,
    pub want_pitch: f32,
}

pub fn update_mouse_look_velocity(
    velocity: &mut LookVelocity,
    input: LookInput,
    tuning: LookTuning,
    delta_seconds: f32,
) {
    let dt = delta_seconds.max(0.001);
    let inv_dt = 1.0 / dt;
    let signed_dx = input.mouse_dx;
    let signed_dy = input.mouse_dy;

    let mouse_sens = MOUSE_SENS_BASE * tuning.mouse_look_speed;
    let target_yaw = signed_dx * mouse_sens * inv_dt;
    let target_pitch = signed_dy * mouse_sens * inv_dt;

    if tuning.mouse_look_ease <= 0.0 {
        velocity.yaw = target_yaw;
        velocity.pitch = target_pitch;
    } else {
        let mouse_accel = MOUSE_ACCEL_BASE / tuning.mouse_look_ease;
        let ease = 1.0 - (-mouse_accel * dt).exp();
        velocity.yaw += (target_yaw - velocity.yaw) * ease;
        velocity.pitch += (target_pitch - velocity.pitch) * ease;

        let damp = (-LOOK_DAMP * dt).exp();
        if input.mouse_dx == 0.0 {
            velocity.yaw *= damp;
        }
        if input.mouse_dy == 0.0 {
            velocity.pitch *= damp;
        }
    }
}

pub fn update_keyboard_look_velocity(
    velocity: &mut LookVelocity,
    input: LookInput,
    tuning: LookTuning,
    delta_seconds: f32,
) {
    let dt = delta_seconds.max(0.001);
    let arrow_max_speed = ARROW_MAX_SPEED_BASE * tuning.keyboard_look_speed;
    let target_yaw = input.want_yaw * arrow_max_speed;
    let target_pitch = input.want_pitch * arrow_max_speed;

    if tuning.keyboard_look_ease <= 0.0 {
        velocity.yaw = target_yaw;
        velocity.pitch = target_pitch;
    } else {
        let arrow_accel = ARROW_ACCEL_BASE / tuning.keyboard_look_ease;
        let ease = 1.0 - (-arrow_accel * dt).exp();
        velocity.yaw += (target_yaw - velocity.yaw) * ease;
        velocity.pitch += (target_pitch - velocity.pitch) * ease;
    }

    let damp = (-LOOK_DAMP * dt).exp();
    if input.want_yaw == 0.0 {
        velocity.yaw *= damp;
    }
    if input.want_pitch == 0.0 {
        velocity.pitch *= damp;
    }
}

pub fn clamp_look_velocities(
    mouse_velocity: &mut LookVelocity,
    keyboard_velocity: &mut LookVelocity,
    max_look_rate: f32,
) {
    let max_rate = max_look_rate.max(0.5);
    mouse_velocity.yaw = mouse_velocity.yaw.clamp(-max_rate, max_rate);
    mouse_velocity.pitch = mouse_velocity.pitch.clamp(-max_rate, max_rate);
    keyboard_velocity.yaw = keyboard_velocity.yaw.clamp(-max_rate, max_rate);
    keyboard_velocity.pitch = keyboard_velocity.pitch.clamp(-max_rate, max_rate);
}

pub fn apply_look_velocities(
    yaw: &mut f32,
    pitch: &mut f32,
    mouse_velocity: LookVelocity,
    keyboard_velocity: LookVelocity,
    max_look_rate: f32,
    max_pitch: f32,
    delta_seconds: f32,
) {
    let max_delta = max_look_rate.max(0.5) * delta_seconds;

    *yaw += (mouse_velocity.yaw * delta_seconds).clamp(-max_delta, max_delta);
    *yaw += (keyboard_velocity.yaw * delta_seconds).clamp(-max_delta, max_delta);
    *pitch += (mouse_velocity.pitch * delta_seconds).clamp(-max_delta, max_delta);
    *pitch += (keyboard_velocity.pitch * delta_seconds).clamp(-max_delta, max_delta);
    *pitch = pitch.clamp(-max_pitch, max_pitch);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn mouse_easing_reaches_target_over_multiple_frames() {
        let mut velocity = LookVelocity::default();
        let tuning = LookTuning::default();
        let input = LookInput {
            mouse_dx: 12.0,
            mouse_dy: 0.0,
            want_yaw: 0.0,
            want_pitch: 0.0,
        };

        for _ in 0..30 {
            update_mouse_look_velocity(&mut velocity, input, tuning, 1.0 / 60.0);
        }

        assert!(velocity.yaw > 0.0);
    }

    #[test]
    fn keyboard_ease_zero_snaps_to_target_velocity() {
        let mut velocity = LookVelocity::default();
        let tuning = LookTuning {
            keyboard_look_ease: 0.0,
            ..LookTuning::default()
        };
        let input = LookInput {
            mouse_dx: 0.0,
            mouse_dy: 0.0,
            want_yaw: 1.0,
            want_pitch: 0.0,
        };

        update_keyboard_look_velocity(&mut velocity, input, tuning, 1.0 / 60.0);

        assert!((velocity.yaw - ARROW_MAX_SPEED_BASE * DEFAULT_KEYBOARD_LOOK_SPEED).abs() < 0.001);
    }
}
