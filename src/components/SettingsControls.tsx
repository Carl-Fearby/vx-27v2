"use client";

export function SettingsSlider({
  label,
  hint,
  min,
  max,
  step,
  value,
  suffix = "",
  decimals = 1,
  onChange,
}: {
  label: string;
  hint?: string;
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
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </span>
      <span className="settings-row-control">
        <input
          type="range"
          className="settings-slider"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        <output>
          {value.toFixed(decimals)}
          {suffix}
        </output>
      </span>
    </label>
  );
}

export function SettingsToggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="settings-row settings-row--toggle">
      <span className="settings-row-copy">
        <span className="settings-row-label">{label}</span>
        {hint ? <span className="settings-row-hint">{hint}</span> : null}
      </span>
      <input
        type="checkbox"
        className="settings-toggle"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
