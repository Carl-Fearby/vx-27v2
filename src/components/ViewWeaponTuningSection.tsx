"use client";

import { useState } from "react";
import { SettingsSlider } from "@/components/SettingsControls";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import {
  formatViewWeaponTuningJson,
  type ViewWeaponPose,
  type ViewWeaponPoseMode,
  type ViewWeaponTuning,
} from "@/lib/weapons/viewWeaponTuning";

type ViewWeaponTuningSectionProps = {
  tuning: ViewWeaponTuning;
  onChange: (
    weapon: PrimaryWeaponId,
    mode: ViewWeaponPoseMode,
    patch: Partial<ViewWeaponPose>,
  ) => void;
  onReset: () => void;
};

const WEAPON_TABS: Array<{ id: PrimaryWeaponId; label: string }> = [
  { id: "rifle", label: "Rifle" },
  { id: "pistol", label: "Pistol" },
];

const MODE_TABS: Array<{ id: ViewWeaponPoseMode; label: string }> = [
  { id: "hip", label: "Hip" },
  { id: "ads", label: "ADS" },
];

export default function ViewWeaponTuningSection({
  tuning,
  onChange,
  onReset,
}: ViewWeaponTuningSectionProps) {
  const [weapon, setWeapon] = useState<PrimaryWeaponId>("rifle");
  const [mode, setMode] = useState<ViewWeaponPoseMode>("ads");
  const [copied, setCopied] = useState(false);
  const pose = tuning[weapon][mode];

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatViewWeaponTuningJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
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
          min={-1.5}
          max={1.5}
          step={0.001}
          value={pose.posX}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { posX: value })}
        />
        <SettingsSlider
          label="Position Y"
          min={-1.5}
          max={1.5}
          step={0.001}
          value={pose.posY}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { posY: value })}
        />
        <SettingsSlider
          label="Position Z"
          min={-1.5}
          max={1.5}
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
          label="Scale"
          min={0.2}
          max={3}
          step={0.001}
          value={pose.scale}
          decimals={3}
          onChange={(value) => onChange(weapon, mode, { scale: value })}
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
