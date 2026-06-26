import {
  MOON_TEXTURE_URL,
  SKY_DAY_URL,
  SKY_NIGHT_URL,
} from "@/lib/lighting/tuning";
import { FLOOR_PRELOAD_URLS } from "@/lib/floor/floorAssets";
import { PILLAR_PRELOAD_URLS } from "@/lib/pillar/pillarAssets";

const PRELOAD_STEPS = [
  { label: "Game core", weight: 0.2 },
  { label: "Engine", weight: 0.2 },
  { label: "World assets", weight: 0.6 },
] as const;

const SKY_ASSETS = [SKY_DAY_URL, SKY_NIGHT_URL, MOON_TEXTURE_URL];
const WORLD_ASSETS = [...SKY_ASSETS, ...FLOOR_PRELOAD_URLS, ...PILLAR_PRELOAD_URLS];

async function preloadGameCore(
  onDownloadProgress: (ratio: number) => void,
): Promise<void> {
  const wasmJsResponse = await fetch("/wasm/game_core/game_core.js");
  const wasmBinaryResponse = await fetch("/wasm/game_core/game_core_bg.wasm");

  if (!wasmJsResponse.ok || !wasmBinaryResponse.ok) {
    throw new Error("Failed to preload Rust game core");
  }

  const totalBytes =
    Number(wasmJsResponse.headers.get("content-length") ?? 0) +
    Number(wasmBinaryResponse.headers.get("content-length") ?? 0);

  const [wasmJsBuffer, wasmBinaryBuffer] = await Promise.all([
    wasmJsResponse.arrayBuffer(),
    wasmBinaryResponse.arrayBuffer(),
  ]);

  if (totalBytes <= 0) {
    onDownloadProgress(1);
    return;
  }

  const loadedBytes = wasmJsBuffer.byteLength + wasmBinaryBuffer.byteLength;
  onDownloadProgress(Math.min(loadedBytes / totalBytes, 1));

  const { loadGameCoreModule } = await import("@/lib/gameCore");
  await loadGameCoreModule();
}

async function preloadBabylon(): Promise<void> {
  await import("@babylonjs/core");
}

async function preloadWorldAssets(
  onDownloadProgress: (ratio: number) => void,
): Promise<void> {
  const responses = await Promise.all(WORLD_ASSETS.map((url) => fetch(url)));

  if (responses.some((response) => !response.ok)) {
    throw new Error("Failed to preload world assets");
  }

  const totalBytes = responses.reduce(
    (sum, response) => sum + Number(response.headers.get("content-length") ?? 0),
    0,
  );

  let loadedBytes = 0;
  for (const response of responses) {
    const buffer = await response.arrayBuffer();
    loadedBytes += buffer.byteLength;
    onDownloadProgress(
      totalBytes > 0 ? Math.min(loadedBytes / totalBytes, 1) : 1,
    );
  }
}

export async function preloadGame(
  onProgress: (progress: number, label: string) => void,
): Promise<void> {
  let completedWeight = 0;

  onProgress(0, "Initializing");

  for (const step of PRELOAD_STEPS) {
    onProgress(completedWeight, step.label);

    if (step.label === "Game core") {
      await preloadGameCore((downloadRatio) => {
        const stepProgress = completedWeight + step.weight * downloadRatio;
        onProgress(stepProgress, step.label);
      });
      completedWeight += step.weight;
      onProgress(completedWeight, step.label);
      continue;
    }

    if (step.label === "Engine") {
      await preloadBabylon();
      completedWeight += step.weight;
      onProgress(completedWeight, step.label);
      continue;
    }

    await preloadWorldAssets((downloadRatio) => {
      const stepProgress = completedWeight + step.weight * downloadRatio;
      onProgress(stepProgress, step.label);
    });

    completedWeight += step.weight;
    onProgress(completedWeight, "Ready");
  }
}
