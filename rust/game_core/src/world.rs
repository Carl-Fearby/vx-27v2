use crate::floor_hole::{
    is_committed_over_floor_hole, point_in_floor_hole, FloorHole, HOLE_FALL_GRAVITY,
    HOLE_FALL_REMOVE_DEPTH,
};
use crate::level_config::LevelPlayerSpawn;
use crate::player::{PlayerState, EYE_HEIGHT, PLAYER_RADIUS};

/** Mirrors GE2 `PlayerController.js` `STEP_UP_MAX`. */
const STEP_UP_MAX: f32 = 0.45;
const STEP_UP_SLACK: f32 = 0.06;
const ELEVATED_FOOT_SLACK: f32 = 0.12;

const FOOT_SAMPLE_OFFSETS: [(f32, f32); 5] = [
    (0.0, 0.0),
    (PLAYER_RADIUS * 0.85, 0.0),
    (-PLAYER_RADIUS * 0.85, 0.0),
    (0.0, PLAYER_RADIUS * 0.85),
    (0.0, -PLAYER_RADIUS * 0.85),
];

#[derive(Clone, Copy, Debug)]
pub(crate) struct Aabb {
    min_x: f32,
    max_x: f32,
    min_z: f32,
    max_z: f32,
    stand_height: f32,
    /// Only the main arena deck is cut by `floorHoles` — elevated volumes stay solid.
    honor_floor_holes: bool,
    /// Decks you walk under (catwalk) — only support the player once they are near deck height.
    overhead_only: bool,
}

impl Aabb {
    fn contains_xz(&self, x: f32, z: f32, inset: f32) -> bool {
        x >= self.min_x + inset
            && x <= self.max_x - inset
            && z >= self.min_z + inset
            && z <= self.max_z - inset
    }

    fn stance_eye_height(&self, eye_height: f32) -> f32 {
        self.stand_height * (eye_height / EYE_HEIGHT)
    }

    fn floor_support_eye(&self, x: f32, z: f32, eye_height: f32, floor_holes: &[FloorHole]) -> Option<f32> {
        if !self.honor_floor_holes {
            return None;
        }
        if !self.contains_xz(x, z, PLAYER_RADIUS) {
            return None;
        }
        let hole_inset = if self.stand_height <= EYE_HEIGHT + 0.01 {
            PLAYER_RADIUS
        } else {
            0.0
        };
        if point_in_floor_hole(x, z, floor_holes, hole_inset) {
            return None;
        }
        Some(self.stance_eye_height(eye_height))
    }

    fn elevated_support_eye(&self, x: f32, z: f32, eye_height: f32) -> Option<f32> {
        if self.honor_floor_holes {
            return None;
        }
        for (offset_x, offset_z) in FOOT_SAMPLE_OFFSETS {
            if self.contains_xz(x + offset_x, z + offset_z, 0.0) {
                return Some(self.stance_eye_height(eye_height));
            }
        }
        None
    }

    fn main_deck_support_eye(&self, x: f32, z: f32, floor_holes: &[FloorHole]) -> Option<f32> {
        self.floor_support_eye(x, z, EYE_HEIGHT, floor_holes)
    }
}

#[derive(Clone, Debug)]
pub struct World {
    platform_half: f32,
    floor_foot_y: f32,
    surfaces: Vec<Aabb>,
    floor_holes: Vec<FloorHole>,
    player_spawn: LevelPlayerSpawn,
}

impl Default for World {
    fn default() -> Self {
        Self {
            platform_half: 20.0,
            floor_foot_y: 0.0,
            surfaces: Vec::new(),
            floor_holes: Vec::new(),
            player_spawn: LevelPlayerSpawn {
                x: 0.0,
                z: -8.0,
                foot_y: 0.0,
                yaw: 0.0,
            },
        }
    }
}

impl World {
    pub(crate) fn flat_surface(
        min_x: f32,
        max_x: f32,
        min_z: f32,
        max_z: f32,
        foot_y: f32,
        honor_floor_holes: bool,
        overhead_only: bool,
    ) -> Aabb {
        Aabb {
            min_x,
            max_x,
            min_z,
            max_z,
            stand_height: foot_y + EYE_HEIGHT,
            honor_floor_holes,
            overhead_only,
        }
    }

    pub(crate) fn new(
        platform_half: f32,
        floor_foot_y: f32,
        floor_holes: Vec<FloorHole>,
        surfaces: Vec<Aabb>,
        player_spawn: LevelPlayerSpawn,
    ) -> Self {
        Self {
            platform_half,
            floor_foot_y,
            surfaces,
            floor_holes,
            player_spawn,
        }
    }

    pub fn from_level_json(json: &str) -> Result<Self, String> {
        crate::level_config::world_from_level_json(json)
    }

    pub fn player_spawn(&self) -> LevelPlayerSpawn {
        self.player_spawn
    }

    pub fn floor_foot_y(&self) -> f32 {
        self.floor_foot_y
    }

