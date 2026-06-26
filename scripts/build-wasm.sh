#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${ROOT_DIR}/public/wasm/game_core"

cd "${ROOT_DIR}/rust/game_core"

wasm-pack build \
  --target web \
  --out-dir "${OUT_DIR}" \
  --out-name game_core

# wasm-bindgen passes JS booleans directly; coerce for reliable i32 at the boundary.
perl -pi -e '
  s/wasm\.gamecore_set_invert_mouse_x\(this\.__wbg_ptr, invert\);/wasm.gamecore_set_invert_mouse_x(this.__wbg_ptr, invert ? 1 : 0);/g;
  s/wasm\.gamecore_set_invert_mouse_y\(this\.__wbg_ptr, invert\);/wasm.gamecore_set_invert_mouse_y(this.__wbg_ptr, invert ? 1 : 0);/g;
  s/wasm\.gamecore_set_invert_strafe\(this\.__wbg_ptr, invert\);/wasm.gamecore_set_invert_strafe(this.__wbg_ptr, invert ? 1 : 0);/g;
' "${OUT_DIR}/game_core.js"

echo "WASM build complete: ${OUT_DIR}"
