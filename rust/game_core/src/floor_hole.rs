use crate::player::PLAYER_RADIUS;

#[derive(Clone, Copy, Debug)]
pub struct FloorHole {
    pub x: f32,
    pub z: f32,
    pub radius: f32,
}

pub const HOLE_FALL_GRAVITY: f32 = 20.0;
pub const HOLE_FALL_REMOVE_DEPTH: f32 = 12.0;
pub const DEATH_FALL_DROP: f32 = 12.0;

pub fn point_in_floor_hole(x: f32, z: f32, holes: &[FloorHole], inset: f32) -> bool {
    for hole in holes {
        let dx = x - hole.x;
        let dz = z - hole.z;
        let r = (hole.radius - inset).max(0.0);
        if dx * dx + dz * dz < r * r {
            return true;
        }
    }
    false
}

pub fn hole_commit_inset() -> f32 {
    PLAYER_RADIUS * 0.35
}

const FOOT_SAMPLE_OFFSETS: [(f32, f32); 5] = [
    (0.0, 0.0),
    (PLAYER_RADIUS * 0.85, 0.0),
    (-PLAYER_RADIUS * 0.85, 0.0),
    (0.0, PLAYER_RADIUS * 0.85),
    (0.0, -PLAYER_RADIUS * 0.85),
];

/// GE2 `isOverFloorHole` — body centre inset first, then foot-circle samples at full radius.
pub fn is_committed_over_floor_hole(x: f32, z: f32, holes: &[FloorHole]) -> bool {
    if point_in_floor_hole(x, z, holes, hole_commit_inset()) {
        return true;
    }
    for (ox, oz) in FOOT_SAMPLE_OFFSETS {
        if point_in_floor_hole(x + ox, z + oz, holes, 0.0) {
            return true;
        }
    }
    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn point_in_floor_hole_respects_inset() {
        let holes = vec![FloorHole {
            x: -8.0,
            z: 2.0,
            radius: 1.4,
        }];
        assert!(point_in_floor_hole(-8.0, 2.0, &holes, 0.0));
        assert!(!point_in_floor_hole(-8.0 + 1.45, 2.0, &holes, 0.0));
        assert!(!point_in_floor_hole(-8.0 + 1.0, 2.0, &holes, 0.5));
    }

    #[test]
    fn commit_uses_inset_centre_and_foot_samples() {
        let holes = vec![FloorHole {
            x: -8.0,
            z: 2.0,
            radius: 1.4,
        }];
        assert!(is_committed_over_floor_hole(-8.0 + 0.5, 2.0, &holes));
        assert!(is_committed_over_floor_hole(-8.0 + 1.35, 2.0, &holes));
    }
}
