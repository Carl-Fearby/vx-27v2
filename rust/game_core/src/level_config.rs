use crate::floor_hole::FloorHole;
use crate::world::World;
use serde::Deserialize;

#[derive(Clone, Debug, Deserialize)]
pub struct LevelMeta {
    pub id: String,
    pub name: String,
    pub objective: String,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct LevelPlayerSpawn {
    pub x: f32,
    pub z: f32,
    #[serde(rename = "footY")]
    pub foot_y: f32,
    pub yaw: f32,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct LevelFloorHole {
    pub x: f32,
    pub z: f32,
    pub radius: f32,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct LevelPillar {
    pub x: f32,
    pub z: f32,
    pub height: f32,
    pub diameter: f32,
}

#[derive(Clone, Copy, Debug, Deserialize)]
pub struct LevelCatwalk {
    pub enabled: bool,
    #[serde(rename = "deckThickness")]
    pub deck_thickness: f32,
    #[serde(rename = "overhangFraction")]
    pub overhang_fraction: f32,
    #[serde(rename = "railThickness")]
    pub rail_thickness: f32,
    #[serde(rename = "railHeight")]
    pub rail_height: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LevelJumpBlock {
    pub id: String,
    #[serde(rename = "centerX")]
    pub center_x: f32,
    #[serde(rename = "centerZ")]
    pub center_z: f32,
    pub width: f32,
    pub depth: f32,
    pub height: f32,
}

#[derive(Clone, Debug, Deserialize)]
pub struct LevelConfig {
    pub meta: LevelMeta,
    pub size: f32,
    #[serde(rename = "wallHeight")]
    pub wall_height: f32,
    #[serde(rename = "wallThickness")]
    pub wall_thickness: f32,
    #[serde(rename = "floorFootY")]
    pub floor_foot_y: f32,
    #[serde(rename = "floorSlabDepth")]
    pub floor_slab_depth: f32,
    #[serde(rename = "playerSpawn")]
    pub player_spawn: LevelPlayerSpawn,
    #[serde(rename = "floorHoles")]
    pub floor_holes: Vec<LevelFloorHole>,
    pub pillar: LevelPillar,
    pub catwalk: LevelCatwalk,
    #[serde(rename = "jumpBlocks")]
    pub jump_blocks: Vec<LevelJumpBlock>,
}

impl From<LevelFloorHole> for FloorHole {
    fn from(value: LevelFloorHole) -> Self {
        FloorHole {
            x: value.x,
            z: value.z,
            radius: value.radius,
        }
    }
}

pub fn parse_level_config(json: &str) -> Result<LevelConfig, String> {
    serde_json::from_str(json).map_err(|error| error.to_string())
}

pub fn world_from_level_config(config: &LevelConfig) -> World {
    let platform_half = config.size * 0.5;
    let wall_outer_north_z = -(platform_half + config.wall_thickness);
    let wall_outer_south_z = platform_half + config.wall_thickness;
    let wall_outer_east_x = platform_half + config.wall_thickness;

    let mut surfaces = vec![World::flat_surface(
        -platform_half,
        platform_half,
        -platform_half,
        platform_half,
        config.floor_foot_y,
        true,
        false,
    )];

    if config.catwalk.enabled {
        let west_edge_x = platform_half - config.size * config.catwalk.overhang_fraction;
        let deck_foot_y = config.wall_height + config.catwalk.deck_thickness;
        surfaces.push(World::flat_surface(
            west_edge_x,
            wall_outer_east_x,
            wall_outer_north_z,
            wall_outer_south_z,
            deck_foot_y,
            false,
            true,
        ));
    }

    for block in &config.jump_blocks {
        surfaces.push(World::flat_surface(
            block.center_x - block.width * 0.5,
            block.center_x + block.width * 0.5,
            block.center_z - block.depth * 0.5,
            block.center_z + block.depth * 0.5,
            block.height,
            false,
            false,
        ));
    }

    let floor_holes = config.floor_holes.iter().copied().map(FloorHole::from).collect();

    World::new(
        platform_half,
        config.floor_foot_y,
        floor_holes,
        surfaces,
        config.player_spawn,
    )
}

pub fn world_from_level_json(json: &str) -> Result<World, String> {
    let config = parse_level_config(json)?;
    Ok(world_from_level_config(&config))
}

#[cfg(test)]
pub fn square_arena_config() -> LevelConfig {
    parse_level_config(include_str!("../../../public/levels/square-arena.json")).unwrap()
}

#[cfg(test)]
pub fn square_arena_world() -> World {
    world_from_level_config(&square_arena_config())
}
