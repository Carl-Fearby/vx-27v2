"use client";

import { useState } from "react";
import { formatSurfaceTuningJson } from "@/lib/materialEdit/applySurfaceTuning";
import { SURFACE_LABELS } from "@/lib/materialEdit/defaults";
import type {
  EditableSurfaceId,
  SurfaceMaterialTuning,
} from "@/lib/materialEdit/types";

function TuningSlider({
  label,
  hint,
  min,
  max,
  step,
  value,
  suffix = "",
  decimals = 2,
  onChange,
}: {
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  value: number;
  suffix?: string;
  decimals?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="settings-row settings-row--slider">
      <span className="settings-row-copy">
        <span className="settings-row-label">
          {label}{" "}
          <output>
            {value.toFixed(decimals)}
            {suffix}
          </output>
        </span>
        <span className="settings-row-hint">{hint}</span>
      </span>
      <input
        type="range"
        className="settings-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

type MaterialEditPanelProps = {
  surfaceId: EditableSurfaceId;
  tuning: SurfaceMaterialTuning;
  onChange: (patch: Partial<SurfaceMaterialTuning>) => void;
  onReset: () => void;
  onClose: () => void;
};

export default function MaterialEditPanel({
  surfaceId,
  tuning,
  onChange,
  onReset,
  onClose,
}: MaterialEditPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(
        formatSurfaceTuningJson(surfaceId, tuning),
      );
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <aside className="material-edit-panel" aria-label="Surface material editor">
      <div className="material-edit-header">
        <div>
          <p className="material-edit-eyebrow">Material edit</p>
          <h2 className="material-edit-title">{SURFACE_LABELS[surfaceId]}</h2>
        </div>
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label="Close material editor"
        >
          ×
        </button>
      </div>

      <div className="material-edit-list">
        <p className="settings-section-label">UV &amp; colour</p>
        <TuningSlider
          label="UV scale U"
          hint="Lower = larger texture horizontally"
          min={0.5}
          max={40}
          step={0.1}
          value={tuning.uvScaleU}
          onChange={(value) => onChange({ uvScaleU: value })}
        />
        <TuningSlider
          label="UV scale V"
          hint="Lower = larger texture vertically"
          min={0.5}
          max={40}
          step={0.1}
          value={tuning.uvScaleV}
          onChange={(value) => onChange({ uvScaleV: value })}
        />
        <TuningSlider
          label="Albedo brightness"
          hint="Overall surface brightness"
          min={0.5}
          max={2}
          step={0.01}
          value={tuning.albedoBrightness}
          onChange={(value) => onChange({ albedoBrightness: value })}
        />

        <p className="settings-section-label">PBR</p>
        <TuningSlider
          label="Roughness"
          hint="0 = mirror smooth, 1 = fully matte"
          min={0}
          max={1}
          step={0.01}
          value={tuning.roughness}
          onChange={(value) => onChange({ roughness: value })}
        />
        <TuningSlider
          label="Metalness"
          hint="Metallic response"
          min={0}
          max={1}
          step={0.01}
          value={tuning.metallic}
          onChange={(value) => onChange({ metallic: value })}
        />
        <TuningSlider
          label="Shininess"
          hint="Clear-coat gloss layer"
          min={0}
          max={1}
          step={0.01}
          value={tuning.shininess}
          onChange={(value) => onChange({ shininess: value })}
        />
        <TuningSlider
          label="Coat roughness"
          hint="Sharpness of clear-coat highlights"
          min={0}
          max={1}
          step={0.01}
          value={tuning.clearCoatRoughness}
          onChange={(value) => onChange({ clearCoatRoughness: value })}
        />
        <TuningSlider
          label="Specular"
          hint="Direct light highlight strength"
          min={0}
          max={5}
          step={0.05}
          value={tuning.specularIntensity}
          onChange={(value) => onChange({ specularIntensity: value })}
        />
        <TuningSlider
          label="Environment"
          hint={
            surfaceId === "floor"
              ? "Sky reflection wash (soft sun gradient)"
              : "Sky/reflection intensity"
          }
          min={0}
          max={4}
          step={0.05}
          value={tuning.environmentIntensity}
          onChange={(value) => onChange({ environmentIntensity: value })}
        />
        <TuningSlider
          label="Normal strength"
          hint="Surface detail from normal map"
          min={0}
          max={2}
          step={0.01}
          value={tuning.normalStrength}
          onChange={(value) => onChange({ normalStrength: value })}
        />

        <div className="settings-actions">
          <button type="button" className="settings-action-button" onClick={onReset}>
            Reset surface
          </button>
          <button
            type="button"
            className="settings-action-button"
            onClick={() => void copyJson()}
          >
            {copied ? "Copied" : "Copy JSON"}
          </button>
        </div>
      </div>
    </aside>
  );
}
