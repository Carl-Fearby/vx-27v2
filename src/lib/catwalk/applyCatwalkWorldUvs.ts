import { Mesh, VertexBuffer } from "@babylonjs/core";
import {
  CATWALK_DECK_TILE_WORLD_SIZE,
  CATWALK_EDGE_TILE_WORLD_SIZE,
} from "@/lib/catwalk/catwalkAssets";

function applyBoxWorldUvs(mesh: Mesh, tileWorldSize: number): void {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  const normals = mesh.getVerticesData(VertexBuffer.NormalKind);
  if (!positions || !normals) {
    return;
  }

  const invTile = 1 / tileWorldSize;
  const uvs = new Float32Array((positions.length / 3) * 2);

  for (let i = 0; i < positions.length / 3; i += 1) {
    const wx = positions[i * 3];
    const wy = positions[i * 3 + 1];
    const wz = positions[i * 3 + 2];
    const nx = normals[i * 3];
    const ny = normals[i * 3 + 1];
    const nz = normals[i * 3 + 2];

    const ax = Math.abs(nx);
    const ay = Math.abs(ny);
    const az = Math.abs(nz);

    let u = 0;
    let v = 0;

    if (ay >= ax && ay >= az) {
      u = wx * invTile;
      v = wz * invTile;
    } else if (ax >= az) {
      u = wz * invTile;
      v = wy * invTile;
    } else {
      u = wx * invTile;
      v = wy * invTile;
    }

    uvs[i * 2] = u;
    uvs[i * 2 + 1] = v;
  }

  mesh.setVerticesData(VertexBuffer.UVKind, uvs);
}

export function applyCatwalkDeckWorldUvs(mesh: Mesh): void {
  applyBoxWorldUvs(mesh, CATWALK_DECK_TILE_WORLD_SIZE);
}

export function applyCatwalkEdgeWorldUvs(mesh: Mesh): void {
  applyBoxWorldUvs(mesh, CATWALK_EDGE_TILE_WORLD_SIZE);
}
