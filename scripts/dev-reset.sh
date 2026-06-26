#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

cd "${ROOT_DIR}"

echo "==> Cleaning Next.js cache"
rm -rf .next

echo "==> Building Rust game core (WASM)"
npm run build:wasm

echo "==> Ensuring HTTPS certificates"
bash scripts/ensure-certs.sh

echo "==> Running production build"
npx next build

echo "==> Starting HTTPS dev server"
exec npm run dev
