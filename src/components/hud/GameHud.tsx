"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import HudCompass from "@/components/hud/HudCompass";
import HudPrimaryWeaponStack from "@/components/hud/HudPrimaryWeaponStack";
import HudSecondaryWeaponStack from "@/components/hud/HudSecondaryWeaponStack";
import {
  createCompassMetricsCache,
  updateCompassTape,
} from "@/lib/hud/compass";
import {
  DEFAULT_HUD_BAR_LAYOUT,
  DEFAULT_HUD_BOTTOM_BAR_LAYOUT,
} from "@/lib/hud/hudBarLayout";
import {
  buildWeaponSlotLayoutStyle,
  GRENADE_WEAPON_SLOT,
  type PrimaryWeaponId,
} from "@/lib/hud/weaponHud";
import {
  buildHudWeaponOpacityStyle,
  type HudWeaponTuning,
} from "@/lib/hud/hudWeaponTuning";

type GameHudProps = {
  visible: boolean;
  getYaw: () => number;
  getFps?: () => number;
  onOpenSettings: () => void;
  activePrimaryWeapon?: PrimaryWeaponId;
  selectedWeaponSlot?: number;
  grenadeCount?: number;
  flashbangCount?: number;
  hudWeaponTuning?: HudWeaponTuning;
};

const HB_CORNER_PX = 3;

