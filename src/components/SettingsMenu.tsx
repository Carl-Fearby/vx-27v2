"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import KeyBindingsSection from "@/components/KeyBindingsSection";
import { SettingsSlider, SettingsToggle } from "@/components/SettingsControls";
import MotionBlurTuningSection from "@/components/MotionBlurTuningSection";
import HudWeaponTuningSection from "@/components/HudWeaponTuningSection";
import SkyTuningSection from "@/components/SkyTuningSection";
import TorchTuningSection from "@/components/TorchTuningSection";
import RoundDisplayTuningSection from "@/components/RoundDisplayTuningSection";
import ViewWeaponTuningSection from "@/components/ViewWeaponTuningSection";
import RecoilTuningSection from "@/components/RecoilTuningSection";
import type { KeyBindingsMap } from "@/lib/keyBindings";
import type { HudWeaponTuning } from "@/lib/hud/hudWeaponTuning";
import type { PrimaryWeaponId } from "@/lib/hud/weaponHud";
import type { SkyTuningPreviewMode } from "@/lib/lighting/createOutdoorSky";
import type { OutdoorLightingTuning } from "@/lib/lighting/outdoorLightingTuning";
import type { FlashlightTuning } from "@/lib/lighting/flashlightTuning";
import type { MotionBlurTuning } from "@/lib/postProcess/motionBlurTuning";
import type { GameSettings } from "@/lib/settings";
import type {
  ViewWeaponPose,
  ViewWeaponPoseMode,
  ViewWeaponTuning,
} from "@/lib/weapons/viewWeaponTuning";
import type {
  RoundDisplayPoseMode,
  RoundDisplayTuning,
  WeaponRoundDisplayPose,
} from "@/lib/weapons/weaponRoundDisplayTuning";
import {
  formatPlayerCoordsJson,
  type PlayerCoords,
} from "@/lib/playerCoords";
import type { RecoilTuning } from "@/lib/player/recoilTuning";

type SettingsMenuProps = {
  open: boolean;
  settings: GameSettings;
  onClose: () => void;
  onChange: (patch: Partial<GameSettings>) => void;
  outdoorTuning: OutdoorLightingTuning;
  onOutdoorTuningChange: (patch: Partial<OutdoorLightingTuning>) => void;
  onOutdoorTuningResetHemi: () => void;
  onOutdoorTuningResetAll: () => void;
  onSkyPreviewModeChange?: (mode: SkyTuningPreviewMode) => void;
  flashlightTuning?: FlashlightTuning;
  onFlashlightTuningChange?: (patch: Partial<FlashlightTuning>) => void;
  onFlashlightTuningReset?: () => void;
  motionBlurTuning?: MotionBlurTuning;
  onMotionBlurTuningChange?: (patch: Partial<MotionBlurTuning>) => void;
  onMotionBlurTuningReset?: () => void;
  hudWeaponTuning?: HudWeaponTuning;
  onHudWeaponTuningChange?: (patch: Partial<HudWeaponTuning>) => void;
  onHudWeaponTuningReset?: () => void;
  viewWeaponTuning?: ViewWeaponTuning;
  onViewWeaponTuningChange?: (
    weapon: PrimaryWeaponId,
    mode: ViewWeaponPoseMode,
    patch: Partial<ViewWeaponPose>,
  ) => void;
  onViewWeaponTuningReset?: () => void;
  roundDisplayTuning?: RoundDisplayTuning;
  onRoundDisplayTuningChange?: (
    weapon: PrimaryWeaponId,
    mode: RoundDisplayPoseMode,
    patch: Partial<WeaponRoundDisplayPose>,
  ) => void;
  onRoundDisplayTuningReset?: () => void;
  onRoundDisplayPreviewChange?: (
    preview: { weapon: PrimaryWeaponId; mode: RoundDisplayPoseMode } | null,
  ) => void;
  recoilTuning?: RecoilTuning;
  onRecoilTuningChange?: (patch: Partial<RecoilTuning>) => void;
  onRecoilTuningReset?: () => void;
  playerCoords?: PlayerCoords | null;
  getPlayerCoords?: () => PlayerCoords | null;
  onSectionActiveChange?: (active: boolean) => void;
  bindings?: KeyBindingsMap;
  onBindingsChange?: (next: KeyBindingsMap) => void;
};

