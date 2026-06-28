"use client";

import { useState } from "react";
import { SettingsSlider } from "@/components/SettingsControls";
import {
  formatRecoilTuningJson,
  RECOIL_TUNING_LIMITS,
  type RecoilTuning,
  type RecoilTuningKey,
} from "@/lib/player/recoilTuning";

type RecoilTuningSectionProps = {
  tuning: RecoilTuning;
  onChange: (patch: Partial<RecoilTuning>) => void;
  onReset: () => void;
};

const AIM_ROWS: Array<{ key: RecoilTuningKey; label: string }> = [
  { key: "aimRecoilPitch", label: "Aim pitch kick" },
  { key: "aimRecoilYaw", label: "Aim yaw kick" },
  { key: "springStiffness", label: "Aim spring stiffness" },
  { key: "springDamping", label: "Aim spring damping" },
  { key: "kickVelScale", label: "Aim kick velocity" },
];

const WEAPON_ROWS: Array<{ key: RecoilTuningKey; label: string }> = [
  { key: "fireRecoilBack", label: "Weapon kick back" },
  { key: "fireRecoilPitch", label: "Weapon pitch kick" },
  { key: "fireRecoilStiffness", label: "Weapon spring stiffness" },
  { key: "fireRecoilDamping", label: "Weapon spring damping" },
  { key: "fireRecoilKickVelScale", label: "Weapon back velocity" },
  { key: "fireRecoilPitchVelScale", label: "Weapon pitch velocity" },
];

function RecoilSlider({
  label,
  field,
  tuning,
  onChange,
}: {
  label: string;
  field: RecoilTuningKey;
  tuning: RecoilTuning;
  onChange: (patch: Partial<RecoilTuning>) => void;
}) {
  const limit = RECOIL_TUNING_LIMITS[field];
  return (
    <SettingsSlider
      label={label}
      min={limit.min}
      max={limit.max}
      step={limit.step}
      value={tuning[field]}
      decimals={limit.decimals}
      onChange={(value) => onChange({ [field]: value })}
    />
  );
}

export default function RecoilTuningSection({
  tuning,
  onChange,
  onReset,
}: RecoilTuningSectionProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatRecoilTuningJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="settings-list">
        <p className="settings-group-label">Camera recoil</p>
        {AIM_ROWS.map((row) => (
          <RecoilSlider
            key={row.key}
            label={row.label}
            field={row.key}
            tuning={tuning}
            onChange={onChange}
          />
        ))}
        <p className="settings-group-label">Weapon recoil</p>
        {WEAPON_ROWS.map((row) => (
          <RecoilSlider
            key={row.key}
            label={row.label}
            field={row.key}
            tuning={tuning}
            onChange={onChange}
          />
        ))}
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
