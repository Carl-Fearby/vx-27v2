"use client";

import { useEffect, useState } from "react";
import SettingsMenu from "@/components/SettingsMenu";
import { useFlashlightTuning } from "@/hooks/useFlashlightTuning";
import { useMotionBlurTuning } from "@/hooks/useMotionBlurTuning";
import { useHudWeaponTuning } from "@/hooks/useHudWeaponTuning";
import { useOutdoorLightingTuning } from "@/hooks/useOutdoorLightingTuning";
import { useSettings } from "@/hooks/useSettings";
import { playLevelMusic, setMusicEnabled } from "@/lib/audio/music";
import { preloadGame } from "@/lib/gameAssets";

type LoadState = "loading" | "ready" | "error";

type StartScreenProps = {
  onStart: () => void;
};

export default function StartScreen({ onStart }: StartScreenProps) {
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
    tuning: motionBlurTuning,
    updateTuning: updateMotionBlurTuning,
    resetTuning: resetMotionBlurTuning,
  } = useMotionBlurTuning();
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

  useEffect(() => {
    setMusicEnabled(settings.musicEnabled, "start");
  }, [settings.musicEnabled]);

  const isReady = loadState === "ready";

  return (
    <main className="start-screen">
      <div className="start-hero-stack">
        <h1 className="start-title">VX-27 Power Core</h1>
        <img
          className="start-logo"
          src="/ui/logo.png"
          alt="VX-27 Power Core"
          width={1024}
          height={1024}
          decoding="async"
        />
      </div>

      <label className="start-music-toggle">
        <span>
          <span className="start-music-label">Music</span>
          <span className="start-music-hint">Loading and in-level soundtrack</span>
        </span>
        <input
          type="checkbox"
          checked={settings.musicEnabled}
          onChange={(event) => {
            const enabled = event.currentTarget.checked;
            updateSettings({ musicEnabled: enabled });
            setMusicEnabled(enabled, "start");
          }}
        />
      </label>

      {loadState !== "error" && !isReady ? (
        <div className="loading-block" aria-live="polite">
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
          <div className="loading-meta">
            <span>{statusLabel}</span>
            <span>{progress}%</span>
          </div>
        </div>
      ) : null}

      {loadState === "error" ? (
        <button
          type="button"
          className="start-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      ) : isReady ? (
        <div className="start-actions">
          <button
            type="button"
            className="start-button"
            onClick={() => {
              if (settings.musicEnabled) {
                playLevelMusic();
              }
              onStart();
            }}
          >
            Start
          </button>
          <button
            type="button"
            className="start-button start-button--secondary"
            onClick={() => setSettingsOpen(true)}
          >
            Settings
          </button>
        </div>
      ) : null}
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
        motionBlurTuning={motionBlurTuning}
        onMotionBlurTuningChange={updateMotionBlurTuning}
        onMotionBlurTuningReset={resetMotionBlurTuning}
        hudWeaponTuning={hudWeaponTuning}
        onHudWeaponTuningChange={updateHudWeaponTuning}
        onHudWeaponTuningReset={resetHudWeaponTuning}
      />
    </main>
  );
}
