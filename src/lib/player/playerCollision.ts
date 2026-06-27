import {
  Color3,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

/** Matches Rust `PLAYER_RADIUS` and Babylon ellipsoid X/Z radius. */
export const PLAYER_COLLISION_RADIUS = 0.4;
/** Babylon ellipsoid half-height on the collision probe / camera. */
export const PLAYER_COLLISION_HALF_HEIGHT = 0.9;

const FOOTPRINT_LIFT = 0.025;

export type PlayerCollisionFootprintDebug = {
  sync: (x: number, footY: number, z: number, colliding: boolean) => void;
  setEnabled: (enabled: boolean) => void;
  dispose: () => void;
};

export function createPlayerCollisionFootprintDebug(
  scene: Scene,
): PlayerCollisionFootprintDebug {
  const mesh = MeshBuilder.CreateDisc(
    "playerCollisionFootprint",
    { radius: PLAYER_COLLISION_RADIUS, tessellation: 64 },
    scene,
  );
  mesh.rotation.x = Math.PI / 2;
  mesh.isPickable = false;
  mesh.checkCollisions = false;
  mesh.receiveShadows = false;
  mesh.isVisible = false;

  const material = new StandardMaterial("playerCollisionFootprintMat", scene);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.alpha = 0.5;
  material.zOffset = -2;
  mesh.material = material;

  const idleColor = new Color3(0.15, 0.82, 1);
  const hitColor = new Color3(1, 0.45, 0.12);

  const setColors = (colliding: boolean) => {
    const base = colliding ? hitColor : idleColor;
    material.diffuseColor = base;
    material.emissiveColor = base.scale(0.55);
  };

  setColors(false);

  return {
    sync(x, footY, z, colliding) {
      mesh.position.copyFromFloats(x, footY + FOOTPRINT_LIFT, z);
      setColors(colliding);
    },
    setEnabled(enabled) {
      mesh.isVisible = enabled;
    },
    dispose() {
      mesh.dispose();
      material.dispose();
    },
  };
}

export function playerFootY(positionY: number, eyeHeight: number): number {
  return positionY - eyeHeight;
}

/** True when Babylon collision trimmed this frame's intended XZ move. */
export function collisionTrimmedMove(
  previous: Vector3,
  intendedDelta: Vector3,
  resolved: Vector3,
): boolean {
  const intendedX = previous.x + intendedDelta.x;
  const intendedZ = previous.z + intendedDelta.z;
  return (
    Math.abs(resolved.x - intendedX) > 0.001 ||
    Math.abs(resolved.z - intendedZ) > 0.001
  );
}
