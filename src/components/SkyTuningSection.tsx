"use client";

import { useEffect, useState } from "react";
import type { SkyTuningPreviewMode } from "@/lib/lighting/createOutdoorSky";
import { SettingsSlider } from "@/components/SettingsControls";
import {
  HEMI_INTENSITY_MAX,
  HEMI_INTENSITY_MIN,
  HEMI_INTENSITY_STEP,
  HEMI_TEMPERATURE_MAX,
  HEMI_TEMPERATURE_MIN,
  HEMI_TEMPERATURE_STEP,
  MOON_AZIMUTH_MAX,
  MOON_AZIMUTH_MIN,
  MOON_AZIMUTH_STEP,
  MOON_ELEVATION_MAX,
  MOON_ELEVATION_MIN,
  MOON_ELEVATION_STEP,
  MOON_INTENSITY_MAX,
  MOON_INTENSITY_MIN,
  MOON_INTENSITY_STEP,
  MOON_TEMPERATURE_MAX,
  MOON_TEMPERATURE_MIN,
  MOON_TEMPERATURE_STEP,
  SHELTERED_HEMI_MUL_MAX,
  SHELTERED_HEMI_MUL_MIN,
  SHELTERED_HEMI_MUL_STEP,
  SHADOW_DEPTH_MAX,
  SHADOW_DEPTH_MIN,
  SHADOW_DEPTH_STEP,
  SUN_AZIMUTH_MAX,
  SUN_AZIMUTH_MIN,
  SUN_AZIMUTH_STEP,
  SUN_ELEVATION_MAX,
  SUN_ELEVATION_MIN,
  SUN_ELEVATION_STEP,
  SUN_INTENSITY_MAX,
  SUN_INTENSITY_MIN,
  SUN_INTENSITY_STEP,
  SUN_TEMPERATURE_MAX,
  SUN_TEMPERATURE_MIN,
  SUN_TEMPERATURE_STEP,
  formatOutdoorLightingJson,
  type OutdoorLightingTuning,
} from "@/lib/lighting/outdoorLightingTuning";

type SkyTuningSectionProps = {
  tuning: OutdoorLightingTuning;
  onChange: (patch: Partial<OutdoorLightingTuning>) => void;
  onResetHemi: () => void;
  onResetAll: () => void;
  onPreviewModeChange?: (mode: SkyTuningPreviewMode) => void;
};

type SkyTab = "sun" | "moon" | "ambient";

const SKY_TABS: { id: SkyTab; label: string }[] = [
  { id: "sun", label: "Sun" },
  { id: "moon", label: "Moon" },
  { id: "ambient", label: "Ambient" },
];

function previewModeForTab(tab: SkyTab): SkyTuningPreviewMode {
  if (tab === "sun") {
    return "day";
  }
  if (tab === "moon") {
    return "night";
  }
  return null;
}

