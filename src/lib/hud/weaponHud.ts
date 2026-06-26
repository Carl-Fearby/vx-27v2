import type { CSSProperties } from "react";
import {
  getStackDepthInOrder,
  getStackFrameStyleFromDepth,
  resolveStackSelection,
  type StackTuneStep,
} from "@/lib/hud/weaponStackLayout";

export type PrimaryWeaponId = "rifle" | "pistol";

export const PRIMARY_SLOT_KEYS = ["V", "B"] as const;
export const RIFLE_PRIMARY_SLOT = "V";
export const PISTOL_PRIMARY_SLOT = "B";

export const PRIMARY_WEAPONS: Record<
  PrimaryWeaponId,
  { id: PrimaryWeaponId; label: string }
> = {
  rifle: { id: "rifle", label: "RIFLE" },
  pistol: { id: "pistol", label: "PISTOL" },
};

export const PRIMARY_SLOT_UI: Record<
  string,
  { weaponId: PrimaryWeaponId; keyCode: string; icon?: string } | null
> = {
  [RIFLE_PRIMARY_SLOT]: { weaponId: "rifle", keyCode: "KeyV" },
  [PISTOL_PRIMARY_SLOT]: { weaponId: "pistol", keyCode: "KeyB" },
};

export const WEAPON_SLOT_IDS = [1, 2, 3, 4] as const;
export const GRENADE_WEAPON_SLOT = 1;
export const FLASHBANG_WEAPON_SLOT = 2;

export const SECONDARY_WEAPON_UI: Record<
  number,
  { label: string; icon: string | null; reserved?: boolean }
> = {
  [GRENADE_WEAPON_SLOT]: {
    label: "GRANADE",
    icon: "/ui/grenade.webp",
  },
  [FLASHBANG_WEAPON_SLOT]: {
    label: "FLASHBANG",
    icon: "/ui/grenade.webp",
  },
  3: { label: "", icon: null, reserved: true },
  4: { label: "", icon: null, reserved: true },
};

export const DEFAULT_WEAPON_STACK_TUNE: Record<number, StackTuneStep> = {
  1: { x: -39, y: -137, scale: 0.8 },
  2: { x: -21, y: -94, scale: 0.8 },
  3: { x: -12, y: -52, scale: 0.8 },
};

export const DEFAULT_PRIMARY_STACK_TUNE: Record<number, StackTuneStep> = {
  1: { x: 39, y: -137, scale: 0.8 },
  2: { x: 21, y: -94, scale: 0.8 },
  3: { x: 12, y: -52, scale: 0.8 },
};

export const DEFAULT_WEAPON_SLOT_LAYOUT = {
  frameWidthRem: 12.3,
  frameScale: 1,
  frameX: 17,
  frameY: 15,
  keyX: 2,
  keyY: 0,
  keyScale: 1.49,
  iconX: 11,
  iconY: 1,
  iconScale: 0.91,
  labelX: -13,
  labelY: 10,
  labelScale: 1,
  countX: -10,
  countY: -6,
  countScale: 1.15,
};

export function getVisiblePrimarySlotKeys(rifleUnlocked = true): string[] {
  return PRIMARY_SLOT_KEYS.filter((key) => {
    const slot = PRIMARY_SLOT_UI[key];
    if (!slot?.weaponId) return false;
    if (slot.weaponId === "rifle" && !rifleUnlocked) return false;
    return true;
  });
}

export function getPrimarySlotForWeapon(id: PrimaryWeaponId): string {
  return id === "pistol" ? PISTOL_PRIMARY_SLOT : RIFLE_PRIMARY_SLOT;
}

export function getPrimarySlotStackFrameStyle(
  slotKey: string,
  activeSlotKey: string,
  visibleOrder = getVisiblePrimarySlotKeys(),
): Record<string, string | number> {
  const selected = resolveStackSelection(activeSlotKey, visibleOrder);
  if (selected == null) {
    return getStackFrameStyleFromDepth(0, DEFAULT_PRIMARY_STACK_TUNE);
  }
  const depth = getStackDepthInOrder(slotKey, selected, visibleOrder);
  return getStackFrameStyleFromDepth(
    depth,
    DEFAULT_PRIMARY_STACK_TUNE,
    visibleOrder.length,
  );
}

export function getSecondarySlotStackFrameStyle(
  slotId: number,
  selectedSlotId: number,
  visibleOrder: number[] = [...WEAPON_SLOT_IDS],
): Record<string, string | number> {
  const selected = resolveStackSelection(selectedSlotId, visibleOrder);
  if (selected == null) {
    return getStackFrameStyleFromDepth(0, DEFAULT_WEAPON_STACK_TUNE);
  }
  const depth = getStackDepthInOrder(slotId, selected, visibleOrder);
  return getStackFrameStyleFromDepth(
    depth,
    DEFAULT_WEAPON_STACK_TUNE,
    visibleOrder.length,
  );
}

export function buildWeaponSlotLayoutStyle(
  layout = DEFAULT_WEAPON_SLOT_LAYOUT,
): CSSProperties {
  return {
    "--grenade-frame-w": `${layout.frameWidthRem}rem`,
    "--grenade-frame-scale": String(layout.frameScale),
    "--grenade-key-x": `${layout.keyX}px`,
    "--grenade-key-y": `${layout.keyY}px`,
    "--grenade-key-scale": String(layout.keyScale),
    "--grenade-icon-x": `${layout.iconX}px`,
    "--grenade-icon-y": `${layout.iconY}px`,
    "--grenade-icon-scale": String(layout.iconScale),
    "--grenade-label-x": `${layout.labelX}px`,
    "--grenade-label-y": `${layout.labelY}px`,
    "--grenade-label-scale": String(layout.labelScale),
    "--grenade-count-x": `${layout.countX}px`,
    "--grenade-count-y": `${layout.countY}px`,
    "--grenade-count-scale": String(layout.countScale),
  } as CSSProperties;
}
