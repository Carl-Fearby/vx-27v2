import { Mesh, VertexBuffer } from "@babylonjs/core";

/**
 * GameEngine2 `applyContinuousBoxWorldUVs` — world-metre UVs with repeat 1×1
 * so hazard diagonals stay continuous around vertical corners (stair stringers + pillars).
 */
export function applyContinuousBoxWorldUVs(
  mesh: Mesh,
  height: number,
  tileSizeMeters: number,
): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  if (!positions || tileSizeMeters <= 0) {
    return;
  }

  const halfH = height / 2;
  const tile = tileSizeMeters;
  const uvs = new Float32Array((positions.length / 3) * 2);

  for (let i = 0; i < positions.length / 3; i += 1) {
    const x = positions[i * 3];
    const y = positions[i * 3 + 1];
    const z = positions[i * 3 + 2];
    uvs[i * 2] = (x - z) / tile;
    uvs[i * 2 + 1] = (halfH - y) / tile;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}