export default function SkyTuningSection({
  tuning,
  onChange,
  onResetHemi,
  onResetAll,
  onPreviewModeChange,
}: SkyTuningSectionProps) {
  const [activeTab, setActiveTab] = useState<SkyTab>("sun");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!onPreviewModeChange) {
      return;
    }
    onPreviewModeChange(previewModeForTab(activeTab));
  }, [activeTab, onPreviewModeChange]);

  useEffect(() => {
    if (!onPreviewModeChange) {
      return;
    }
    return () => onPreviewModeChange(null);
  }, [onPreviewModeChange]);

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(formatOutdoorLightingJson(tuning));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <>
      <div className="settings-tabs" role="tablist" aria-label="Sky tuning sections">
        {SKY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`settings-tab${activeTab === tab.id ? " settings-tab--active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "sun" ? (
        <div className="settings-list" role="tabpanel">
          <SettingsSlider
            label="Intensity"
            hint="Directional sun key light"
            min={SUN_INTENSITY_MIN}
            max={SUN_INTENSITY_MAX}
            step={SUN_INTENSITY_STEP}
            value={tuning.sunIntensity}
            decimals={2}
            onChange={(value) => onChange({ sunIntensity: value })}
          />
          <SettingsSlider
            label="Temperature"
            hint="Colour temperature"
            min={SUN_TEMPERATURE_MIN}
            max={SUN_TEMPERATURE_MAX}
            step={SUN_TEMPERATURE_STEP}
            value={tuning.sunTemperature}
            suffix="K"
            decimals={0}
            onChange={(value) => onChange({ sunTemperature: value })}
          />
          <SettingsSlider
            label="Azimuth"
            hint="Compass bearing — 0° north, 90° east, 270° west"
            min={SUN_AZIMUTH_MIN}
            max={SUN_AZIMUTH_MAX}
            step={SUN_AZIMUTH_STEP}
            value={tuning.sunAzimuth}
            suffix="°"
            decimals={0}
            onChange={(value) => onChange({ sunAzimuth: value })}
          />
          <SettingsSlider
            label="Elevation"
            hint="Peak height above horizon at day / night transition"
            min={SUN_ELEVATION_MIN}
            max={SUN_ELEVATION_MAX}
            step={SUN_ELEVATION_STEP}
            value={tuning.sunElevation}
            suffix="°"
            decimals={1}
            onChange={(value) => onChange({ sunElevation: value })}
          />
        </div>
      ) : null}

      {activeTab === "moon" ? (
        <div className="settings-list" role="tabpanel">
          <SettingsSlider
            label="Intensity"
            hint="Directional moon key light"
            min={MOON_INTENSITY_MIN}
            max={MOON_INTENSITY_MAX}
            step={MOON_INTENSITY_STEP}
            value={tuning.moonIntensity}
            decimals={2}
            onChange={(value) => onChange({ moonIntensity: value })}
          />
          <SettingsSlider
            label="Temperature"
            hint="Moon key light colour"
            min={MOON_TEMPERATURE_MIN}
            max={MOON_TEMPERATURE_MAX}
            step={MOON_TEMPERATURE_STEP}
            value={tuning.moonTemperature}
            suffix="K"
            decimals={0}
            onChange={(value) => onChange({ moonTemperature: value })}
          />
          <SettingsSlider
            label="Azimuth"
            hint="Compass bearing — 0° north, 90° east, 270° west"
            min={MOON_AZIMUTH_MIN}
            max={MOON_AZIMUTH_MAX}
            step={MOON_AZIMUTH_STEP}
            value={tuning.moonAzimuth}
            suffix="°"
            decimals={0}
            onChange={(value) => onChange({ moonAzimuth: value })}
          />
          <SettingsSlider
            label="Elevation"
            hint="Peak height above horizon at night / day transition"
            min={MOON_ELEVATION_MIN}
            max={MOON_ELEVATION_MAX}
            step={MOON_ELEVATION_STEP}
            value={tuning.moonElevation}
            suffix="°"
            decimals={1}
            onChange={(value) => onChange({ moonElevation: value })}
          />
        </div>
      ) : null}

      {activeTab === "ambient" ? (
        <>
          <p className="settings-group-label">Day hemisphere</p>
          <div className="settings-list" role="tabpanel">
            <SettingsSlider
              label="Hemi temperature"
              hint="Sky ambient fill colour"
              min={HEMI_TEMPERATURE_MIN}
              max={HEMI_TEMPERATURE_MAX}
              step={HEMI_TEMPERATURE_STEP}
              value={tuning.hemiDay.temperature}
              suffix="K"
              decimals={0}
              onChange={(value) =>
                onChange({ hemiDay: { ...tuning.hemiDay, temperature: value } })
              }
            />
            <SettingsSlider
              label="Hemi intensity"
              hint="Day hemisphere brightness"
              min={HEMI_INTENSITY_MIN}
              max={HEMI_INTENSITY_MAX}
              step={HEMI_INTENSITY_STEP}
              value={tuning.hemiDay.intensity}
              decimals={2}
              onChange={(value) =>
                onChange({ hemiDay: { ...tuning.hemiDay, intensity: value } })
              }
            />
          </div>

          <p className="settings-group-label">Night hemisphere</p>
          <div className="settings-list">
            <SettingsSlider
              label="Hemi temperature"
              hint="Night sky ambient fill colour"
              min={HEMI_TEMPERATURE_MIN}
              max={HEMI_TEMPERATURE_MAX}
              step={HEMI_TEMPERATURE_STEP}
              value={tuning.hemiNight.temperature}
              suffix="K"
              decimals={0}
              onChange={(value) =>
                onChange({
                  hemiNight: { ...tuning.hemiNight, temperature: value },
                })
              }
            />
            <SettingsSlider
              label="Hemi intensity"
              hint="Night hemisphere brightness"
              min={HEMI_INTENSITY_MIN}
              max={HEMI_INTENSITY_MAX}
              step={HEMI_INTENSITY_STEP}
              value={tuning.hemiNight.intensity}
              decimals={2}
              onChange={(value) =>
                onChange({ hemiNight: { ...tuning.hemiNight, intensity: value } })
              }
            />
          </div>

          <p className="settings-group-label">Shadows</p>
          <div className="settings-list">
            <SettingsSlider
              label="Shadow depth"
              hint="How dark sun and moon shadows appear"
              min={SHADOW_DEPTH_MIN}
              max={SHADOW_DEPTH_MAX}
              step={SHADOW_DEPTH_STEP}
              value={tuning.shadowDepth}
              decimals={2}
              onChange={(value) => onChange({ shadowDepth: value })}
            />
          </div>

          <p className="settings-group-label">Shared</p>
          <div className="settings-list">
            <SettingsSlider
              label="Sheltered hemi scale"
              hint="Extra scale under cover"
              min={SHELTERED_HEMI_MUL_MIN}
              max={SHELTERED_HEMI_MUL_MAX}
              step={SHELTERED_HEMI_MUL_STEP}
              value={tuning.shelteredHemiMul}
              suffix="×"
              decimals={2}
              onChange={(value) => onChange({ shelteredHemiMul: value })}
            />
          </div>
        </>
      ) : null}

      <div className="settings-actions">
        <button type="button" className="settings-action-button" onClick={onResetHemi}>
          Reset hemi
        </button>
        <button type="button" className="settings-action-button" onClick={onResetAll}>
          Reset all
        </button>
        <button type="button" className="settings-action-button" onClick={() => void copyJson()}>
          {copied ? "Copied" : "Copy JSON"}
        </button>
      </div>
    </>
  );
}
