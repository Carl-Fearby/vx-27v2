pub const KEY_W: u32 = 87;
pub const KEY_A: u32 = 65;
pub const KEY_S: u32 = 83;
pub const KEY_D: u32 = 68;
pub const KEY_ARROW_UP: u32 = 38;
pub const KEY_ARROW_DOWN: u32 = 40;
pub const KEY_ARROW_LEFT: u32 = 37;
pub const KEY_ARROW_RIGHT: u32 = 39;

#[derive(Clone, Copy, Debug, Default)]
pub struct InputState {
    pub forward: bool,
    pub backward: bool,
    pub left: bool,
    pub right: bool,
    pub look_up: bool,
    pub look_down: bool,
    pub look_left: bool,
    pub look_right: bool,
    pub jump: bool,
    pub sprint: bool,
    pub crouch: bool,
}

impl InputState {
    pub fn clear(&mut self) {
        *self = Self::default();
    }
}
