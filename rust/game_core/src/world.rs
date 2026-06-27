use crate::floor_hole::{
    default_floor_holes, is_committed_over_floor_hole, point_in_floor_hole, FloorHole,
    FLOOR_FOOT_Y, HOLE_FALL_GRAVITY, HOLE_FALL_REMOVE_DEPTH,
};
use crate::player::{PlayerState, EYE_HEIGHT, PLAYER_RADIUS};

const PLATFORM_HALF_EXTENT: f32 = 20.0;

#[derive(Clone, Copy, Debug)]
struct Aabb {
    min_x: f32,
    max_x: f32,
    min_z: f32,
    max_z: f32,
    stand_height: f32,
    /// Only the main arena deck is cut by `floorHoles` — elevated volumes stay solid.
    honor_floor_holes: bool,
}

impl Aabb {
    fn contains_feet(&self, x: f32, z: f32) -> bool {
        x >= self.min_x + PLAYER_RADIUS
            && x <= self.max_x - PLAYER_RADIUS
            && z >= self.min_z + PLAYER_RADIUS
            && z <= self.max_z - PLAYER_RADIUS
    }

    fn top_at(&self, x: f32, z: f32, floor_holes: &[FloorHole]) -> Option<f32> {
        if !self.contains_feet(x, z) {
            return None;
        }
        if self.honor_floor_holes {
            // GE2 `hasImplicitFloorSupport` — shrink the pit for footing so the rim
            // stays walkable until the body centre reaches the edge.
            let hole_inset = if self.stand_height <= EYE_HEIGHT + 0.01 {
                PLAYER_RADIUS
            } else {
                0.0
            };
            if point_in_floor_hole(x, z, floor_holes, hole_inset) {
                return None;
            }
        }
        Some(self.stand_height)
    }

    fn main_deck_support_eye(&self, x: f32, z: f32, floor_holes: &[FloorHole]) -> Option<f32> {
        if !self.honor_floor_holes {
            return None;
        }
        self.top_at(x, z, floor_holes)
    }
}

#[derive(Clone, Debug)]
pub struct World {
    surfaces: Vec<Aabb>,
    floor_holes: Vec<FloorHole>,
}

impl Default for World {
    fn default() -> Self {
        Self {
            surfaces: vec![
                Aabb {
                    min_x: -PLATFORM_HALF_EXTENT,
                    max_x: PLATFORM_HALF_EXTENT,
                    min_z: -PLATFORM_HALF_EXTENT,
                    max_z: PLATFORM_HALF_EXTENT,
                    stand_height: EYE_HEIGHT,
                    honor_floor_holes: true,
                },
                Aabb {
                    min_x: -11.0,
                    max_x: -5.0,
                    min_z: -1.0,
                    max_z: 9.0,
                    stand_height: 1.1,
                    honor_floor_holes: false,
                },
                Aabb {
                    min_x: 4.8,
                    max_x: 7.2,
                    min_z: 0.8,
                    max_z: 3.2,
                    stand_height: 4.9,
                    honor_floor_holes: false,
                },
            ],
            floor_holes: default_floor_holes(),
        }
    }
}

impl World {
    pub fn floor_foot_y(&self) -> f32 {
        FLOOR_FOOT_Y
    }

    fn support_eye_height(&self, x: f32, z: f32, eye_height: f32) -> Option<f32> {
        let mut ground_height: Option<f32> = None;

        for surface in &self.surfaces {
            if let Some(height) = surface.top_at(x, z, &self.floor_holes) {
                let stance_height = height * (eye_height / EYE_HEIGHT);
                ground_height = Some(
                    ground_height.map_or(stance_height, |current: f32| current.max(stance_height)),
                );
            }
        }

        ground_height
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
        self.support_eye_height(x, z, EYE_HEIGHT)
            .map(|eye| eye - EYE_HEIGHT)
    }

    pub fn try_begin_hole_fall(&self, player: &mut PlayerState) {
        if player.falling_through_hole || self.floor_holes.is_empty() {
            return;
        }

        // Collision keeps the capsule centre on solid deck — don't peel off the rim
        // just because a foot sample hangs over the pit.
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

        // GE2 `tryBeginHoleFall` — elevated decks above the arena floor block pit entry.
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

    pub fn resolve_player(&self, player: &mut PlayerState, eye_height: f32) {
        if player.falling_through_hole {
            return;
        }

        let min_bound = -PLATFORM_HALF_EXTENT + PLAYER_RADIUS;
        let max_bound = PLATFORM_HALF_EXTENT - PLAYER_RADIUS;
        player.x = player.x.clamp(min_bound, max_bound);
        player.z = player.z.clamp(min_bound, max_bound);

        if let Some(height) = self.support_eye_height(player.x, player.z, eye_height) {
            if player.on_ground {
                player.y = height;
                player.velocity_y = 0.0;
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
    use crate::player::PlayerState;

    #[test]
    fn keeps_player_inside_platform_bounds() {
        let world = World::default();
        let mut player = PlayerState::default();
        player.x = 100.0;
        player.z = -100.0;

        world.resolve_player(&mut player, EYE_HEIGHT);

        assert!(player.x <= PLATFORM_HALF_EXTENT);
        assert!(player.z >= -PLATFORM_HALF_EXTENT);
    }

    #[test]
    fn hole_excludes_main_floor_support_at_centre() {
        let world = World::default();
        let mut player = PlayerState::default();
        player.x = -8.0;
        player.z = 2.0;

        world.try_begin_hole_fall(&mut player);
        assert!(player.falling_through_hole);
    }

    #[test]
    fn main_floor_keeps_rim_support() {
        let world = World::default();
        let mut player = PlayerState::default();
        player.x = -8.0 + 1.35;
        player.z = 2.0;

        world.try_begin_hole_fall(&mut player);
        assert!(!player.falling_through_hole);
    }

    #[test]
    fn elevated_surfaces_ignore_floor_holes() {
        let world = World::default();
        assert!(world.support_eye_height(-8.0, 2.0, 1.1).is_some());
    }

    #[test]
    fn hole_fall_waits_until_centre_leaves_main_deck() {
        let world = World::default();
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
