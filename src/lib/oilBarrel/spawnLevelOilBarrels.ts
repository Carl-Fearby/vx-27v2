import { Mesh, Scene, TransformNode } from "@babylonjs/core";

import { loadOilBarrelProp } from "@/lib/oilBarrel/loadOilBarrelProp";
import type { LevelOilBarrel, LevelRuntime } from "@/lib/level/types";

export type SpawnedOilBarrel = {
  spec: LevelOilBarrel;
  root: TransformNode;
  meshes: Mesh[];
};

export async function spawnLevelOilBarrels(
  scene: Scene,
  level: LevelRuntime,
): Promise<SpawnedOilBarrel[]> {
  const specs = level.config.oilBarrels ?? [];
  const spawned: SpawnedOilBarrel[] = [];

  for (const spec of specs) {
    const { root, meshes } = await loadOilBarrelProp(scene, {
      id: spec.id,
      x: spec.x,
      z: spec.z,
      rotationY: spec.rotationY,
      footY: spec.footY ?? level.floorFootY,
      interiorFire: spec.interiorFire,
    });
    spawned.push({ spec, root, meshes });
  }

  return spawned;
}
