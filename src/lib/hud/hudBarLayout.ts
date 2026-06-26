export type HudBarLayout = {
  hbLivesX: number;
  hbLivesY: number;
  hbLivesSize: number;
  hbBarX: number;
  hbBarY: number;
  hbBarW: number;
  hbBarH: number;
  sbIconX: number;
  sbIconY: number;
  sbBarX: number;
  sbBarY: number;
  sbBarW: number;
  sbBarH: number;
};

export type HudBottomBarLayout = {
  barScale: number;
  valueFont: number;
  labelScale: number;
  cogSize: number;
  cogX: number;
  cogY: number;
  roundsX: number;
  roundsY: number;
  magX: number;
  magY: number;
  magsX: number;
  magsY: number;
  labelY: number;
};

export const DEFAULT_HUD_BAR_LAYOUT: HudBarLayout = {
  hbLivesX: 4.5,
  hbLivesY: 11.5,
  hbLivesSize: 1.05,
  hbBarX: 5.1,
  hbBarY: 34,
  hbBarW: 76,
  hbBarH: 33.5,
  sbIconX: 4.5,
  sbIconY: 11.5,
  sbBarX: 18.5,
  sbBarY: 34,
  sbBarW: 76,
  sbBarH: 33.5,
};

export const DEFAULT_HUD_BOTTOM_BAR_LAYOUT: HudBottomBarLayout = {
  barScale: 0.55,
  valueFont: 4.24,
  labelScale: 1,
  cogSize: 8,
  cogX: 4,
  cogY: 32,
  roundsX: 33,
  roundsY: 10,
  magX: 50,
  magY: 10,
  magsX: 67,
  magsY: 10,
  labelY: 8,
};
