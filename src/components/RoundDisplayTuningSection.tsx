"use client";

import { useEffect, useState } from "react";
import { SettingsSlider } from "@/components/SettingsControls";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import {
  formatRoundDisplayTuningJson,
  type RoundDisplayPoseMode,
  type RoundDisplayTuning,
  type WeaponRoundDisplayPose,
} from "@/lib/weapons/weaponRoundDisplayTuning";

type RoundDisplayTuningSectionProps = {
  tuning: RoundDisplayTuning;
  onChange: (
    weapon: PrimaryWeaponId,
    mode: RoundDisplayPoseMode,
    patch: Partial<WeaponRoundDisplayPose>,
  ) => void;
  onReset: () => void;
  onPreviewChange?: (
    preview: { weapon: PrimaryWeaponId; mode: RoundDisplayPoseMode } | null,
  ) => void;
};

const WEAPON_TABS: Array<{ id: PrimaryWeaponId; label: string }> = [
  { id: "rifle", label: "Rifle" },
  { id: "pistol", label: "Pistol" },
];

const MODE_TABS: Array<{ id: RoundDisplayPoseMode; label: string }> = [
  { id: "hip", label: "Hip" },
  { id: "ads", label: "ADS" },
];

export default function RoundDisplayTuningSection({
  tuning,
  onChange,
  onReset,
  onPreviewChange,
}: RoundDisplayTuningSectionProps) {
  const [weapon, setWeapon] = useState<PrimaryWeaponId>("rifle");
  const [mode, setMode] = useState<RoundDisplayPoseMode>("hip");
  const [copied, setCopied] = useState(false);
  const pose = tuning[weapon][mode];

  useEffect(() => {
    onPreviewChange?.({ weapon, mode });
    return () => onPreviewChange?.(null);
  }, [weapon, mode, onPreviewChange]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatRoundDisplayTuningJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <p className="settings-row-hint">
        Switch to the weapon you are tuning (X). Hip/ADS preview applies while this
        panel is open. Rifle uses hip in play; pistol snaps at 50% aim.
      </p>

      <div className="settings-tabs" role="tablist" aria-label="Weapon">
        {WEAPON_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={weapon === tab.id}
            className={`settings-tab${weapon === tab.id ? " settings-tab--active" : ""}`}
            onClick={() => setWeapon(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-tabs" role="tablist" aria-label="Pose">
        {MODE_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={mode === tab.id}
            className={`settings-tab${mode === tab.id ? " settings-tab--active" : ""}`}
            onClick={() => setMode(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="settings-list" role="tabpanel">
        <SettingsSlider
          label="Position X"
          min={-2}
          max={2}
          step={0.001}
          value={pose.posX}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { posX: value })}
        />
        <SettingsSlider
          label="Position Y"
          min={-2}
          max={2}
          step={0.001}
          value={pose.posY}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { posY: value })}
        />
        <SettingsSlider
          label="Position Z"
          min={-2}
          max={2}
          step={0.001}
          value={pose.posZ}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { posZ: value })}
        />
        <SettingsSlider
          label="Rotation X"
          min={-1.5}
          max={1.5}
          step={0.0005}
          value={pose.rotX}
          decimals={4}
          onChange={(value) => onChange(weapon, mode, { rotX: value })}
        />
        <SettingsSlider
          label="Rotation Y"
          min={-1.5}
          max={1.5}
          step={0.0005}
          value={pose.rotY}
          decimals={4}
          onChange={(value) => onChange(weapon, mode, { rotY: value })}
        />
        <SettingsSlider
          label="Rotation Z"
          min={-1.5}
          max={1.5}
          step={0.0005}
          value={pose.rotZ}
          decimals={4}
          onChange={(value) => onChange(weapon, mode, { rotZ: value })}
        />
        <SettingsSlider
          label="Plane scale"
          min={0.1}
          max={5}
          step={0.001}
          value={pose.scale}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { scale: value })}
        />
        <SettingsSlider
          label="Plane width"
          min={0.01}
          max={0.2}
          step={0.001}
          value={pose.planeWidth}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { planeWidth: value })}
        />
        <SettingsSlider
          label="Plane height"
          min={0.01}
          max={0.2}
          step={0.001}
          value={pose.planeHeight}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { planeHeight: value })}
        />
        <SettingsSlider
          label="Font size"
          min={12}
          max={120}
          step={1}
          value={pose.fontSize}
          decimals={0}
          onChange={(value) => onChange(weapon, mode, { fontSize: Math.round(value) })}
        />
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-action-button" onClick={onReset}>
          Delete JSON
        </button>
        <button type="button" className="settings-action-button" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </>
  );
}
