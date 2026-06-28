export const MODEL_LIBRARY_FOLDERS = [
  "assets",
  "enemies",
  "weapons",
] as const;

export const DEFAULT_MODEL_LIBRARY_FOLDER = "assets";

export type ObjectEditorAssetType = "glb";

export type ObjectEditorAsset = {
  id: string;
  name: string;
  category: string;
  type: ObjectEditorAssetType;
  path: string;
  notes?: string;
  /** Set for user-catalog models — used to bust browser cache after save. */
  savedAt?: string;
};

export const OBJECT_EDITOR_ASSETS: ObjectEditorAsset[] = [
  {
    id: "enemy-droid",
    name: "PX-27 Droid",
    category: "Scene",
    type: "glb",
    path: "/models/enemies/px27-android-character.glb",
    notes: "The active arena droid model.",
  },
  {
    id: "weapon-rifle",
    name: "Aurora Pulse Rifle",
    category: "Scene",
    type: "glb",
    path: "/models/weapons/aurora_pulse_rifle.glb",
    notes: "The active player rifle model.",
  },
  {
    id: "weapon-pistol",
    name: "Azure Pulse Pistol",
    category: "Scene",
    type: "glb",
    path: "/models/weapons/azure_pulse_pistol.glb",
    notes: "The active player pistol model.",
  },
];
