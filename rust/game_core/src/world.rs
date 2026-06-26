use crate::player::{PlayerState, EYE_HEIGHT, PLAYER_RADIUS};

const PLATFORM_HALF_EXTENT: f32 = 20.0;

#[derive(Clone, Copy, Debug)]
struct Aabb {
    min_x: f32,
    max_x: f32,
    min_z: f32,
    max_z: f32,
    stand_height: f32,
}

impl Aabb {
    fn contains_feet(&self, x: f32, z: f32) -> bool {
        x >= self.min_x + PLAYER_RADIUS
            && x <= self.max_x - PLAYER_RADIUS
            && z >= self.min_z + PLAYER_RADIUS
            && z <= self.max_z - PLAYER_RADIUS
    }

    fn top_at(&self, x: f32, z: f32) -> Option<f32> {
        if self.contains_feet(x, z) {
            Some(self.stand_height)
        } else {
            None
        }
    }
}

#[derive(Clone, Debug)]
pub struct World {
    surfaces: Vec<Aabb>,
    fall_kill_y: f32,
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
                },
                Aabb {
                    min_x: -11.0,
                    max_x: -5.0,
                    min_z: -1.0,
                    max_z: 9.0,
                    stand_height: 1.1,
                },
                Aabb {
                    min_x: 4.8,
                    max_x: 7.2,
                    min_z: 0.8,
                    max_z: 3.2,
                    stand_height: 4.9,
                },
            ],
            fall_kill_y: -12.0,
        }
    }
}

impl World {
    pub fn resolve_player(&self, player: &mut PlayerState, eye_height: f32) {
        let min_bound = -PLATFORM_HALF_EXTENT + PLAYER_RADIUS;
        let max_bound = PLATFORM_HALF_EXTENT - PLAYER_RADIUS;
        player.x = player.x.clamp(min_bound, max_bound);
        player.z = player.z.clamp(min_bound, max_bound);

        let mut ground_height: Option<f32> = None;

        for surface in &self.surfaces {
            if let Some(height) = surface.top_at(player.x, player.z) {
                let stance_height = height * (eye_height / EYE_HEIGHT);
                ground_height = Some(
                    ground_height.map_or(stance_height, |current: f32| current.max(stance_height)),
                );
            }
        }

        if let Some(height) = ground_height {
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

        if player.y < self.fall_kill_y {
            *player = PlayerState::default();
        }
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
}
