import {
  DirectionalLight,
  Scene,
  Vector3,
  type AbstractMesh,
} from "@babylonjs/core";
import { createOutdoorFillLightsState, type OutdoorFillLightsState } from "@/lib/lighting/applyOutdoorDayNight";

function directionFromTo(from: Vector3, to: Vector3): Vector3 {
  return to.subtract(from).normalize();
}

export type OutdoorFillLights = OutdoorFillLightsState & {
  /** Shadowless fill is for the open deck — skip vertical surfaces so sun/moon shadows read. */
  excludeMeshesFromFill: (meshes: AbstractMesh[]) => void;
  dispose: () => void;
};

export function setupOutdoorFillLights(scene: Scene): OutdoorFillLights {
  const fill = new DirectionalLight(
    "outdoorFill",
    directionFromTo(new Vector3(-22, 14, 32), Vector3.Zero()),
    scene,
  );

  const westFill = new DirectionalLight(
    "outdoorWestFill",
    directionFromTo(new Vector3(-38, 16, 4), new Vector3(0, 2, 0)),
    scene,
  );

  const state = createOutdoorFillLightsState(scene, fill, westFill);

  return {
    ...state,
    excludeMeshesFromFill(meshes) {
      fill.excludedMeshes = meshes;
      westFill.excludedMeshes = meshes;
    },
    dispose() {
      fill.dispose();
      westFill.dispose();
      scene.ambientColor.set(0, 0, 0);
    },
  };
}