export default function GameHud({
  visible,
  getYaw,
  getFps,
  onOpenSettings,
  activePrimaryWeapon = "rifle",
  selectedWeaponSlot = GRENADE_WEAPON_SLOT,
  grenadeCount = 0,
  flashbangCount = 0,
  hudWeaponTuning,
}: GameHudProps) {
  const compassTapeRef = useRef<HTMLDivElement>(null);
  const compassViewportRef = useRef<HTMLDivElement>(null);
  const compassMarkersRef = useRef<HTMLDivElement>(null);
  const compassBlipsRef = useRef<HTMLDivElement>(null);
  const compassMetricsRef = useRef(createCompassMetricsCache());
  const [fps, setFps] = useState(0);

  const barLayout = DEFAULT_HUD_BAR_LAYOUT;
  const bottomBarLayout = DEFAULT_HUD_BOTTOM_BAR_LAYOUT;
  const weaponSlotLayoutStyle = {
    ...buildWeaponSlotLayoutStyle(),
    ...(hudWeaponTuning ? buildHudWeaponOpacityStyle(hudWeaponTuning) : {}),
  };

  useEffect(() => {
    if (!visible) {
      return;
    }

    let frameId = 0;
    const tick = () => {
      updateCompassTape(
        getYaw(),
        compassViewportRef.current,
        compassTapeRef.current,
        compassMetricsRef.current,
      );
      if (getFps) {
        setFps(Math.round(getFps()));
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [visible, getYaw, getFps]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div className="crosshair" aria-hidden="true" />

      <div
        className="hud-bottom-bar"
        role="region"
        aria-label="Loadout HUD"
        style={
          {
            "--hud-bar-scale": String(bottomBarLayout.barScale),
            "--hud-cog-x": `${bottomBarLayout.cogX}%`,
            "--hud-cog-y": `${bottomBarLayout.cogY}%`,
            "--hud-cog-size": `${bottomBarLayout.cogSize}%`,
            "--hud-rounds-x": `${bottomBarLayout.roundsX}%`,
            "--hud-rounds-y": `${bottomBarLayout.roundsY}%`,
            "--hud-mag-x": `${bottomBarLayout.magX}%`,
            "--hud-mag-y": `${bottomBarLayout.magY}%`,
            "--hud-mags-x": `${bottomBarLayout.magsX}%`,
            "--hud-mags-y": `${bottomBarLayout.magsY}%`,
            "--hud-value-font": `${bottomBarLayout.valueFont}vw`,
            "--hud-label-scale": String(bottomBarLayout.labelScale),
            "--hud-label-y": `${bottomBarLayout.labelY}px`,
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="hud-gear-btn"
          aria-label="Open settings"
          title="Settings (Esc)"
          onClick={onOpenSettings}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/settings.webp" alt="" className="hud-gear-img" />
        </button>

        <div className="hud-ammo-stat hud-ammo-stat--left">
          <span className="hud-ammo-label">ROUNDS</span>
          <span className="hud-ammo-value">30</span>
        </div>

        <div className="hud-ammo-stat hud-ammo-stat--center">
          <span className="hud-ammo-label">MAG</span>
          <span className="hud-ammo-value">30</span>
        </div>

        <div className="hud-ammo-stat hud-ammo-stat--right">
          <span className="hud-ammo-label">MAGS</span>
          <span className="hud-ammo-value">03</span>
        </div>
      </div>

      <div className="hud-stamina-cluster">
        <div
          className="hud-stamina-bar"
          role="status"
          aria-label="Sprint stamina"
          style={
            {
              "--sb-icon-x": `${barLayout.sbIconX}%`,
              "--sb-icon-y": `${barLayout.sbIconY}%`,
              "--sb-bar-x": `${barLayout.sbBarX}%`,
              "--sb-bar-y": `${barLayout.sbBarY}%`,
              "--sb-bar-w": `${barLayout.sbBarW}%`,
              "--sb-bar-h": `${barLayout.sbBarH}%`,
              "--hb-corner": `${HB_CORNER_PX}px`,
            } as CSSProperties
          }
        >
          <div className="hud-stamina-icon" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/ui/stamina-icon.webp"
              className="hud-stamina-fist"
              alt=""
            />
          </div>
          <div className="hud-stamina-track">
            <div
              className="hud-walk-power-fill"
              style={
                { width: "100%", "--hb-corner": `${HB_CORNER_PX}px` } as CSSProperties
              }
            >
              <div className="hud-health-layer hud-health-layer--blue" />
            </div>
            <span className="hud-health-text hud-health-text--white hud-stamina-text--white">
              100%
            </span>
            <span
              className="hud-health-text hud-health-text--black hud-stamina-text--black"
              style={{ width: "100%" }}
            >
              100%
            </span>
          </div>
        </div>
      </div>

      <div className="hud-score-panel" role="status" aria-label="Combat score">
        <span className="hud-score-label">SCORE</span>
        <strong className="hud-score-value">0</strong>
      </div>

      <div className="hud-fps-panel" role="status" aria-label="Frames per second">
        <strong className="hud-fps-value">{fps}</strong>
        <span className="hud-fps-label">FPS</span>
      </div>

      <HudCompass
        tapeRef={compassTapeRef}
        viewportRef={compassViewportRef}
        markersRef={compassMarkersRef}
        blipsRef={compassBlipsRef}
      />

      <div
        className="hud-health-bar"
        role="status"
        aria-label="Player health"
        style={
          {
            "--hb-lives-x": `${barLayout.hbLivesX}%`,
            "--hb-lives-y": `${barLayout.hbLivesY}%`,
            "--hb-lives-size": `${barLayout.hbLivesSize}vw`,
            "--hb-bar-x": `${barLayout.hbBarX}%`,
            "--hb-bar-y": `${barLayout.hbBarY}%`,
            "--hb-bar-w": `${barLayout.hbBarW}%`,
            "--hb-bar-h": `${barLayout.hbBarH}%`,
            "--hb-corner": `${HB_CORNER_PX}px`,
          } as CSSProperties
        }
      >
        <div className="hud-health-lives">
          <span className="hud-health-lives-value">03</span>
        </div>
        <div className="hud-health-track">
          <div className="hud-health-fill" style={{ width: "100%" }}>
            <div className="hud-health-layer hud-health-layer--blue" />
          </div>
          <span className="hud-health-text hud-health-text--white">100%</span>
          <span
            className="hud-health-text hud-health-text--black"
            style={{ width: "100%" }}
          >
            100%
          </span>
        </div>
      </div>

      <HudPrimaryWeaponStack
        activePrimaryWeapon={activePrimaryWeapon}
        layoutStyle={weaponSlotLayoutStyle}
      />

      <HudSecondaryWeaponStack
        selectedWeaponSlot={selectedWeaponSlot}
        grenadeCount={grenadeCount}
        flashbangCount={flashbangCount}
        layoutStyle={weaponSlotLayoutStyle}
      />
    </>
  );
}
