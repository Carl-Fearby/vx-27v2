"use client";

import { useState } from "react";
import GameShell from "@/components/GameShell";
import StartScreen from "@/components/StartScreen";

export default function GameEntry() {
  const [started, setStarted] = useState(false);

  if (started) {
    return <GameShell />;
  }

  return <StartScreen onStart={() => setStarted(true)} />;
}
