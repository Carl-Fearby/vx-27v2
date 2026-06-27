pub struct DeathState {
    pub active: bool,
    pub reason: String,
    pub min_display_end_ms: f64,
    pub fade_end_ms: f64,
}

impl Default for DeathState {
    fn default() -> Self {
        Self {
            active: false,
            reason: String::new(),
            min_display_end_ms: 0.0,
            fade_end_ms: f64::INFINITY,
        }
    }
}

impl DeathState {
    pub fn clear(&mut self) {
        *self = Self::default();
    }
}

pub fn player_death_reason(kind: &str) -> &'static str {
    match kind {
        "fall" => "You fell to your death",
        "suicide" => "Suicide is never the answer",
        _ => "You were killed by an enemy",
    }
}

pub fn should_trigger_death(
    death_active: bool,
    foot_y: f32,
    floor_foot_y: f32,
    fall_drop: f32,
) -> bool {
    !death_active && foot_y < floor_foot_y - fall_drop
}
