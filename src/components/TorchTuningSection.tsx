"use client";

import { useState } from "react";
import { SettingsSlider } from "@/components/SettingsControls";
import {
  HALO_BRIGHTNESS_MAX,
  HALO_BRIGHTNESS_MIN,
  HALO_BRIGHTNESS_STEP,
  HALO_WIDTH_MAX,
  HALO_WIDTH_MIN,
  HALO_WIDTH_STEP,
  RING_THICKNESS_MAX,
  RING_THICKNESS_MIN,
  RING_THICKNESS_STEP,
  INTENSITY_MULTIPLIER_MAX,
  INTENSITY_MULTIPLIER_MIN,
  INTENSITY_MULTIPLIER_STEP,
  PENUMBRA_MAX,
  PENUMBRA_MIN,
  PENUMBRA_STEP,
  SPREAD_ANGLE_MAX,
  SPREAD_ANGLE_MIN,
  SPREAD_ANGLE_STEP,
  formatFlashlightTuningJson,
  type FlashlightTuning,
} from "@/lib/lighting/flashlightTuning";

type TorchTuningSectionProps = {
  tuning: FlashlightTuning;
  onChange: (patch: Partial<FlashlightTuning>) => void;
  onReset: () => void;
};

export default function TorchTuningSection({
  tuning,
  onChange,
  onReset,
}: TorchTuningSectionProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatFlashlightTuningJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <p className="settings-group-label">Beam</p>
      <div className="settings-list">
        <SettingsSlider
          label="Spread width"
          hint="Outer cone angle — wider lights more area"
          min={SPREAD_ANGLE_MIN}
          max={SPREAD_ANGLE_MAX}
          step={SPREAD_ANGLE_STEP}
          value={tuning.spreadAngleDeg}
          suffix="°"
          decimals={0}
          onChange={(value) => onChange({ spreadAngleDeg: value })}
        />
        <SettingsSlider
          label="Edge softness"
          hint="Penumbra — needs glTF cone falloff; 0 = sharp edge, 1 = soft spill"
          min={PENUMBRA_MIN}
          max={PENUMBRA_MAX}
          step={PENUMBRA_STEP}
          value={tuning.penumbra}
          decimals={2}
          onChange={(value) => onChange({ penumbra: value })}
        />
        <SettingsSlider
          label="Brightness"
          hint="Spot intensity scale"
          min={INTENSITY_MULTIPLIER_MIN}
          max={INTENSITY_MULTIPLIER_MAX}
          step={INTENSITY_MULTIPLIER_STEP}
          value={tuning.intensityMultiplier}
          suffix="×"
          decimals={1}
          onChange={(value) => onChange({ intensityMultiplier: value })}
        />
      </div>

      <p className="settings-group-label">Reflector ring</p>
      <div className="settings-list">
        <SettingsSlider
          label="Ring brightness"
          hint="Hot reflector band on lit floor and surfaces"
          min={HALO_BRIGHTNESS_MIN}
          max={HALO_BRIGHTNESS_MAX}
          step={HALO_BRIGHTNESS_STEP}
          value={tuning.haloBrightness}
          decimals={2}
          onChange={(value) => onChange({ haloBrightness: value })}
        />
        <SettingsSlider
          label="Ring width"
          hint="How far out the ring sits on the projected pool"
          min={HALO_WIDTH_MIN}
          max={HALO_WIDTH_MAX}
          step={HALO_WIDTH_STEP}
          value={tuning.haloWidth}
          suffix="×"
          decimals={1}
          onChange={(value) => onChange({ haloWidth: value })}
        />
        <SettingsSlider
          label="Ring thickness"
          hint="How wide the bright band is — can go very thin"
          min={RING_THICKNESS_MIN}
          max={RING_THICKNESS_MAX}
          step={RING_THICKNESS_STEP}
          value={tuning.ringThickness}
          decimals={3}
          onChange={(value) => onChange({ ringThickness: value })}
        />
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-action-button" onClick={onReset}>
          Reset torch
        </button>
        <button type="button" className="settings-action-button" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </>
  );
}
