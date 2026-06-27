import {
  AbstractMesh,
  Color3,
  HemisphericLight,
  Vector3,
  type DirectionalLight,
  type HemisphericLight as HemisphericLightType,
  type Scene,
} from "@babylonjs/core";
import {
  isEnclosedViewmodelZone,
  viewmodelAmbientForZone,
  type ViewmodelLightingZone,
} from "@/lib/lighting/lightingZones";

export type OutdoorLightRefs = {
  hemi: HemisphericLightType;
  sun: DirectionalLight;
  moon: DirectionalLight;
  fill: DirectionalLight;
  westFill: DirectionalLight;
};

export type ViewmodelLighting = {
  syncZone: (zone: ViewmodelLightingZone, viewWeaponMeshes: AbstractMesh[]) => void;
  setFillBaseExclusions: (meshes: AbstractMesh[]) => void;
  dispose: () => void;
};

function mergeExcludedMeshes(
  base: AbstractMesh[] | null | undefined,
  extra: AbstractMesh[],
): AbstractMesh[] {
  if (extra.length === 0) {
    return base ? [...base] : [];
  }
  const merged = base ? [...base] : [];
  for (const mesh of extra) {
    if (!merged.includes(mesh)) {
      merged.push(mesh);
    }
  }
  return merged;
}

export function createViewmodelLighting(
  scene: Scene,
  outdoorLights: OutdoorLightRefs,
): ViewmodelLighting {
  const interior = new HemisphericLight(
    "viewmodelInterior",
    new Vector3(0.2, 1, 0.1),
    scene,
  );
  interior.specular = Color3.Black();
  interior.intensity = 0;
  interior.setEnabled(false);

  let lastZone: ViewmodelLightingZone | null = null;
  let viewWeaponMeshes: AbstractMesh[] = [];
  let fillBaseExclusions: AbstractMesh[] = [];

  const applyOutdoorExclusions = (enclosed: boolean) => {
    const vmExclude = enclosed ? viewWeaponMeshes : [];
    outdoorLights.hemi.excludedMeshes = vmExclude;
    outdoorLights.sun.excludedMeshes = vmExclude;
    outdoorLights.moon.excludedMeshes = vmExclude;
    outdoorLights.fill.excludedMeshes = mergeExcludedMeshes(
      fillBaseExclusions,
      vmExclude,
    );
    outdoorLights.westFill.excludedMeshes = mergeExcludedMeshes(
      fillBaseExclusions,
      vmExclude,
    );
  };

  return {
    syncZone(zone, meshes) {
      viewWeaponMeshes = meshes;
      interior.includedOnlyMeshes = meshes;

      const enclosed = isEnclosedViewmodelZone(zone);
      const ambientSpec = viewmodelAmbientForZone(zone);
      if (enclosed && ambientSpec) {
        interior.diffuse = Color3.FromHexString(
          `#${ambientSpec.color.toString(16).padStart(6, "0")}`,
        );
        interior.intensity = ambientSpec.intensity;
        interior.setEnabled(true);
      } else {
        interior.setEnabled(false);
      }

      applyOutdoorExclusions(enclosed);

      if (lastZone === zone) {
        return;
      }
      lastZone = zone;
    },
    setFillBaseExclusions(meshes) {
      fillBaseExclusions = meshes;
      applyOutdoorExclusions(isEnclosedViewmodelZone(lastZone ?? "outdoor"));
    },
    dispose() {
      interior.dispose();
    },
  };
}
