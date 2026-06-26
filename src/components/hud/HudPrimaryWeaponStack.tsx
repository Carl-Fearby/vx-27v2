"use client";

import { memo, type CSSProperties } from "react";
import {
  getPrimarySlotForWeapon,
  getPrimarySlotStackFrameStyle,
  getVisiblePrimarySlotKeys,
  PRIMARY_SLOT_UI,
  PRIMARY_WEAPONS,
  type PrimaryWeaponId,
} from "@/lib/hud/weaponHud";
import { resolveStackSelection } from "@/lib/hud/weaponStackLayout";

type HudPrimaryWeaponStackProps = {
  activePrimaryWeapon?: PrimaryWeaponId;
  primaryAmmo?: Partial<Record<PrimaryWeaponId, { rounds: number }>>;
  rifleUnlocked?: boolean;
  frameX?: number;
  frameY?: number;
  layoutStyle?: CSSProperties;
};

const HudPrimaryWeaponStack = memo(function HudPrimaryWeaponStack({
  activePrimaryWeapon = "rifle",
  primaryAmmo = { rifle: { rounds: 80 }, pistol: { rounds: 12 } },
  rifleUnlocked = true,
  frameX = 17,
  frameY = 15,
  layoutStyle,
}: HudPrimaryWeaponStackProps) {
  const activeSlotKey = getPrimarySlotForWeapon(activePrimaryWeapon);
  const visibleSlots = getVisiblePrimarySlotKeys(rifleUnlocked);
  const stackSelected = resolveStackSelection(activeSlotKey, visibleSlots);

  if (visibleSlots.length === 0) return null;

  return (
    <div
      className="hud-primary-weapon"
      aria-label="Primary weapons"
      style={
        {
          "--grenade-frame-x": `${-frameX}px`,
          "--grenade-frame-y": `${frameY}px`,
          ...layoutStyle,
        } as CSSProperties
      }
    >
      <div className="hud-primary-weapon-slots">
        {visibleSlots.map((slotKey) => {
          const slotUi = PRIMARY_SLOT_UI[slotKey];
          const weaponId = slotUi?.weaponId;
          const cfg = weaponId ? PRIMARY_WEAPONS[weaponId] : null;
          const rounds = weaponId ? (primaryAmmo[weaponId]?.rounds ?? 0) : 0;
          const isSelected = slotKey === stackSelected;
          const isEmpty = rounds === 0;

          return (
            <div
              key={slotKey}
              className={[
                "hud-primary-weapon-frame",
                isSelected ? "hud-primary-weapon-frame--selected" : "",
                isEmpty ? "hud-primary-weapon-frame--empty" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                getPrimarySlotStackFrameStyle(
                  slotKey,
                  activeSlotKey,
                  visibleSlots,
                ) as CSSProperties
              }
            >
              <span className="hud-primary-weapon-key">{slotKey}</span>
              <div className="hud-primary-weapon-body">
                <span className="hud-primary-weapon-label">{cfg?.label}</span>
                <span className="hud-primary-weapon-count">
                  {String(rounds).padStart(2, "0")}
                </span>
                {slotUi?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={slotUi.icon}
                    className="hud-primary-weapon-icon"
                    alt=""
                  />
                ) : (
                  <span
                    className="hud-primary-weapon-icon hud-primary-weapon-icon--placeholder"
                    aria-hidden="true"
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default HudPrimaryWeaponStack;
