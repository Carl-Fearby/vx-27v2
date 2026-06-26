"use client";

import { useEffect, useState, type ReactNode } from "react";
import KeyBindingsSection from "@/components/KeyBindingsSection";
import { SettingsSlider, SettingsToggle } from "@/components/SettingsControls";
import SkyTuningSection from "@/components/SkyTuningSection";
import TorchTuningSection from "@/components/TorchTuningSection";
import type { KeyBindingsMap } from "@/lib/keyBindings";
import type { HudWeaponTuning } from "@/lib/hud/hudWeaponTuning";
import {
  HUD_WEAPON_OPACITY_MAX,
  HUD_WEAPON_OPACITY_MIN,
  HUD_WEAPON_OPACITY_STEP,
} from "@/lib/hud/hudWeaponTuning";
import type { OutdoorLightingTuning } from "@/lib/lighting/outdoorLightingTuning";
import type { FlashlightTuning } from "@/lib/lighting/flashlightTuning";
import type { GameSettings } from "@/lib/settings";
import {
  formatPlayerCoordsJson,
  type PlayerCoords,
} from "@/lib/playerCoords";

type SettingsMenuProps = {
  open: boolean;
  settings: GameSettings;
  onClose: () => void;
  onChange: (patch: Partial<GameSettings>) => void;
  outdoorTuning: OutdoorLightingTuning;
  onOutdoorTuningChange: (patch: Partial<OutdoorLightingTuning>) => void;
  onOutdoorTuningResetHemi: () => void;
  onOutdoorTuningResetAll: () => void;
  flashlightTuning?: FlashlightTuning;
  onFlashlightTuningChange?: (patch: Partial<FlashlightTuning>) => void;
  onFlashlightTuningReset?: () => void;
  hudWeaponTuning?: HudWeaponTuning;
  onHudWeaponTuningChange?: (patch: Partial<HudWeaponTuning>) => void;
  onHudWeaponTuningReset?: () => void;
  playerCoords?: PlayerCoords | null;
  getPlayerCoords?: () => PlayerCoords | null;
  onSectionActiveChange?: (active: boolean) => void;
  bindings?: KeyBindingsMap;
  onBindingsChange?: (next: KeyBindingsMap) => void;
};

type SectionId = "look" | "controls" | "bob" | "keybindings" | "sky" | "torch" | "hud" | "debug";

type SectionConfig = {
  id: SectionId;
  title: string;
  description: string;
};

const LOOK_SECTION: SectionConfig = {
  id: "look",
  title: "Look",
  description: "Sensitivity, easing, and turn rate",
};

const CONTROLS_SECTION: SectionConfig = {
  id: "controls",
  title: "Controls",
  description: "Look inversion",
};

const BOB_SECTION: SectionConfig = {
  id: "bob",
  title: "Bob",
  description: "Walk and run camera motion",
};

const KEYBINDINGS_SECTION: SectionConfig = {
  id: "keybindings",
  title: "Key bindings",
  description: "Movement, actions, and menus",
};

const SKY_SECTION: SectionConfig = {
  id: "sky",
  title: "Sky tuning",
  description: "Sun, hemisphere, and outdoor lighting",
};

const TORCH_SECTION: SectionConfig = {
  id: "torch",
  title: "Torch tuning",
  description: "Beam spread, brightness, and reflector ring",
};

const HUD_SECTION: SectionConfig = {
  id: "hud",
  title: "HUD",
  description: "Weapon stack frame brightness",
};

const DEBUG_SECTION: SectionConfig = {
  id: "debug",
  title: "Debug",
  description: "Player position and diagnostics",
};

function LookSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsSlider
        label="Mouse easing"
        hint="Higher values smooth mouse look more (0 = instant)"
        min={0}
        max={10}
        step={0.1}
        value={settings.mouseLookEase}
        onChange={(value) => onChange({ mouseLookEase: value })}
      />
      <SettingsSlider
        label="Keyboard easing"
        hint="Smooth arrow-key look (0 = instant)"
        min={0}
        max={10}
        step={0.1}
        value={settings.keyboardLookEase}
        onChange={(value) => onChange({ keyboardLookEase: value })}
      />
      <SettingsSlider
        label="Mouse look speed"
        hint="Mouse sensitivity multiplier"
        min={0.5}
        max={10}
        step={0.1}
        value={settings.mouseLookSpeed}
        onChange={(value) => onChange({ mouseLookSpeed: value })}
      />
      <SettingsSlider
        label="Keyboard look speed"
        hint="Arrow key turn rate multiplier"
        min={0.5}
        max={10}
        step={0.1}
        value={settings.keyboardLookSpeed}
        onChange={(value) => onChange({ keyboardLookSpeed: value })}
      />
      <SettingsSlider
        label="Max look rate"
        hint="Caps peak turn speed"
        min={0.5}
        max={20}
        step={0.5}
        value={settings.maxLookRate}
        onChange={(value) => onChange({ maxLookRate: value })}
      />
    </div>
  );
}

function ControlsSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Invert X"
        hint="Reverse horizontal camera pan"
        checked={settings.invertLookX}
        onChange={(checked) => onChange({ invertLookX: checked })}
      />
      <SettingsToggle
        label="Invert Y"
        hint="Reverse vertical camera pan"
        checked={settings.invertLookY}
        onChange={(checked) => onChange({ invertLookY: checked })}
      />
    </div>
  );
}

function BobSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Enable bob"
        hint="Add camera motion while walking or running"
        checked={settings.walkBobEnabled}
        onChange={(checked) => onChange({ walkBobEnabled: checked })}
      />
      <SettingsSlider
        label="Bob amplitude"
        hint="Vertical camera movement"
        min={0}
        max={20}
        step={0.1}
        value={settings.walkBobAmplitudeCm}
        suffix=" cm"
        onChange={(value) => onChange({ walkBobAmplitudeCm: value })}
      />
      <SettingsSlider
        label="Bob duration"
        hint="Seconds per stride cycle"
        min={0.25}
        max={1.2}
        step={0.01}
        value={settings.walkBobDurationSec}
        suffix=" s"
        decimals={2}
        onChange={(value) => onChange({ walkBobDurationSec: value })}
      />
    </div>
  );
}

function HudSection({
  tuning,
  onChange,
  onReset,
}: {
  tuning: HudWeaponTuning;
  onChange: (patch: Partial<HudWeaponTuning>) => void;
  onReset: () => void;
}) {
  return (
    <div className="settings-list">
      <SettingsSlider
        label="Primary weapon frame opacity"
        hint="Bottom-left V/B stack background brightness"
        min={HUD_WEAPON_OPACITY_MIN}
        max={HUD_WEAPON_OPACITY_MAX}
        step={HUD_WEAPON_OPACITY_STEP}
        value={tuning.primaryFrameOpacity}
        onChange={(value) => onChange({ primaryFrameOpacity: value })}
      />
      <SettingsSlider
        label="Secondary weapon frame opacity"
        hint="Bottom-right 1–4 stack background brightness (all slots match)"
        min={HUD_WEAPON_OPACITY_MIN}
        max={HUD_WEAPON_OPACITY_MAX}
        step={HUD_WEAPON_OPACITY_STEP}
        value={tuning.secondaryFrameOpacity}
        onChange={(value) => onChange({ secondaryFrameOpacity: value })}
      />
      <div className="settings-row">
        <button type="button" className="settings-copy-button" onClick={onReset}>
          Reset HUD weapon opacity
        </button>
      </div>
    </div>
  );
}

function DebugSection({
  open,
  getPlayerCoords,
  playerCoords,
}: {
  open: boolean;
  getPlayerCoords?: () => PlayerCoords | null;
  playerCoords?: PlayerCoords | null;
}) {
  const [coords, setCoords] = useState<PlayerCoords | null>(playerCoords ?? null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }

    const readCoords = () => getPlayerCoords?.() ?? playerCoords ?? null;

    setCoords(readCoords());

    let frameId = 0;
    const tick = () => {
      setCoords(readCoords());
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [open, getPlayerCoords, playerCoords]);

  const copyCoords = async () => {
    const latest = getPlayerCoords?.() ?? coords;
    if (!latest) {
      return;
    }

    const text = formatPlayerCoordsJson(latest, false);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="settings-list">
      <div className="settings-row settings-row--coords">
        <span className="settings-row-copy">
          <span className="settings-row-label">Player position</span>
          <span className="settings-row-hint">
            Copy coordinates when reporting bugs
          </span>
          <code className="settings-coords">
            {coords ? formatPlayerCoordsJson(coords) : "Unavailable"}
          </code>
        </span>
        <button
          type="button"
          className="settings-copy-button"
          onClick={() => void copyCoords()}
          disabled={!coords}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

function SettingsSectionNav({
  sections,
  onSelect,
}: {
  sections: SectionConfig[];
  onSelect: (id: SectionId) => void;
}) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {sections.map((section) => (
        <button
          key={section.id}
          type="button"
          className="settings-nav-item"
          onClick={() => onSelect(section.id)}
        >
          <span className="settings-nav-item-copy">
            <span className="settings-nav-item-title">{section.title}</span>
            <span className="settings-nav-item-description">
              {section.description}
            </span>
          </span>
          <span className="settings-nav-item-chevron" aria-hidden="true">
            ›
          </span>
        </button>
      ))}
    </nav>
  );
}

