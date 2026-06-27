import type { Camera, Scene } from "@babylonjs/core";
import { VIEWMODEL_LAYER_MASK } from "@/lib/weapons/createViewWeapon";

/** GE2 `renderViewmodelPass` — same world camera, viewmodel layer only, after post-process. */
export function attachViewmodelOverlayPass(
  scene: Scene,
  worldCamera: Camera,
): () => void {
  const observer = scene.onAfterCameraRenderObservable.add((camera) => {
    if (camera !== worldCamera) {
      return;
    }

    const internalScene = scene as unknown as {
      _activeCamera: Camera | null;
      _evaluateActiveMeshes: () => void;
      _renderingManager: {
        render: (
          customRenderFunction: unknown,
          renderSprites: unknown,
          renderTransparentMeshes: boolean,
          activeMeshes: boolean,
        ) => void;
      };
    };

    const previousLayerMask = worldCamera.layerMask;
    worldCamera.layerMask = VIEWMODEL_LAYER_MASK;

    try {
      internalScene._activeCamera = worldCamera;
      scene.activeCamera = worldCamera;
      scene.updateTransformMatrix();
      internalScene._evaluateActiveMeshes();
      internalScene._renderingManager.render(null, null, true, true);
    } finally {
      worldCamera.layerMask = previousLayerMask;
      internalScene._activeCamera = worldCamera;
      scene.activeCamera = worldCamera;
      scene.updateTransformMatrix();
      internalScene._evaluateActiveMeshes();
    }
  });

  return () => {
    scene.onAfterCameraRenderObservable.remove(observer);
  };
}