    fn floor_support_eye(&self, x: f32, z: f32, eye_height: f32) -> Option<f32> {
        for surface in &self.surfaces {
            if let Some(height) = surface.floor_support_eye(x, z, eye_height, &self.floor_holes) {
                return Some(height);
            }
        }
        None
    }

    fn elevated_support_eye(
        &self,
        x: f32,
        z: f32,
        eye_height: f32,
        current_foot_y: f32,
    ) -> Option<f32> {
        let mut best: Option<f32> = None;
        for surface in &self.surfaces {
            if surface.overhead_only {
                let surface_foot_y = surface.stand_height - EYE_HEIGHT;
                if current_foot_y < surface_foot_y - ELEVATED_FOOT_SLACK {
                    continue;
                }
            }
            if let Some(height) = surface.elevated_support_eye(x, z, eye_height) {
                best = Some(best.map_or(height, |current| current.max(height)));
            }
        }
        best
    }

    fn support_eye_height(&self, x: f32, z: f32, current_foot_y: f32, eye_height: f32) -> Option<f32> {
        let floor = self.floor_support_eye(x, z, eye_height);
        let elevated = self.elevated_support_eye(x, z, eye_height, current_foot_y);

        if let Some(elev_eye) = elevated {
            let elev_foot = elev_eye - eye_height;
            if current_foot_y >= self.floor_foot_y() + ELEVATED_FOOT_SLACK
                || current_foot_y >= elev_foot - ELEVATED_FOOT_SLACK
            {
                return Some(match floor {
                    Some(floor_eye) => floor_eye.max(elev_eye),
                    None => elev_eye,
                });
            }
        }

        match (floor, elevated) {
            (Some(floor_eye), Some(elev_eye)) => Some(floor_eye.max(elev_eye)),
            (Some(floor_eye), None) => Some(floor_eye),
            (None, Some(elev_eye)) => Some(elev_eye),
            (None, None) => None,
        }
    }

    fn main_floor_support_eye(&self, x: f32, z: f32) -> Option<f32> {
        for surface in &self.surfaces {
            if let Some(height) = surface.main_deck_support_eye(x, z, &self.floor_holes) {
                return Some(height);
            }
        }
        None
    }

    fn support_foot_y(&self, x: f32, z: f32) -> Option<f32> {
        self.support_eye_height(x, z, self.floor_foot_y, EYE_HEIGHT)
            .map(|eye| eye - EYE_HEIGHT)
    }

    pub fn try_begin_hole_fall(&self, player: &mut PlayerState) {
        if player.falling_through_hole || self.floor_holes.is_empty() {
            return;
        }

        if self.main_floor_support_eye(player.x, player.z).is_some() {
            return;
        }

        if !is_committed_over_floor_hole(player.x, player.z, &self.floor_holes) {
            return;
        }

        let foot_y = player.foot_y();
        if foot_y > self.floor_foot_y() + 0.12 {
            return;
        }

        if let Some(support_foot) = self.support_foot_y(player.x, player.z) {
            if support_foot > self.floor_foot_y() + 0.05 {
                return;
            }
        }

        player.begin_hole_fall();
    }

    pub fn tick_hole_fall(&self, player: &mut PlayerState, delta_seconds: f32) {
        player.hole_fall_vel_y -= HOLE_FALL_GRAVITY * delta_seconds;
        let foot_y = player.foot_y() + player.hole_fall_vel_y * delta_seconds;
        player.set_foot_y(foot_y);
        player.on_ground = false;
    }

    pub fn hole_fall_should_die(&self, player: &PlayerState) -> bool {
        player.falling_through_hole
            && player.foot_y() < self.floor_foot_y() - HOLE_FALL_REMOVE_DEPTH
    }

    pub fn blocks_walk_onto_ledge(
        &self,
        x: f32,
        z: f32,
        current_eye: f32,
        current_foot_y: f32,
        eye_height: f32,
    ) -> bool {
        let Some(support) = self.support_eye_height(x, z, current_foot_y, eye_height) else {
            return false;
        };
        support - current_eye > STEP_UP_MAX + STEP_UP_SLACK
    }