type SectionId =
  | "audio"
  | "look"
  | "controls"
  | "look-inversion"
  | "keybindings"
  | "visuals"
  | "hud-visibility"
  | "motionblur"
  | "hud-weapon"
  | "view-weapon"
  | "ammo-display"
  | "recoil"
  | "development"
  | "player-position"
  | "local-storage"
  | "fly"
  | "bob"
  | "sky"
  | "torch"
  | "debug";

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

const AUDIO_SECTION: SectionConfig = {
  id: "audio",
  title: "Audio",
  description: "Music playback",
};

const CONTROLS_SECTION: SectionConfig = {
  id: "controls",
  title: "Controls",
  description: "Look inversion and key bindings",
};

const LOOK_INVERSION_SECTION: SectionConfig = {
  id: "look-inversion",
  title: "Look inversion",
  description: "Reverse camera axes",
};

const BOB_SECTION: SectionConfig = {
  id: "bob",
  title: "Bob tuning",
  description: "Walk and run camera motion",
};

const VISUALS_SECTION: SectionConfig = {
  id: "visuals",
  title: "Visuals",
  description: "Post-processing and display effects",
};

const HUD_VISIBILITY_SECTION: SectionConfig = {
  id: "hud-visibility",
  title: "HUD visibility",
  description: "Show or hide the in-game HUD",
};

const MOTION_BLUR_SECTION: SectionConfig = {
  id: "motionblur",
  title: "Motion blur",
  description: "Post-process camera smear",
};

const HUD_WEAPON_SECTION: SectionConfig = {
  id: "hud-weapon",
  title: "HUD weapon opacity",
  description: "Primary and secondary weapon frames",
};

const VIEW_WEAPON_SECTION: SectionConfig = {
  id: "view-weapon",
  title: "Weapon pose tuning",
  description: "First-person hip and ADS alignment",
};

const AMMO_DISPLAY_SECTION: SectionConfig = {
  id: "ammo-display",
  title: "Ammo display tuning",
  description: "Gun-mounted round counter placement",
};

const RECOIL_SECTION: SectionConfig = {
  id: "recoil",
  title: "Recoil tuning",
  description: "Camera kick and weapon spring response",
};

const DEVELOPMENT_SECTION: SectionConfig = {
  id: "development",
  title: "Development",
  description: "Tuning panels and diagnostics",
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

const PLAYER_POSITION_SECTION: SectionConfig = {
  id: "player-position",
  title: "Player position",
  description: "Copy current world coordinates",
};

const LOCAL_STORAGE_SECTION: SectionConfig = {
  id: "local-storage",
  title: "Local Storage",
  description: "Copy or delete saved JSON data",
};

const FLY_SECTION: SectionConfig = {
  id: "fly",
  title: "Fly",
  description: "Free camera level inspection",
};

const DEBUG_SECTION: SectionConfig = {
  id: "debug",
  title: "Debug",
  description: "Diagnostics",
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

function AudioSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Music"
        hint="Play loading and in-level soundtrack"
        checked={settings.musicEnabled}
        onChange={(checked) => onChange({ musicEnabled: checked })}
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

function HudVisibilitySection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Show HUD"
        hint="Display health, ammo, compass, and weapon stacks"
        checked={settings.hudVisible}
        onChange={(checked) => onChange({ hudVisible: checked })}
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

function PlayerPositionSection({
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
      return;
    }

    const readCoords = () => getPlayerCoords?.() ?? playerCoords ?? null;

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

function LocalStorageSection() {
  const [status, setStatus] = useState("");

  const readVx27Storage = () => {
    if (typeof window === "undefined") {
      return {};
    }

    return Object.fromEntries(
      Object.keys(window.localStorage)
        .filter((key) => key.startsWith("vx27-"))
        .sort()
        .map((key) => [key, window.localStorage.getItem(key)]),
    );
  };

  const notifyStorageReset = () => {
    try {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    } catch {
      window.dispatchEvent(new Event("storage"));
    }
  };

  const copyJson = async () => {
    const text = JSON.stringify(readVx27Storage(), null, 2);

    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied JSON");
    } catch {
      setStatus("Copy failed");
    }
  };

  const deleteJson = () => {
    const keys = Object.keys(window.localStorage).filter((key) =>
      key.startsWith("vx27-"),
    );

    for (const key of keys) {
      window.localStorage.removeItem(key);
    }

    notifyStorageReset();
    setStatus(keys.length ? "Deleted JSON" : "No JSON found");
  };

  return (
    <div className="settings-list">
      <div className="settings-row">
        <span className="settings-row-copy">
          <span className="settings-row-label">VX-27 JSON</span>
          <span className="settings-row-hint">
            Export or clear saved settings, bindings, and tuning data
          </span>
          {status ? <span className="settings-row-hint">{status}</span> : null}
        </span>
        <span className="settings-row-control">
          <button
            type="button"
            className="settings-copy-button"
            onClick={() => void copyJson()}
          >
            Copy
          </button>
          <button
            type="button"
            className="settings-copy-button"
            onClick={deleteJson}
          >
            Delete
          </button>
        </span>
      </div>
    </div>
  );
}

function FlySection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Fly mode"
        hint="Free camera movement; turning it off drops the player to the ground below"
        checked={settings.flyModeEnabled}
        onChange={(checked) => onChange({ flyModeEnabled: checked })}
      />
    </div>
  );
}