function SettingsSectionPopout({
  section,
  onBack,
  onClose,
  children,
}: {
  section: SectionConfig;
  onBack: () => void;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      className="settings-popout settings-popout--docked"
      role="dialog"
      aria-modal="false"
      aria-labelledby={`settings-section-${section.id}`}
    >
      <header className="settings-popout-header">
        <button
          type="button"
          className="settings-back"
          onClick={onBack}
          aria-label="Back to settings menu"
        >
          ‹
        </button>
        <div>
          <p className="settings-eyebrow">Section</p>
          <h3 className="settings-popout-title" id={`settings-section-${section.id}`}>
            {section.title}
          </h3>
        </div>
        <button
          type="button"
          className="settings-close settings-popout-close"
          onClick={onClose}
          aria-label="Close settings"
        >
          ×
        </button>
      </header>
      <div className="settings-popout-body">{children}</div>
    </aside>
  );
}

export default function SettingsMenu({
  open,
  settings,
  onClose,
  onChange,
  outdoorTuning,
  onOutdoorTuningChange,
  onOutdoorTuningResetHemi,
  onOutdoorTuningResetAll,
  flashlightTuning,
  onFlashlightTuningChange,
  onFlashlightTuningReset,
  hudWeaponTuning,
  onHudWeaponTuningChange,
  onHudWeaponTuningReset,
  playerCoords,
  getPlayerCoords,
  onSectionActiveChange,
  bindings,
  onBindingsChange,
}: SettingsMenuProps) {
  const [activeSection, setActiveSection] = useState<SectionId | null>(null);
  const hasDebug = Boolean(getPlayerCoords || playerCoords);
  const hasKeyBindings = Boolean(bindings && onBindingsChange);

  const sections = [
    LOOK_SECTION,
    CONTROLS_SECTION,
    BOB_SECTION,
    ...(hasKeyBindings ? [KEYBINDINGS_SECTION] : []),
    SKY_SECTION,
    ...(flashlightTuning && onFlashlightTuningChange && onFlashlightTuningReset
      ? [TORCH_SECTION]
      : []),
    ...(hudWeaponTuning && onHudWeaponTuningChange && onHudWeaponTuningReset
      ? [HUD_SECTION]
      : []),
    ...(hasDebug ? [DEBUG_SECTION] : []),
  ];

  const currentSection =
    sections.find((section) => section.id === activeSection) ?? null;

  useEffect(() => {
    if (!open) {
      setActiveSection(null);
    }
  }, [open]);

  useEffect(() => {
    onSectionActiveChange?.(activeSection !== null);
  }, [activeSection, onSectionActiveChange]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (activeSection) {
        setActiveSection(null);
        return;
      }

      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, activeSection]);

  if (!open) {
    return null;
  }

  const sectionContent = currentSection ? (
    <>
      {currentSection.id === "look" ? (
        <LookSection settings={settings} onChange={onChange} />
      ) : null}
      {currentSection.id === "controls" ? (
        <ControlsSection settings={settings} onChange={onChange} />
      ) : null}
      {currentSection.id === "bob" ? (
        <BobSection settings={settings} onChange={onChange} />
      ) : null}
      {currentSection.id === "keybindings" && bindings && onBindingsChange ? (
        <KeyBindingsSection bindings={bindings} onChange={onBindingsChange} />
      ) : null}
      {currentSection.id === "sky" ? (
        <SkyTuningSection
          tuning={outdoorTuning}
          onChange={onOutdoorTuningChange}
          onResetHemi={onOutdoorTuningResetHemi}
          onResetAll={onOutdoorTuningResetAll}
        />
      ) : null}
      {currentSection.id === "torch" &&
      flashlightTuning &&
      onFlashlightTuningChange &&
      onFlashlightTuningReset ? (
        <TorchTuningSection
          tuning={flashlightTuning}
          onChange={onFlashlightTuningChange}
          onReset={onFlashlightTuningReset}
        />
      ) : null}
      {currentSection.id === "hud" &&
      hudWeaponTuning &&
      onHudWeaponTuningChange &&
      onHudWeaponTuningReset ? (
        <HudSection
          tuning={hudWeaponTuning}
          onChange={onHudWeaponTuningChange}
          onReset={onHudWeaponTuningReset}
        />
      ) : null}
      {currentSection.id === "debug" ? (
        <DebugSection
          open={open}
          playerCoords={playerCoords}
          getPlayerCoords={getPlayerCoords}
        />
      ) : null}
    </>
  ) : null;

  if (currentSection) {
    return (
      <SettingsSectionPopout
        section={currentSection}
        onBack={() => setActiveSection(null)}
        onClose={onClose}
      >
        {sectionContent}
      </SettingsSectionPopout>
    );
  }

  return (
    <div className="settings-overlay" role="presentation" onClick={onClose}>
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
      >
        <header className="settings-header">
          <div>
            <p className="settings-eyebrow">Options</p>
            <h2 id="settings-title">Settings</h2>
          </div>
          <button
            type="button"
            className="settings-close"
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </header>

        <div className="settings-body">
          <SettingsSectionNav
            sections={sections}
            onSelect={setActiveSection}
          />
        </div>
      </section>
    </div>
  );
}
