# VX-27

Next.js + Babylon.js first-person shooter prototype with Rust/WebAssembly game logic.

## Getting started

```bash
npm install
npm run build:wasm   # compile Rust game core to public/wasm/game_core
npm run dev          # https://localhost:3000 (auto-generates local certs)
```

For a full clean rebuild and dev start:

```bash
npm run dev:reset
```

`dev:reset` clears the Next.js cache, rebuilds WASM, ensures HTTPS certificates, runs a production build, then starts the HTTPS dev server.

Open [https://localhost:3000](https://localhost:3000) for the start screen. Assets preload with a progress bar; click **Start** to enter the game at `/game`. Press **N** in-game to toggle day and night (10 second crossfade).

If your browser warns about the certificate, trust the local cert from `certificates/` or install [mkcert](https://github.com/FiloSottile/mkcert) and run `npm run certs` to regenerate trusted certs.

`npm run build` compiles the WASM module automatically before the Next.js production build.

## Architecture

| Layer | Responsibility |
|-------|----------------|
| **Rust (`rust/game_core`)** | Input, movement, mouse look, gravity, platform collision |
| **WebAssembly** | Runs the Rust core in the browser |
| **Babylon.js** | Rendering, dual sky domes, sun/moon lighting |
| **Next.js** | Routes, start screen, asset preloading |

## Stack

- Next.js (App Router)
- Babylon.js
- Rust + wasm-pack + wasm-bindgen
- HDR environment skybox from Babylon assets

## Rust development

```bash
cd rust/game_core
cargo test
cd ../..
npm run build:wasm
```

Game logic lives in:

- `rust/game_core/src/input.rs` — keyboard state
- `rust/game_core/src/player.rs` — movement and camera rotation
- `rust/game_core/src/world.rs` — platform, ramp, and pillar collision

The TypeScript bridge is in `src/lib/gameCore.ts`.
