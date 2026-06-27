"use client";

import { useState } from "react";
import { SettingsSlider, SettingsToggle } from "@/components/SettingsControls";
import {
  MOTION_BLUR_SAMPLES_MAX,
  MOTION_BLUR_SAMPLES_MIN,
  MOTION_BLUR_SAMPLES_STEP,
  MOTION_STRENGTH_MAX,
  MOTION_STRENGTH_MIN,
  MOTION_STRENGTH_STEP,
  formatMotionBlurTuningJson,
  type MotionBlurTuning,
} from "@/lib/postProcess/motionBlurTuning";

type MotionBlurTuningSectionProps = {
  tuning: MotionBlurTuning;
  onChange: (patch: Partial<MotionBlurTuning>) => void;
  onReset: () => void;
};

export default function MotionBlurTuningSection({
  tuning,
  onChange,
  onReset,
}: MotionBlurTuningSectionProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatMotionBlurTuningJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="settings-list">
        <SettingsToggle
          label="Motion blur"
          hint="Screen-space blur when looking or moving"
          checked={tuning.enabled}
          onChange={(enabled) => onChange({ enabled })}
        />
        <SettingsSlider
          label="Strength"
          hint="Blur amount while turning or bobbing — try 0.5–1.0 when testing"
          min={MOTION_STRENGTH_MIN}
          max={MOTION_STRENGTH_MAX}
          step={MOTION_STRENGTH_STEP}
          value={tuning.motionStrength}
          decimals={2}
          onChange={(value) => onChange({ motionStrength: value })}
        />
        <SettingsSlider
          label="Quality"
          hint="Blur samples — higher = smoother, heavier on GPU"
          min={MOTION_BLUR_SAMPLES_MIN}
          max={MOTION_BLUR_SAMPLES_MAX}
          step={MOTION_BLUR_SAMPLES_STEP}
          value={tuning.motionBlurSamples}
          decimals={0}
          onChange={(value) => onChange({ motionBlurSamples: value })}
        />
      </div>

      <div className="settings-actions">
        <button type="button" className="settings-action-button" onClick={onReset}>
          Reset motion blur
        </button>
        <button type="button" className="settings-action-button" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </>
  );
}
