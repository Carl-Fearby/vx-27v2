import { DirectionalLight, Scene, Vector3 } from "@babylonjs/core";
import { createOutdoorFillLightsState, type OutdoorFillLightsState } from "@/lib/lighting/applyOutdoorDayNight";

function directionFromTo(from: Vector3, to: Vector3): Vector3 {
  return to.subtract(from).normalize();
}

export type OutdoorFillLights = OutdoorFillLightsState & {
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
    dispose() {
      fill.dispose();
      westFill.dispose();
      scene.ambientColor.set(0, 0, 0);
    },
  };
}
