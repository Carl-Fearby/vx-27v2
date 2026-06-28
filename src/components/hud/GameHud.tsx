"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import HudCompass from "@/components/hud/HudCompass";
import HudFireModeCarousel from "@/components/hud/HudFireModeCarousel";
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
import type { FireMode } from "@/lib/weapons/primaryWeapons";
import {
  hudAmmoValueCompactClass,
  isAmmoEmpty,
  isRoundsLow,
} from "@/lib/hud/ammoHud";
import {
  buildHudWeaponOpacityStyle,
  type HudWeaponTuning,
} from "@/lib/hud/hudWeaponTuning";

type GameHudProps = {
  visible: boolean;
  getYaw: () => number;
  onOpenSettings: () => void;
  levelName?: string;
  objective?: string;
  hostileCount?: number;
  missionSeconds?: number;
  activePrimaryWeapon?: PrimaryWeaponId;
  aimBlend?: number;
  selectedWeaponSlot?: number;
  grenadeCount?: number;
  flashbangCount?: number;
  hudWeaponTuning?: HudWeaponTuning;
  primaryAmmo?: Partial<Record<PrimaryWeaponId, { rounds: number }>>;
  roundsInMag?: number;
  spareMags?: number;
  activeMagazineSize?: number;
  activeLowAmmoThreshold?: number;
  fireMode?: FireMode;
  activeFireModes?: FireMode[];
  onCycleFireMode?: () => void;
};

const HB_CORNER_PX = 3;

function formatMissionTimer(totalSecs: number): string {
  const safeSecs = Math.max(0, Math.floor(totalSecs));
  const minutes = Math.floor(safeSecs / 60);
  const seconds = safeSecs % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function GameHud({
  visible,
  getYaw,
  onOpenSettings,
  levelName = "Square Arena",
  objective = "HOLD ZONE",
  hostileCount = 0,
  missionSeconds = 0,
  activePrimaryWeapon = "rifle",
  aimBlend = 0,
  selectedWeaponSlot = GRENADE_WEAPON_SLOT,
  grenadeCount = 0,
  flashbangCount = 0,
  hudWeaponTuning,
  primaryAmmo,
  roundsInMag = 0,
  spareMags = 0,
  activeMagazineSize = 0,
  activeLowAmmoThreshold = 0,
  fireMode = "single",
  activeFireModes = ["single"],
  onCycleFireMode,
}: GameHudProps) {
  const compassTapeRef = useRef<HTMLDivElement>(null);
  const compassViewportRef = useRef<HTMLDivElement>(null);
  const compassMarkersRef = useRef<HTMLDivElement>(null);
  const compassBlipsRef = useRef<HTMLDivElement>(null);
  const compassMetricsRef = useRef(createCompassMetricsCache());

  const barLayout = DEFAULT_HUD_BAR_LAYOUT;
  const bottomBarLayout = DEFAULT_HUD_BOTTOM_BAR_LAYOUT;
  const weaponSlotLayoutStyle = {
    ...buildWeaponSlotLayoutStyle(),
    ...(hudWeaponTuning ? buildHudWeaponOpacityStyle(hudWeaponTuning) : {}),
  };
  const safeAimBlend = Math.min(Math.max(aimBlend, 0), 1);
  const rifleAdsReticleReady =
    activePrimaryWeapon === "rifle"
      ? Math.min(Math.max((safeAimBlend - 0.42) / 0.18, 0), 1)
      : 0;
  const standardCrosshairOpacity =
    activePrimaryWeapon === "rifle"
      ? Math.max(1 - rifleAdsReticleReady, 0)
      : 1;
  const roundsLow = isRoundsLow(
    roundsInMag,
    spareMags,
    activeLowAmmoThreshold,
  );
  const ammoEmpty = isAmmoEmpty(roundsInMag, spareMags);

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
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [visible, getYaw]);

  if (!visible) {
    return null;
  }

  return (
    <>
      <div
        className="crosshair"
        aria-hidden="true"
        style={{ opacity: 0.85 * standardCrosshairOpacity }}
      />
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
            "--hud-fire-carousel-x": `${bottomBarLayout.fireCarouselX}%`,
            "--hud-fire-carousel-y": `${bottomBarLayout.fireCarouselY}%`,
            "--hud-fire-carousel-scale": String(bottomBarLayout.fireCarouselScale),
          } as CSSProperties
        }
      >
        <button
          type="button"
          className="hud-gear-btn"
          aria-label="Open settings"
          title="Settings"
          onClick={onOpenSettings}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ui/settings.webp" alt="" className="hud-gear-img" />
        </button>

        <div
          className={[
            "hud-ammo-stat hud-ammo-stat--left",
            roundsLow ? "hud-ammo-stat--low" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="hud-ammo-label">ROUNDS</span>
          <span
            className={`hud-ammo-value${hudAmmoValueCompactClass(roundsInMag)}`}
          >
            {String(roundsInMag).padStart(2, "0")}
          </span>
        </div>

        <div
          className={[
            "hud-ammo-stat hud-ammo-stat--center",
            ammoEmpty ? "hud-ammo-stat--low" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="hud-ammo-label">MAG</span>
          <span
            className={`hud-ammo-value${hudAmmoValueCompactClass(activeMagazineSize)}`}
          >
            {String(activeMagazineSize).padStart(2, "0")}
          </span>
        </div>

        <div
          className={[
            "hud-ammo-stat hud-ammo-stat--right",
            ammoEmpty ? "hud-ammo-stat--low" : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          <span className="hud-ammo-label">MAGS</span>
          <span
            className={`hud-ammo-value${hudAmmoValueCompactClass(spareMags)}`}
          >
            {String(spareMags).padStart(2, "0")}
          </span>
        </div>

        <HudFireModeCarousel
          modes={activeFireModes}
          activeMode={fireMode}
          onCycle={() => onCycleFireMode?.()}
        />
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

      <div className="hudMissionInfo" role="status" aria-label="Mission status">
        <div className="hudMissionLevel">{levelName}</div>
        <div className="hudMissionObjective">OBJECTIVE: {objective}</div>
        <div className="hudMissionStats">
          <span className="hudMissionStat">
            HOSTILES: <strong>{String(hostileCount).padStart(2, "0")}</strong>
          </span>
          <span className="hudMissionStat">
            TIMER: <strong>{formatMissionTimer(missionSeconds)}</strong>
          </span>
        </div>
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
        primaryAmmo={primaryAmmo}
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
