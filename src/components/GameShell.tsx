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
import { useRoundDisplayTuning } from "@/hooks/useRoundDisplayTuning";
import { useViewWeaponTuning } from "@/hooks/useViewWeaponTuning";
import { useWeaponHudState } from "@/hooks/useWeaponHudState";
import type { LevelRuntime } from "@/lib/level/types";
import { setMusicEnabled } from "@/lib/audio/music";
import { eventMatchesBinding, formatBindingValue } from "@/lib/keyBindings";
import type { SkyTuningPreviewMode } from "@/lib/lighting/createOutdoorSky";
import { safeExitPointerLock } from "@/lib/pointerLock";
import type { PlayerCoords } from "@/lib/playerCoords";

export default function GameShell({
  levelRuntime,
}: {
  levelRuntime: LevelRuntime;
}) {
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
    tuning: viewWeaponTuning,
    updatePose: updateViewWeaponPose,
    resetTuning: resetViewWeaponTuning,
  } = useViewWeaponTuning();
  const {
    tuning: roundDisplayTuning,
    updatePose: updateRoundDisplayPose,
    resetTuning: resetRoundDisplayTuning,
  } = useRoundDisplayTuning();
  const [roundDisplayPreview, setRoundDisplayPreview] = useState<
    { weapon: "rifle" | "pistol"; mode: "hip" | "ads" } | null
  >(null);
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
  const [sceneReady, setSceneReady] = useState(false);
  const [aimBlend, setAimBlend] = useState(0);
  const aimBlendRef = useRef(0);
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

  const handleAimBlend = useCallback((nextAimBlend: number) => {
    if (Math.abs(nextAimBlend - aimBlendRef.current) < 0.01) {
      return;
    }
    aimBlendRef.current = nextAimBlend;
    setAimBlend(nextAimBlend);
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
    setMusicEnabled(settings.musicEnabled, "level");
  }, [settings.musicEnabled]);

  const gamePaused = settingsOpen && !settingsSectionActive;
  const scenePaused = gamePaused || !sceneReady;

  useEffect(() => {
    if (scenePaused) {
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
  }, [scenePaused]);

  const getYaw = useCallback(() => playerCoordsRef.current.yaw, []);

  const hudVisible = settings.hudVisible && !materialEditMode;
  const weaponHud = useWeaponHudState({
    enabled: hudVisible,
    bindings,
  });

  return (
    <main className="app-shell">
      <FpsScene
        {...settings}
        bindings={bindings}
        outdoorTuning={outdoorTuning}
        flashlightTuning={flashlightTuning}
        motionBlurTuning={motionBlurTuning}
        viewWeaponTuning={viewWeaponTuning}
        roundDisplayTuning={roundDisplayTuning}
        roundDisplayPreview={roundDisplayPreview}
        paused={scenePaused}
        pointerLockBlocked={settingsOpen}
        materialEditMode={materialEditMode}
        activePrimaryWeapon={weaponHud.activePrimaryWeapon}
        roundsInMag={weaponHud.roundsInMag}
        activeLowAmmoThreshold={weaponHud.activeLowAmmoThreshold}
        fireMode={weaponHud.fireMode}
        levelRuntime={levelRuntime}
        surfaceTuning={surfaceTuning}
        onSurfacePick={setSelectedSurface}
        onToggleMaterialEditMode={toggleMaterialEditMode}
        onPlayerCoords={handlePlayerCoords}
        onAimBlend={handleAimBlend}
        onTryFirePrimary={weaponHud.tryFirePrimary}
        onReady={() => setSceneReady(true)}
        skyPreviewModeRef={skyPreviewModeRef}
      />
      <GameHud
        visible={hudVisible && sceneReady}
        getYaw={getYaw}
        onOpenSettings={openSettings}
        levelName={levelRuntime.meta.name}
        objective={levelRuntime.meta.objective}
        hostileCount={0}
        missionSeconds={missionSeconds}
        activePrimaryWeapon={weaponHud.activePrimaryWeapon}
        aimBlend={aimBlend}
        selectedWeaponSlot={weaponHud.selectedWeaponSlot}
        grenadeCount={weaponHud.grenadeCount}
        flashbangCount={weaponHud.flashbangCount}
        primaryAmmo={weaponHud.primaryAmmo}
        roundsInMag={weaponHud.roundsInMag}
        spareMags={weaponHud.spareMags}
        activeMagazineSize={weaponHud.activeMagazineSize}
        activeLowAmmoThreshold={weaponHud.activeLowAmmoThreshold}
        fireMode={weaponHud.fireMode}
        activeFireModes={weaponHud.activeFireModes}
        onCycleFireMode={weaponHud.cycleFireModeHud}
        hudWeaponTuning={hudWeaponTuning}
      />
      {!sceneReady ? (
        <div className="game-loading-cover" role="status" aria-live="polite">
          <span>Preparing arena</span>
        </div>
      ) : null}
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
        viewWeaponTuning={viewWeaponTuning}
        onViewWeaponTuningChange={updateViewWeaponPose}
        onViewWeaponTuningReset={resetViewWeaponTuning}
        roundDisplayTuning={roundDisplayTuning}
        onRoundDisplayTuningChange={updateRoundDisplayPose}
        onRoundDisplayTuningReset={resetRoundDisplayTuning}
        onRoundDisplayPreviewChange={setRoundDisplayPreview}
        getPlayerCoords={getPlayerCoords}
        onSectionActiveChange={setSettingsSectionActive}
        bindings={bindings}
        onBindingsChange={updateBindings}
      />
    </main>
  );
}
