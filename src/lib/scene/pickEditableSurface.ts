import { Matrix, type AbstractMesh, type Camera, type Scene } from "@babylonjs/core";
import { meshNameToSurfaceId } from "@/lib/materialEdit/defaults";
import type { EditableSurfaceId } from "@/lib/materialEdit/types";

const EDITABLE_SURFACE_METADATA_KEY = "editableSurfaceId";

export function tagEditableSurface(
  mesh: AbstractMesh,
  surfaceId: EditableSurfaceId,
): void {
  mesh.isPickable = true;
  mesh.metadata = {
    ...(mesh.metadata ?? {}),
    [EDITABLE_SURFACE_METADATA_KEY]: surfaceId,
  };
}

function meshToSurfaceId(mesh: AbstractMesh): EditableSurfaceId | null {
  const fromMetadata = mesh.metadata?.[EDITABLE_SURFACE_METADATA_KEY];
  if (fromMetadata === "floor" || fromMetadata === "pillar") {
    return fromMetadata;
  }
  return meshNameToSurfaceId(mesh.name);
}

function isEditableMesh(mesh: AbstractMesh): boolean {
  return meshToSurfaceId(mesh) !== null;
}

export function clientToScenePick(
  scene: Scene,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
): { x: number; y: number } {
  const engine = scene.getEngine();
  const rect = canvas.getBoundingClientRect();
  const renderWidth = engine.getRenderWidth();
  const renderHeight = engine.getRenderHeight();
  return {
    x: renderWidth * ((clientX - rect.left) / rect.width),
    y: renderHeight * ((clientY - rect.top) / rect.height),
  };
}

export function pickEditableSurfaceAtPointer(
  scene: Scene,
  pointerX: number,
  pointerY: number,
  camera?: Camera | null,
): EditableSurfaceId | null {
  const activeCamera = camera ?? scene.activeCamera;
  if (!activeCamera) {
    return null;
  }

  const ray = scene.createPickingRay(
    pointerX,
    pointerY,
    Matrix.Identity(),
    activeCamera,
    false,
  );
  const pick = scene.pickWithRay(ray, isEditableMesh, false);

  if (!pick?.hit || !pick.pickedMesh) {
    return null;
  }

  return meshToSurfaceId(pick.pickedMesh);
}

export function pickEditableSurface(
  scene: Scene,
  canvas: HTMLCanvasElement,
  clientX: number,
  clientY: number,
  camera?: Camera | null,
): EditableSurfaceId | null {
  const { x, y } = clientToScenePick(scene, canvas, clientX, clientY);
  return pickEditableSurfaceAtPointer(scene, x, y, camera);
}
