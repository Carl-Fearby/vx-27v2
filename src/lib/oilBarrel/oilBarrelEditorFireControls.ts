import {
  OIL_BARREL_FIRE_TUNING_LIMITS,
  type OilBarrelFireTuning,
  type OilBarrelFireTuningNumericKey,
} from "@/lib/oilBarrel/oilBarrelTuning";
import {
  applyTuningToOilBarrelOverlayPackage,
  loadModelOverlayPackage,
  resolveOverlayPackagePathForModel,
} from "@/lib/oilBarrel/overlayPackage";
import { saveOverlayPackageToServer } from "@/lib/oilBarrel/saveOverlayPackage";

export type OilBarrelFireTuningControl = {
  key: OilBarrelFireTuningNumericKey;
  label: string;
};

export type OilBarrelFireTuningControlGroup = {
  title: string;
  hint?: string;
  controls: OilBarrelFireTuningControl[];
};

export const OIL_BARREL_FIRE_TUNING_CONTROL_GROUPS: OilBarrelFireTuningControlGroup[] =
  [
    {
      title: "Video layout",
      controls: [
        { key: "interiorVideoWidthScale", label: "Width scale" },
        { key: "interiorVideoHeightScale", label: "Height scale" },
        { key: "interiorVideoCenterOffsetX", label: "Center offset X" },
        { key: "interiorVideoCenterOffsetY", label: "Center offset Y" },
        { key: "interiorFireOffsetX", label: "Fire offset X" },
      ],
    },
    {
      title: "Texture crop",
      controls: [
        { key: "interiorFlameTexBottom", label: "Video bottom" },
        { key: "interiorFlameTexTop", label: "Video top" },
      ],
    },
    {
      title: "Smoke fade",
      hint: "Plane height 0–1",
      controls: [
        { key: "interiorFireTopFadeStart", label: "Fade start" },
        { key: "interiorFireTopFadeEnd", label: "Fade end" },
      ],
    },
    {
      title: "Fire lights",
      controls: [
        { key: "interiorFireLightIntensity", label: "Intensity" },
        { key: "interiorFireLightLeftX", label: "Left X" },
        { key: "interiorFireLightRightX", label: "Right X" },
        { key: "interiorFireLightLeftY", label: "Left Y" },
        { key: "interiorFireLightRightY", label: "Right Y" },
      ],
    },
  ];

export function getOilBarrelFireTuningControlLimits(
  key: OilBarrelFireTuningNumericKey,
) {
  return OIL_BARREL_FIRE_TUNING_LIMITS[key];
}

export async function saveOilBarrelFireTuningToOverlay(
  modelPath: string,
  tuning: OilBarrelFireTuning,
): Promise<{ overlayPath: string; savedAt: string }> {
  const overlayPath = resolveOverlayPackagePathForModel(modelPath);
  const overlayPackage = await loadModelOverlayPackage(modelPath);
  if (!overlayPackage) {
    throw new Error("Overlay package not found for this model.");
  }

  const updatedPackage = applyTuningToOilBarrelOverlayPackage(
    overlayPackage,
    tuning,
  );
  const { savedAt } = await saveOverlayPackageToServer(overlayPath, updatedPackage);
  return { overlayPath, savedAt };
}
