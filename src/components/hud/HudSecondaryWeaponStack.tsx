"use client";

import { memo, type CSSProperties } from "react";
import {
  getSecondarySlotStackFrameStyle,
  SECONDARY_WEAPON_UI,
  WEAPON_SLOT_IDS,
} from "@/lib/hud/weaponHud";
import { resolveStackSelection } from "@/lib/hud/weaponStackLayout";
import { getSecondarySlotStock } from "@/lib/weapons/secondaryWeapons";

type HudSecondaryWeaponStackProps = {
  grenadeCount?: number;
  flashbangCount?: number;
  selectedWeaponSlot?: number;
  frameX?: number;
  frameY?: number;
  layoutStyle?: CSSProperties;
};

const HudSecondaryWeaponStack = memo(function HudSecondaryWeaponStack({
  grenadeCount = 0,
  flashbangCount = 0,
  selectedWeaponSlot = 1,
  frameX = 17,
  frameY = 15,
  layoutStyle,
}: HudSecondaryWeaponStackProps) {
  const visibleSlots = [...WEAPON_SLOT_IDS];
  const stackSelected = resolveStackSelection(
    selectedWeaponSlot,
    visibleSlots,
  );

  if (visibleSlots.length === 0) return null;

  return (
    <div
      className="hud-second-weapon"
      aria-label="Secondary weapons"
      style={
        {
          "--grenade-frame-x": `${frameX}px`,
          "--grenade-frame-y": `${frameY}px`,
          ...layoutStyle,
        } as CSSProperties
      }
    >
      <div className="hud-weapon-slots">
        {visibleSlots.map((slotId) => {
          const weaponUi = SECONDARY_WEAPON_UI[slotId];
          const isSelected = slotId === stackSelected;
          const stock = getSecondarySlotStock(slotId, {
            grenades: grenadeCount,
            flashbangs: flashbangCount,
          });
          const isReserved = weaponUi?.reserved === true;
          const isEmpty = stock != null && stock <= 0;

          return (
            <div
              key={slotId}
              className={[
                "hud-second-weapon-frame",
                isSelected ? "hud-second-weapon-frame--selected" : "",
                isEmpty ? "hud-second-weapon-frame--empty hud-second-weapon-empty" : "",
                isReserved ? "hud-second-weapon-frame--reserved" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={
                getSecondarySlotStackFrameStyle(
                  slotId,
                  selectedWeaponSlot,
                  visibleSlots,
                ) as CSSProperties
              }
            >
              <span className="hud-second-weapon-key">{slotId}</span>
              <div className="hud-second-weapon-body">
                {weaponUi?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={weaponUi.icon}
                    className="hud-second-weapon-icon"
                    alt=""
                  />
                ) : (
                  <span
                    className="hud-second-weapon-icon hud-second-weapon-icon--placeholder"
                    aria-hidden="true"
                  />
                )}
                {weaponUi?.label ? (
                  <span className="hud-second-weapon-label">
                    {weaponUi.label}
                  </span>
                ) : null}
                {stock != null ? (
                  <span className="hud-second-weapon-count">
                    {String(stock).padStart(2, "0")}
                  </span>
                ) : (
                  <span className="hud-second-weapon-count hud-second-weapon-count--reserved">
                    —
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});

export default HudSecondaryWeaponStack;
