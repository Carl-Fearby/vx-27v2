import squareArenaBundled from "../../../public/levels/square-arena.json";
import {
  DEFAULT_LEVEL_ID,
  deriveLevelRuntime,
  levelJsonUrl,
} from "@/lib/level/deriveLevelRuntime";
import type { LevelConfig, LevelRuntime } from "@/lib/level/types";

const bundledLevels: Record<string, LevelConfig> = {
  "square-arena": squareArenaBundled as LevelConfig,
};

function assertLevelConfig(raw: unknown, source: string): LevelConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid level JSON from ${source}`);
  }

  const config = raw as LevelConfig;
  if (!config.meta?.id || !config.meta?.name) {
    throw new Error(`Level JSON missing meta.id/name (${source})`);
  }
  if (typeof config.size !== "number" || config.size <= 0) {
    throw new Error(`Level JSON missing size (${source})`);
  }

  return config;
}

export async function loadLevelConfig(
  levelId = DEFAULT_LEVEL_ID,
): Promise<LevelConfig> {
  const url = levelJsonUrl(levelId);

  if (process.env.NODE_ENV === "development") {
    try {
      const response = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (response.ok) {
        return assertLevelConfig(await response.json(), url);
      }
    } catch {
      // Fall back to bundled JSON when dev fetch fails (e.g. offline).
    }
  } else {
    const response = await fetch(url);
    if (response.ok) {
      return assertLevelConfig(await response.json(), url);
    }
  }

  const bundled = bundledLevels[levelId];
  if (!bundled) {
    throw new Error(`Unknown level: ${levelId}`);
  }

  return bundled;
}

export async function loadLevelRuntime(
  levelId = DEFAULT_LEVEL_ID,
): Promise<LevelRuntime> {
  const config = await loadLevelConfig(levelId);
  return deriveLevelRuntime(config);
}
