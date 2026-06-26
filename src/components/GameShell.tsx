"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import FpsScene from "@/components/FpsScene";
import GameHud from "@/components/hud/GameHud";
import MaterialEditPanel from "@/components/MaterialEditPanel";
import SettingsMenu from "@/components/SettingsMenu";
import { useFlashlightTuning } from "@/hooks/useFlashlightTuning";
import { useHudWeaponTuning } from "@/hooks/useHudWeaponTuning";
import { useKeyBindings } from "@/hooks/useKeyBindings";
import { useMaterialEdit } from "@/hooks/useMaterialEdit";
import { useOutdoorLightingTuning } from "@/hooks/useOutdoorLightingTuning";
import { useSettings } from "@/hooks/useSettings";
import { useWeaponHudState } from "@/hooks/useWeaponHudState";
import { eventMatchesBinding, formatBindingValue } from "@/lib/keyBindings";
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
  const playerCoordsRef = useRef<PlayerCoords>({
    x: 0,
    y: 0,
    z: 0,
    yaw: 0,
    pitch: 0,
  });
  const fpsRef = useRef(0);

  const getPlayerCoords = useCallback(() => playerCoordsRef.current, []);

  const handlePlayerCoords = useCallback((coords: PlayerCoords) => {
    playerCoordsRef.current = coords;
  }, []);

  const handleFps = useCallback((fps: number) => {
    fpsRef.current = fps;
  }, []);

  const getFps = useCallback(() => fpsRef.current, []);

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

  const getYaw = useCallback(() => playerCoordsRef.current.yaw, []);

  const hudVisible = !settingsOpen || settingsSectionActive;
  const weaponHud = useWeaponHudState({
    enabled: hudVisible && !materialEditMode,
  });

  return (
    <main className="app-shell">
      <FpsScene
        {...settings}
        bindings={bindings}
        outdoorTuning={outdoorTuning}
        flashlightTuning={flashlightTuning}
        paused={settingsOpen && !settingsSectionActive}
        materialEditMode={materialEditMode}
        surfaceTuning={surfaceTuning}
        onSurfacePick={setSelectedSurface}
        onToggleMaterialEditMode={toggleMaterialEditMode}
        onPlayerCoords={handlePlayerCoords}
        onFps={handleFps}
      />
      <GameHud
        visible={hudVisible}
        getYaw={getYaw}
        getFps={getFps}
        onOpenSettings={openSettings}
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
        flashlightTuning={flashlightTuning}
        onFlashlightTuningChange={updateFlashlightTuning}
        onFlashlightTuningReset={resetFlashlightTuning}
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