    pub fn resolve_player(&self, player: &mut PlayerState, eye_height: f32) {
        if player.falling_through_hole {
            return;
        }

        let min_bound = -self.platform_half + PLAYER_RADIUS;
        let max_bound = self.platform_half - PLAYER_RADIUS;
        player.x = player.x.clamp(min_bound, max_bound);
        player.z = player.z.clamp(min_bound, max_bound);

        let foot_y = player.foot_y();
        if let Some(height) = self.support_eye_height(player.x, player.z, foot_y, eye_height) {
            let rise = height - player.y;

            if player.on_ground {
                if rise.abs() <= 0.02 {
                    player.y = height;
                    player.velocity_y = 0.0;
                } else if rise > 0.0 && rise <= STEP_UP_MAX + STEP_UP_SLACK {
                    player.y = height;
                    player.velocity_y = 0.0;
                } else if rise < 0.0 && rise >= -(STEP_UP_MAX + STEP_UP_SLACK) {
                    player.y = height;
                    player.velocity_y = 0.0;
                } else if rise < -(STEP_UP_MAX + STEP_UP_SLACK) {
                    player.on_ground = false;
                } else if rise > STEP_UP_MAX + STEP_UP_SLACK && foot_y >= self.floor_foot_y() + ELEVATED_FOOT_SLACK {
                    // Stay on current elevated surface when hugging an edge.
                    return;
                }
                return;
            }

            if player.y <= height {
                player.y = height;
                player.velocity_y = 0.0;
                player.on_ground = true;
                return;
            }
        }

        player.on_ground = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::level_config::square_arena_world;
    use crate::player::PlayerState;

    #[test]
    fn keeps_player_inside_platform_bounds() {
        let world = square_arena_world();
        let mut player = PlayerState::default();
        player.x = 100.0;
        player.z = -100.0;

        world.resolve_player(&mut player, EYE_HEIGHT);

        assert!(player.x <= world.platform_half);
        assert!(player.z >= -world.platform_half);
    }

    #[test]
    fn hole_excludes_main_floor_support_at_centre() {
        let world = square_arena_world();
        let mut player = PlayerState::default();
        player.x = -8.0;
        player.z = 2.0;

        world.try_begin_hole_fall(&mut player);
        assert!(player.falling_through_hole);
    }

    #[test]
    fn main_floor_keeps_rim_support() {
        let world = square_arena_world();
        let mut player = PlayerState::default();
        player.x = -8.0 + 1.35;
        player.z = 2.0;

        world.try_begin_hole_fall(&mut player);
        assert!(!player.falling_through_hole);
    }

    #[test]
    fn elevated_surfaces_ignore_floor_holes() {
        let world = square_arena_world();
        let catwalk_foot_y = 4.0 + 0.22;
        let catwalk_eye =
            world.support_eye_height(10.0, 0.0, catwalk_foot_y, EYE_HEIGHT);
        assert!(catwalk_eye.is_some());
        assert!(catwalk_eye.unwrap() > EYE_HEIGHT + 2.0);
    }

    #[test]
    fn floor_under_catwalk_does_not_snap_or_block() {
        let world = square_arena_world();
        let floor_foot_y = world.floor_foot_y();
        let under_catwalk = world.support_eye_height(10.0, 0.0, floor_foot_y, EYE_HEIGHT);
        assert!(under_catwalk.is_some());
        assert!((under_catwalk.unwrap() - EYE_HEIGHT).abs() < 0.01);
        assert!(!world.blocks_walk_onto_ledge(
            10.0,
            0.0,
            EYE_HEIGHT,
            floor_foot_y,
            EYE_HEIGHT,
        ));
    }

    #[test]
    fn blocks_tall_ledge_without_jump() {
        let world = square_arena_world();
        let floor_foot_y = world.floor_foot_y();
        assert!(world.blocks_walk_onto_ledge(
            -11.5,
            -13.0,
            EYE_HEIGHT,
            floor_foot_y,
            EYE_HEIGHT,
        ));
        assert!(!world.blocks_walk_onto_ledge(
            -14.0,
            -15.5,
            EYE_HEIGHT,
            floor_foot_y,
            EYE_HEIGHT,
        ));
    }

    #[test]
    fn low_block_steps_up_on_ground() {
        let world = square_arena_world();
        let mut player = PlayerState::default();
        player.x = -14.0;
        player.z = -15.5;
        player.on_ground = true;

        world.resolve_player(&mut player, EYE_HEIGHT);

        assert!(player.y > EYE_HEIGHT + 0.4);
        assert!(player.on_ground);
    }

    #[test]
    fn elevated_support_uses_foot_samples_near_edge() {
        let world = square_arena_world();
        let center = world
            .support_eye_height(-14.0, -15.5, 0.5, EYE_HEIGHT)
            .unwrap();
        let edge = world
            .support_eye_height(-14.85, -15.5, 0.5, EYE_HEIGHT)
            .unwrap();
        assert!(edge > EYE_HEIGHT + 0.4);
        assert!((edge - center).abs() < 0.01);
    }

    #[test]
    fn jump_blocks_raise_support_height() {
        let world = square_arena_world();
        let floor_foot_y = world.floor_foot_y();
        let low = world
            .support_eye_height(-14.0, -15.5, floor_foot_y, EYE_HEIGHT)
            .unwrap();
        let mid = world
            .support_eye_height(-11.5, -13.0, floor_foot_y, EYE_HEIGHT)
            .unwrap();
        let high = world
            .support_eye_height(-9.0, -10.5, floor_foot_y, EYE_HEIGHT)
            .unwrap();
        assert!(mid > low);
        assert!(high > mid);
    }

    #[test]
    fn hole_fall_waits_until_centre_leaves_main_deck() {
        let world = square_arena_world();
        let mut player = PlayerState::default();
        player.x = -8.0 + 1.35;
        player.z = 2.0;

        world.try_begin_hole_fall(&mut player);
        assert!(!player.falling_through_hole);

        player.x = -8.0 + 0.5;
        world.try_begin_hole_fall(&mut player);
        assert!(player.falling_through_hole);
    }
}
