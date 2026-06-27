"use client";

import { useState } from "react";
import { SettingsSlider } from "@/components/SettingsControls";
import {
  HUD_WEAPON_OPACITY_MAX,
  HUD_WEAPON_OPACITY_MIN,
  HUD_WEAPON_OPACITY_STEP,
  type HudWeaponTuning,
} from "@/lib/hud/hudWeaponTuning";

type HudWeaponTuningSectionProps = {
  tuning: HudWeaponTuning;
  onChange: (patch: Partial<HudWeaponTuning>) => void;
  onReset: () => void;
};

export default function HudWeaponTuningSection({
  tuning,
  onChange,
  onReset,
}: HudWeaponTuningSectionProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(tuning, null, 2));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="settings-list">
        <SettingsSlider
          label="Primary weapon opacity"
          hint="Pistol / rifle frame transparency"
          min={HUD_WEAPON_OPACITY_MIN}
          max={HUD_WEAPON_OPACITY_MAX}
          step={HUD_WEAPON_OPACITY_STEP}
          value={tuning.primaryFrameOpacity}
          decimals={2}
          onChange={(value) => onChange({ primaryFrameOpacity: value })}
        />
        <SettingsSlider
          label="Secondary weapon opacity"
          hint="Off-hand weapon frame transparency"
          min={HUD_WEAPON_OPACITY_MIN}
          max={HUD_WEAPON_OPACITY_MAX}
          step={HUD_WEAPON_OPACITY_STEP}
          value={tuning.secondaryFrameOpacity}
          decimals={2}
          onChange={(value) => onChange({ secondaryFrameOpacity: value })}
        />
      </div>
      <div className="settings-actions">
        <button type="button" className="settings-action-button" onClick={onReset}>
          Reset
        </button>
        <button type="button" className="settings-action-button" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </>
  );
}