function DebugSection({
  settings,
  onChange,
}: {
  settings: GameSettings;
  onChange: (patch: Partial<GameSettings>) => void;
}) {
  return (
    <div className="settings-list">
      <SettingsToggle
        label="Show collision footprint"
        hint="Draw the player floor collision circle; turns orange when blocked"
        checked={settings.showPlayerCollisionFootprint}
        onChange={(checked) => onChange({ showPlayerCollisionFootprint: checked })}
      />
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
  onDismiss,
  children,
}: {
  section: SectionConfig;
  onBack: () => void;
  onDismiss: () => void;
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
          onClick={onDismiss}
          aria-label="Back to main settings menu"
        >
          ×
        </button>
      </header>
      <div className="settings-popout-body">{children}</div>
    </aside>
  );
}

/** Floating dev tuning window — separate from the settings slide-out panel. */
function SettingsDevWindow({
  section,
  windowIndex,
  onClose,
  children,
}: {
  section: SectionConfig;
  windowIndex: number;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <aside
      className="settings-dev-window"
      style={{ "--dev-window-offset": windowIndex } as React.CSSProperties}
      role="dialog"
      aria-modal="false"
      aria-labelledby={`settings-dev-window-${section.id}`}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="settings-dev-window-header">
        <div>
          <p className="settings-dev-window-eyebrow">Development</p>
          <h3
            className="settings-dev-window-title"
            id={`settings-dev-window-${section.id}`}
          >
            {section.title}
          </h3>
        </div>
        <button
          type="button"
          className="settings-close"
          onClick={onClose}
          aria-label={`Close ${section.title}`}
        >
          ×
        </button>
      </header>
      <div className="settings-dev-window-body">{children}</div>
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
  onSkyPreviewModeChange,
  flashlightTuning,
  onFlashlightTuningChange,
  onFlashlightTuningReset,
  motionBlurTuning,
  onMotionBlurTuningChange,
  onMotionBlurTuningReset,
  hudWeaponTuning,
  onHudWeaponTuningChange,
  onHudWeaponTuningReset,
  viewWeaponTuning,
  onViewWeaponTuningChange,
  onViewWeaponTuningReset,
  roundDisplayTuning,
  onRoundDisplayTuningChange,
  onRoundDisplayTuningReset,
  onRoundDisplayPreviewChange,
  recoilTuning,
  onRecoilTuningChange,
  onRecoilTuningReset,
  playerCoords,
  getPlayerCoords,
  onSectionActiveChange,
  bindings,
  onBindingsChange,
}: SettingsMenuProps) {
  const [sectionStack, setSectionStack] = useState<SectionId[]>([]);
  const [openDevWindows, setOpenDevWindows] = useState<SectionId[]>([]);
  const hasDebug = Boolean(getPlayerCoords || playerCoords);
  const hasKeyBindings = Boolean(bindings && onBindingsChange);
  const hasMotionBlur = Boolean(
    motionBlurTuning && onMotionBlurTuningChange && onMotionBlurTuningReset,
  );
  const hasTorch = Boolean(
    flashlightTuning && onFlashlightTuningChange && onFlashlightTuningReset,
  );
  const hasHudWeapon = Boolean(
    hudWeaponTuning && onHudWeaponTuningChange && onHudWeaponTuningReset,
  );
  const hasViewWeapon = Boolean(
    viewWeaponTuning && onViewWeaponTuningChange && onViewWeaponTuningReset,
  );
  const hasRoundDisplay = Boolean(
    roundDisplayTuning &&
      onRoundDisplayTuningChange &&
      onRoundDisplayTuningReset &&
      onRoundDisplayPreviewChange,
  );
  const hasRecoil = Boolean(
    recoilTuning && onRecoilTuningChange && onRecoilTuningReset,
  );

  const topSections = [
    AUDIO_SECTION,
    LOOK_SECTION,
    CONTROLS_SECTION,
    VISUALS_SECTION,
    DEVELOPMENT_SECTION,
  ];

  const controlsSections = [
    LOOK_INVERSION_SECTION,
    ...(hasKeyBindings ? [KEYBINDINGS_SECTION] : []),
  ];
  const visualsSections = [
    HUD_VISIBILITY_SECTION,
    ...(hasMotionBlur ? [MOTION_BLUR_SECTION] : []),
  ];
  const developmentSections = [
    ...(hasDebug ? [PLAYER_POSITION_SECTION] : []),
    LOCAL_STORAGE_SECTION,
    FLY_SECTION,
    BOB_SECTION,
    SKY_SECTION,
    ...(hasTorch ? [TORCH_SECTION] : []),
    ...(hasHudWeapon ? [HUD_WEAPON_SECTION] : []),
    ...(hasViewWeapon ? [VIEW_WEAPON_SECTION] : []),
    ...(hasRoundDisplay ? [AMMO_DISPLAY_SECTION] : []),
    ...(hasRecoil ? [RECOIL_SECTION] : []),
    ...(hasDebug ? [DEBUG_SECTION] : []),
  ];

  const childSectionsByParent: Partial<Record<SectionId, SectionConfig[]>> = {
    controls: controlsSections,
    visuals: visualsSections,
    development: developmentSections,
  };

  const allSections = [
    ...topSections,
    ...controlsSections,
    ...visualsSections,
    ...developmentSections,
  ];
  const sectionById = Object.fromEntries(
    allSections.map((section) => [section.id, section]),
  ) as Record<SectionId, SectionConfig>;

  const pushSection = (id: SectionId) => {
    setSectionStack((current) => [...current, id]);
  };

  const openDevWindow = (id: SectionId) => {
    if (id === "development" || childSectionsByParent[id]) {
      return;
    }
    setOpenDevWindows((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };

  const closeDevWindow = (id: SectionId) => {
    if (id === "ammo-display") {
      onRoundDisplayPreviewChange?.(null);
    }
    setOpenDevWindows((current) => current.filter((sectionId) => sectionId !== id));
  };

  const openTopSection = (id: SectionId) => {
    setSectionStack([id]);
  };

  const popSection = () => {
    setSectionStack((current) => current.slice(0, -1));
  };

  const clearSections = () => {
    setSectionStack([]);
  };

  const renderSectionContent = (sectionId: SectionId) => {
    const childSections = childSectionsByParent[sectionId];
    if (childSections) {
      return (
        <SettingsSectionNav
          sections={childSections}
          onSelect={sectionId === "development" ? openDevWindow : pushSection}
        />
      );
    }

    switch (sectionId) {
      case "look":
        return <LookSection settings={settings} onChange={onChange} />;
      case "audio":
        return <AudioSection settings={settings} onChange={onChange} />;
      case "look-inversion":
        return <ControlsSection settings={settings} onChange={onChange} />;
      case "hud-visibility":
        return (
          <HudVisibilitySection settings={settings} onChange={onChange} />
        );
      case "player-position":
        return (
          <PlayerPositionSection
            open={openDevWindows.includes("player-position")}
            playerCoords={playerCoords}
            getPlayerCoords={getPlayerCoords}
          />
        );
      case "local-storage":
        return <LocalStorageSection />;
      case "fly":
        return <FlySection settings={settings} onChange={onChange} />;
      case "bob":
        return <BobSection settings={settings} onChange={onChange} />;
      case "motionblur":
        return motionBlurTuning &&
          onMotionBlurTuningChange &&
          onMotionBlurTuningReset ? (
          <MotionBlurTuningSection
            tuning={motionBlurTuning}
            onChange={onMotionBlurTuningChange}
            onReset={onMotionBlurTuningReset}
          />
        ) : null;
      case "keybindings":
        return bindings && onBindingsChange ? (
          <KeyBindingsSection bindings={bindings} onChange={onBindingsChange} />
        ) : null;
      case "sky":
        return (
          <SkyTuningSection
            tuning={outdoorTuning}
            onChange={onOutdoorTuningChange}
            onResetHemi={onOutdoorTuningResetHemi}
            onResetAll={onOutdoorTuningResetAll}
            onPreviewModeChange={onSkyPreviewModeChange}
          />
        );
      case "torch":
        return flashlightTuning &&
          onFlashlightTuningChange &&
          onFlashlightTuningReset ? (
          <TorchTuningSection
            tuning={flashlightTuning}
            onChange={onFlashlightTuningChange}
            onReset={onFlashlightTuningReset}
          />
        ) : null;
      case "hud-weapon":
        return hudWeaponTuning &&
          onHudWeaponTuningChange &&
          onHudWeaponTuningReset ? (
          <HudWeaponTuningSection
            tuning={hudWeaponTuning}
            onChange={onHudWeaponTuningChange}
            onReset={onHudWeaponTuningReset}
          />
        ) : null;
      case "view-weapon":
        return viewWeaponTuning &&
          onViewWeaponTuningChange &&
          onViewWeaponTuningReset ? (
          <ViewWeaponTuningSection
            tuning={viewWeaponTuning}
            onChange={onViewWeaponTuningChange}
            onReset={onViewWeaponTuningReset}
          />
        ) : null;
      case "ammo-display":
        return roundDisplayTuning &&
          onRoundDisplayTuningChange &&
          onRoundDisplayTuningReset &&
          onRoundDisplayPreviewChange ? (
          <RoundDisplayTuningSection
            tuning={roundDisplayTuning}
            onChange={onRoundDisplayTuningChange}
            onReset={onRoundDisplayTuningReset}
            onPreviewChange={onRoundDisplayPreviewChange}
          />
        ) : null;
      case "recoil":
        return recoilTuning &&
          onRecoilTuningChange &&
          onRecoilTuningReset ? (
          <RecoilTuningSection
            tuning={recoilTuning}
            onChange={onRecoilTuningChange}
            onReset={onRecoilTuningReset}
          />
        ) : null;
      case "debug":
        return <DebugSection settings={settings} onChange={onChange} />;
      default:
        return null;
    }
  };

  useEffect(() => {
    onSectionActiveChange?.(
      sectionStack.length > 0 || openDevWindows.length > 0,
    );
  }, [sectionStack.length, openDevWindows.length, onSectionActiveChange]);

  const closeMenu = useCallback(() => {
    clearSections();
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }

      event.preventDefault();
      if (sectionStack.length > 0) {
        popSection();
        return;
      }

      closeMenu();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, sectionStack.length, closeMenu]);

  if (!open && openDevWindows.length === 0) {
    return null;
  }

  return (
    <>
      {open ? (
      <div className="settings-overlay" role="presentation" onClick={closeMenu}>
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
              onClick={closeMenu}
              aria-label="Close settings"
            >
              ×
            </button>
          </header>

          <div className="settings-body">
            <SettingsSectionNav
              sections={topSections}
              onSelect={openTopSection}
            />
            {sectionStack.length > 0 ? (
              <SettingsSectionPopout
                section={
                  sectionById[sectionStack[sectionStack.length - 1]!]
                }
                onBack={popSection}
                onDismiss={clearSections}
              >
                {renderSectionContent(sectionStack[sectionStack.length - 1]!)}
              </SettingsSectionPopout>
            ) : null}
          </div>
        </section>
      </div>
      ) : null}
      {openDevWindows
        .filter((sectionId) => sectionId !== "development")
        .map((sectionId, index) => {
        const section = sectionById[sectionId];
        if (!section) {
          return null;
        }

        return (
          <SettingsDevWindow
            key={sectionId}
            section={section}
            windowIndex={index}
            onClose={() => closeDevWindow(sectionId)}
          >
            {renderSectionContent(sectionId)}
          </SettingsDevWindow>
        );
      })}
    </>
  );
}
