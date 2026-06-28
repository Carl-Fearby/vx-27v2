"use client";

import { useEffect, useRef, useState } from "react";
import type { FireMode } from "@/lib/weapons/primaryWeapons";

const MODE_ARIA: Record<FireMode, string> = {
  auto: "Automatic fire",
  burst: "Burst fire",
  single: "Semi-automatic fire",
};

function slideDirection(
  modes: FireMode[],
  from: FireMode,
  to: FireMode,
): "next" | "prev" {
  if (from === to) {
    return "next";
  }
  const fromIdx = modes.indexOf(from);
  const toIdx = modes.indexOf(to);
  if (fromIdx < 0 || toIdx < 0) {
    return "next";
  }
  const forward = (toIdx - fromIdx + modes.length) % modes.length;
  return forward === 1 ? "next" : "prev";
}

function FireModeBulletIcon() {
  return (
    <span className="hud-fire-carousel-bullet-pair" aria-hidden>
      <img
        src="/ui/bullet_selected.webp"
        alt=""
        className="hud-fire-carousel-bullet"
      />
    </span>
  );
}

function FireModeGlyph({ mode }: { mode: FireMode }) {
  if (mode === "burst") {
    return (
      <span className="hud-fire-carousel-bullets" aria-hidden>
        <FireModeBulletIcon />
        <FireModeBulletIcon />
        <FireModeBulletIcon />
      </span>
    );
  }

  return (
    <span className="hud-fire-carousel-bullets" aria-hidden>
      <FireModeBulletIcon />
      {mode === "auto" ? <span className="hud-fire-carousel-tag">A</span> : null}
    </span>
  );
}

type HudFireModeCarouselProps = {
  modes: FireMode[];
  activeMode: FireMode;
  onCycle: () => void;
};

export default function HudFireModeCarousel({
  modes,
  activeMode,
  onCycle,
}: HudFireModeCarouselProps) {
  const prevModeRef = useRef(activeMode);
  const [slideDir, setSlideDir] = useState<"next" | "prev" | null>(null);

  useEffect(() => {
    if (activeMode === prevModeRef.current) {
      return;
    }
    setSlideDir(slideDirection(modes, prevModeRef.current, activeMode));
    prevModeRef.current = activeMode;
  }, [activeMode, modes]);

  if (!modes.length) {
    return null;
  }

  return (
    <div className="hud-fire-carousel" role="group" aria-label="Fire mode">
      <button
        type="button"
        className="hud-fire-carousel-slot hud-fire-carousel-slot--center"
        aria-label={`${MODE_ARIA[activeMode]} (press C to cycle)`}
        onClick={onCycle}
      >
        <span className="hud-fire-carousel-viewport" aria-hidden>
          <span
            key={activeMode}
            className={
              slideDir
                ? `hud-fire-carousel-slide hud-fire-carousel-slide--${slideDir}`
                : "hud-fire-carousel-slide"
            }
          >
            <FireModeGlyph mode={activeMode} />
          </span>
        </span>
      </button>
    </div>
  );
}
