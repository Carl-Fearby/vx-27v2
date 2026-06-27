"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FpsScene from "@/components/FpsScene";
import GameHud from "@/components/hud/GameHud";
import MaterialEditPanel from "@/components/MaterialEditPanel";
import SettingsMenu from "@/components/SettingsMenu";
import { useFlashlightTuning } from "@/hooks/useFlashlightTuning";
import { useMotionBlurTuning } from "@/hooks/useMotionBlurTuning";
import { useHudWeaponTuning } from "@/hooks/useHudWeaponTuning";
import { useKeyBindings } from "@/hooks/useKeyBindings";
import { useMaterialEdit } from "@/hooks/useMaterialEdit";
import { useOutdoorLightingTuning } from "@/hooks/useOutdoorLightingTuning";
import { useSettings } from "@/hooks/useSettings";
import { useWeaponHudState } from "@/hooks/useWeaponHudState";
import { setMusicEnabled } from "@/lib/audio/music";
import { eventMatchesBinding, formatBindingValue } from "@/lib/keyBindings";
import type { SkyTuningPreviewMode } from "@/lib/lighting/createOutdoorSky";
import { safeExitPointerLock } from "@/lib/pointerLock";
import type { PlayerCoords } from "@/lib/playerCoords";

export default function GameShell() {
  const { settings, updateSettings } = useSettings();
  const { bindings, updateBindings } = useKeyBindings();
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
  const { tuning: hudWeaponTuning, updateTuning: updateHudWeaponTuning, resetTuning: resetHudWeaponTuning } =
    useHudWeaponTuning();
  const {
    materialEditMode,
    selectedSurface,
    surfaceTuning,
    toggleMaterialEditMode,
    setSelectedSurface,
    updateSurfaceTuning,
    resetSurfaceTuning,
  } = useMaterialEdit();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsSectionActive, setSettingsSectionActive] = useState(false);
  const skyPreviewModeRef = useRef<
    ((mode: SkyTuningPreviewMode) => void) | null
  >(null);
  const handleSkyPreviewModeChange = useCallback((mode: SkyTuningPreviewMode) => {
    skyPreviewModeRef.current?.(mode);
  }, []);
  const playerCoordsRef = useRef<PlayerCoords>({
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
  });
  const [missionSeconds, setMissionSeconds] = useState(0);
  const missionSecondsRef = useRef(0);

  const getPlayerCoords = useCallback(() => playerCoordsRef.current, []);

  const handlePlayerCoords = useCallback((coords: PlayerCoords) => {
    playerCoordsRef.current = coords;
  }, []);

  const openSettings = useCallback(() => {
    safeExitPointerLock();
    setSettingsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (settingsOpen || materialEditMode) {
        return;
      }

      if (!eventMatchesBinding(bindings, "openSettings", event.code)) {
        return;
      }

      event.preventDefault();
      openSettings();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [bindings, materialEditMode, openSettings, settingsOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.code !== "KeyR" ||
        event.repeat ||
        settingsOpen ||
        materialEditMode
      ) {
        return;
      }

      event.preventDefault();
      updateSettings({ rainEnabled: !settings.rainEnabled });
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    materialEditMode,
    settings.rainEnabled,
    settingsOpen,
    updateSettings,
  ]);

  useEffect(() => {
    setMusicEnabled(settings.musicEnabled, "level");
  }, [settings.musicEnabled]);

  const gamePaused = settingsOpen && !settingsSectionActive;

  useEffect(() => {
    if (gamePaused) {
      return;
    }

    let frameId = 0;
    let lastSeconds = -1;
    const startedAt = performance.now() - missionSecondsRef.current * 1000;

    const tick = () => {
      const nextSeconds = Math.floor((performance.now() - startedAt) / 1000);
      if (nextSeconds !== lastSeconds) {
        lastSeconds = nextSeconds;
        missionSecondsRef.current = nextSeconds;
        setMissionSeconds(nextSeconds);
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [gamePaused]);

  const getYaw = useCallback(() => playerCoordsRef.current.yaw, []);

  const hudVisible = settings.hudVisible && !materialEditMode;
  const weaponHud = useWeaponHudState({
    enabled: hudVisible,
  });

  return (
    <main className="app-shell">
      <FpsScene
        {...settings}
        bindings={bindings}
        outdoorTuning={outdoorTuning}
        flashlightTuning={flashlightTuning}
        motionBlurTuning={motionBlurTuning}
        paused={settingsOpen && !settingsSectionActive}
        pointerLockBlocked={settingsOpen}
        materialEditMode={materialEditMode}
        surfaceTuning={surfaceTuning}
        onSurfacePick={setSelectedSurface}
        onToggleMaterialEditMode={toggleMaterialEditMode}
        onPlayerCoords={handlePlayerCoords}
        skyPreviewModeRef={skyPreviewModeRef}
      />
      <GameHud
        visible={hudVisible}
        getYaw={getYaw}
        onOpenSettings={openSettings}
        levelName="Square Arena"
        objective="HOLD ZONE"
        hostileCount={0}
        missionSeconds={missionSeconds}
        activePrimaryWeapon={weaponHud.activePrimaryWeapon}
        selectedWeaponSlot={weaponHud.selectedWeaponSlot}
        grenadeCount={weaponHud.grenadeCount}
        flashbangCount={weaponHud.flashbangCount}
        hudWeaponTuning={hudWeaponTuning}
      />
      {materialEditMode ? (
        <div className="material-edit-banner" role="status">
          Material edit — drag to look, WASD move, tap/click a surface to edit (don&apos;t drag). Press{" "}
          <kbd>{formatBindingValue(bindings.materialEdit)}</kbd> to exit.
        </div>
      ) : null}
      {materialEditMode && selectedSurface ? (
        <MaterialEditPanel
          surfaceId={selectedSurface}
          tuning={surfaceTuning[selectedSurface]}
          onChange={(patch) => updateSurfaceTuning(selectedSurface, patch)}
          onReset={() => resetSurfaceTuning(selectedSurface)}
          onClose={() => setSelectedSurface(null)}
        />
      ) : null}
      <SettingsMenu
        open={settingsOpen}
        settings={settings}
        onClose={closeSettings}
        onChange={updateSettings}
        outdoorTuning={outdoorTuning}
        onOutdoorTuningChange={updateOutdoorTuning}
        onOutdoorTuningResetHemi={resetOutdoorTuningHemi}
        onOutdoorTuningResetAll={resetOutdoorTuningAll}
        onSkyPreviewModeChange={handleSkyPreviewModeChange}
        flashlightTuning={flashlightTuning}
        onFlashlightTuningChange={updateFlashlightTuning}
        onFlashlightTuningReset={resetFlashlightTuning}
        motionBlurTuning={motionBlurTuning}
        onMotionBlurTuningChange={updateMotionBlurTuning}
        onMotionBlurTuningReset={resetMotionBlurTuning}
        hudWeaponTuning={hudWeaponTuning}
        onHudWeaponTuningChange={updateHudWeaponTuning}
        onHudWeaponTuningReset={resetHudWeaponTuning}
        getPlayerCoords={getPlayerCoords}
        onSectionActiveChange={setSettingsSectionActive}
        bindings={bindings}
        onBindingsChange={updateBindings}
      />
    </main>
  );
}
