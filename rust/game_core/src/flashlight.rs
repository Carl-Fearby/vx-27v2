/// Mirrors GameEngine2 `WeaponFlashlight.js`.
pub const HOTSPOT_INTENSITY: f32 = 32.0;
const RAISE_SPEED: f32 = 4.2;

#[derive(Clone, Copy, Debug, Default)]
pub struct FlashlightState {
    requested_on: bool,
    raise_blend: f32,
}

impl FlashlightState {
    /// GE2 `ViewWeapon.toggleFlashlight`.
    pub fn toggle(&mut self) {
        if !self.requested_on {
            self.requested_on = true;
            self.raise_blend = 0.0;
        } else {
            self.requested_on = false;
        }
    }

    pub fn raise_blend(&self) -> f32 {
        self.raise_blend
    }

    pub fn is_active(&self) -> bool {
        self.requested_on || self.raise_blend > 0.001
    }

    /// GE2 `ViewWeapon.update` raise loop — intensity only, not position.
    pub fn tick(&mut self, delta_seconds: f32) {
        let target = if self.requested_on { 1.0 } else { 0.0 };
        if self.raise_blend < target {
            self.raise_blend = (self.raise_blend + RAISE_SPEED * delta_seconds).min(target);
        } else if self.raise_blend > target {
            self.raise_blend = (self.raise_blend - RAISE_SPEED * delta_seconds).max(target);
        }
    }

    /// GE2 `flashlightNightScale`.
    pub fn night_scale(nightness: f32) -> f32 {
        let t = nightness.clamp(0.0, 1.0);
        lerp(0.42, 1.0, t * t)
    }

    pub fn intensity_scale(&self, nightness: f32) -> f32 {
        if !self.is_active() {
            return 0.0;
        }
        let night = Self::night_scale(nightness);
        let raise = lerp(0.55, 1.0, self.raise_blend * self.raise_blend);
        night * raise
    }

    pub fn intensity(&self, nightness: f32) -> f32 {
        HOTSPOT_INTENSITY * self.intensity_scale(nightness)
    }
}

fn lerp(a: f32, b: f32, t: f32) -> f32 {
    a + (b - a) * t
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn toggle_resets_raise_on_arm() {
        let mut torch = FlashlightState {
            requested_on: true,
            raise_blend: 1.0,
        };
        torch.toggle();
        torch.toggle();
        assert!(torch.requested_on);
        assert!(torch.raise_blend() < 0.001);
    }

    #[test]
    fn raise_ramps_intensity() {
        let mut torch = FlashlightState {
            requested_on: true,
            raise_blend: 0.0,
        };
        let low = torch.intensity_scale(1.0);
        torch.raise_blend = 1.0;
        let high = torch.intensity_scale(1.0);
        assert!(high > low);
    }
}
