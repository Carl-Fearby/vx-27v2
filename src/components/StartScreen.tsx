"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import SettingsMenu from "@/components/SettingsMenu";
import { useFlashlightTuning } from "@/hooks/useFlashlightTuning";
import { useHudWeaponTuning } from "@/hooks/useHudWeaponTuning";
import { useOutdoorLightingTuning } from "@/hooks/useOutdoorLightingTuning";
import { useSettings } from "@/hooks/useSettings";
import { preloadGame } from "@/lib/gameAssets";

type LoadState = "loading" | "ready" | "error";

export default function StartScreen() {
  const { settings, updateSettings } = useSettings();
  const {
    tuning: outdoorTuning,
    updateTuning: updateOutdoorTuning,
    resetHemi: resetOutdoorTuningHemi,
    resetAll: resetOutdoorTuningAll,
  } = useOutdoorLightingTuning();
  const {
    tuning: flashlightTuning,
    updateTuning: updateFlashlightTuning,
    resetTuning: resetFlashlightTuning,
  } = useFlashlightTuning();
  const {
    tuning: hudWeaponTuning,
    updateTuning: updateHudWeaponTuning,
    resetTuning: resetHudWeaponTuning,
  } = useHudWeaponTuning();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [progress, setProgress] = useState(0);
  const [statusLabel, setStatusLabel] = useState("Initializing");

  useEffect(() => {
    let cancelled = false;

    preloadGame((value, label) => {
      if (cancelled) {
        return;
      }

      setProgress(Math.round(value * 100));
      setStatusLabel(label);
    })
      .then(() => {
        if (!cancelled) {
          setLoadState("ready");
          setProgress(100);
          setStatusLabel("Ready");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState("error");
          setStatusLabel("Failed to load assets");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const isReady = loadState === "ready";
  const isLoading = loadState === "loading";

  return (
    <main className="start-screen">
      <div className="start-card">
        <p className="start-eyebrow">Prototype</p>
        <h1 className="start-title">VX-27</h1>
        <p className="start-copy">
          First-person arena with Rust-powered game logic and Babylon.js rendering.
          Move with WASD, look with arrow keys or the mouse.
        </p>

        <div className="loading-block" aria-live="polite">
          <div className="loading-meta">
            <span>{statusLabel}</span>
            <span>{progress}%</span>
          </div>
          <div
            className="loading-track"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={progress}
            aria-label="Game loading progress"
          >
            <div
              className="loading-fill"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {loadState === "error" ? (
          <button
            type="button"
            className="start-button"
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        ) : (
          <div className="start-actions">
            <Link
              href="/game"
              className={`start-button${isReady ? "" : " start-button--disabled"}`}
              aria-disabled={!isReady}
              tabIndex={isReady ? 0 : -1}
              onClick={(event) => {
                if (!isReady) {
                  event.preventDefault();
                }
              }}
            >
              {isLoading ? "Loading…" : "Start"}
            </Link>
            <button
              type="button"
              className="start-button start-button--secondary"
              onClick={() => setSettingsOpen(true)}
            >
              Settings
            </button>
          </div>
        )}
      </div>
      <SettingsMenu
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onChange={updateSettings}
        outdoorTuning={outdoorTuning}
        onOutdoorTuningChange={updateOutdoorTuning}
        onOutdoorTuningResetHemi={resetOutdoorTuningHemi}
        onOutdoorTuningResetAll={resetOutdoorTuningAll}
        flashlightTuning={flashlightTuning}
        onFlashlightTuningChange={updateFlashlightTuning}
        onFlashlightTuningReset={resetFlashlightTuning}
        hudWeaponTuning={hudWeaponTuning}
        onHudWeaponTuningChange={updateHudWeaponTuning}
        onHudWeaponTuningReset={resetHudWeaponTuning}
      />
    </main>
  );
}
