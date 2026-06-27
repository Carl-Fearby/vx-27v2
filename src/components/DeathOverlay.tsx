"use client";

import { useEffect, useRef } from "react";
import {
  beginDeathOverlayFade,
  hideDeathOverlay,
  showDeathOverlay,
} from "@/lib/deathOverlay";
import { DEATH_FADE_MS } from "@/lib/floor/floorHoles";
import { safeRequestPointerLock } from "@/lib/pointerLock";

type DeathOverlayProps = {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  visible: boolean;
  reason: string;
  minDisplayEnd: number;
  fading: boolean;
  onRespawn: () => boolean;
  onFadeComplete: () => void;
};

export default function DeathOverlay({
  canvasRef,
  visible,
  reason,
  minDisplayEnd,
  fading,
  onRespawn,
  onFadeComplete,
}: DeathOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reasonRef = useRef<HTMLParagraphElement>(null);
  const hintRef = useRef<HTMLParagraphElement>(null);
  const prevVisibleRef = useRef(false);
  const prevFadingRef = useRef(false);

  useEffect(() => {
    if (visible && !prevVisibleRef.current) {
      showDeathOverlay(
        rootRef.current,
        reasonRef.current,
        titleRef.current,
        hintRef.current,
        reason,
      );
    }
    prevVisibleRef.current = visible;
  }, [reason, visible]);

  useEffect(() => {
    if (fading && !prevFadingRef.current) {
      beginDeathOverlayFade(rootRef.current);
      const timer = window.setTimeout(() => {
        hideDeathOverlay(rootRef.current);
        onFadeComplete();
      }, DEATH_FADE_MS);
      return () => window.clearTimeout(timer);
    }
    prevFadingRef.current = fading;
    return undefined;
  }, [fading, onFadeComplete]);

  useEffect(() => {
    if (!visible && !fading) {
      hideDeathOverlay(rootRef.current);
    }
  }, [fading, visible]);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!visible || fading) {
      return;
    }
    if (performance.now() < minDisplayEnd) {
      return;
    }
    if (!onRespawn()) {
      return;
    }
    const canvas = canvasRef.current;
    if (canvas) {
      safeRequestPointerLock(canvas);
    }
  };

  return (
    <div
      ref={rootRef}
      className="deathOverlay"
      role="alertdialog"
      aria-live="assertive"
      aria-hidden={visible || fading ? "false" : "true"}
      onClick={handleClick}
    >
      <div className="deathOverlayInner">
        <h1 ref={titleRef} className="deathOverlayTitle">
          YOU DIED
        </h1>
        <p ref={reasonRef} className="deathOverlayReason" />
        <p ref={hintRef} className="deathOverlayHint">
          Click to respawn
        </p>
      </div>
    </div>
  );
}
