"use client";

import { useEffect, useState } from "react";
import GameShell from "@/components/GameShell";
import StartScreen from "@/components/StartScreen";
import { loadLevelRuntime } from "@/lib/level/loadLevel";
import type { LevelRuntime } from "@/lib/level/types";

export default function GameEntry() {
  const [started, setStarted] = useState(false);
  const [levelRuntime, setLevelRuntime] = useState<LevelRuntime | null>(null);

  useEffect(() => {
    if (!started) {
      return;
    }
    let cancelled = false;
    loadLevelRuntime()
      .then((runtime) => {
        if (!cancelled) {
          setLevelRuntime(runtime);
        }
      })
      .catch((error) => {
        console.error("Failed to load level", error);
      });
    return () => {
      cancelled = true;
    };
  }, [started]);

  if (started && levelRuntime) {
    return <GameShell levelRuntime={levelRuntime} />;
  }

  if (started) {
    return (
      <div className="game-loading-cover" role="status" aria-live="polite">
        <span>Loading level</span>
      </div>
    );
  }

  return <StartScreen onStart={() => setStarted(true)} />;
}
