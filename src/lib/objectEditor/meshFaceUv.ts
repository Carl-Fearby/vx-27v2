import { Mesh, VertexBuffer } from "@babylonjs/core";

const UV_BASELINE_KEY = "objectEditorUvBaseline";
const FACE_ISLANDS_KEY = "objectEditorFaceIslands";

export type FaceUvIslandState = {
  vertexIndices: number[];
  rotationDeg: number;
};

export type MeshFaceUvMetadata = Record<string, FaceUvIslandState>;

type TextureChartPatch = {
  triangleIds: number[];
  vertexIndices: number[];
};

type FaceShell = {
  axis: "x" | "y" | "z";
  sign: 1 | -1;
};

type Vec3 = { x: number; y: number; z: number };

const DEG_TO_RAD = Math.PI / 180;
const SHELL_NORMAL_MIN = 0.5;

function readMeshUvs(mesh: Mesh): Float32Array | null {
  const uvs = mesh.getVerticesData(VertexBuffer.UVKind);
  return uvs ? new Float32Array(uvs) : null;
}

function writeMeshUvs(mesh: Mesh, uvs: Float32Array): void {
  mesh.setVerticesData(VertexBuffer.UVKind, uvs, true);
}

function readMeshPositions(mesh: Mesh): Float32Array | null {
  const positions = mesh.getVerticesData(VertexBuffer.PositionKind);
  return positions ? new Float32Array(positions) : null;
}

function getTriangleVertexIndices(mesh: Mesh, faceId: number): number[] {
  const indices = mesh.getIndices();
  if (!indices || faceId < 0) {
    return [];
  }
  const offset = faceId * 3;
  if (offset + 2 >= indices.length) {
    return [];
  }
  return [indices[offset], indices[offset + 1], indices[offset + 2]];
}

function positionAt(positions: Float32Array, vertexIndex: number): Vec3 {
  return {
    x: positions[vertexIndex * 3],
    y: positions[vertexIndex * 3 + 1],
    z: positions[vertexIndex * 3 + 2],
  };
}

function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= 1e-8) {
    return { x: 0, y: 1, z: 0 };
  }
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function triangleNormal(mesh: Mesh, faceId: number): Vec3 {
  const positions = readMeshPositions(mesh);
  const verts = getTriangleVertexIndices(mesh, faceId);
  if (!positions || verts.length < 3) {
    return { x: 0, y: 1, z: 0 };
  }
  const a = positionAt(positions, verts[0]);
  const b = positionAt(positions, verts[1]);
  const c = positionAt(positions, verts[2]);
  return normalize(cross(subtract(b, a), subtract(c, a)));
}

function shellComponent(normal: Vec3, shell: FaceShell): number {
  if (shell.axis === "x") {
    return normal.x;
  }
  if (shell.axis === "y") {
    return normal.y;
  }
  return normal.z;
}

function faceShellFromNormal(normal: Vec3): FaceShell {
  const ax = Math.abs(normal.x);
  const ay = Math.abs(normal.y);
  const az = Math.abs(normal.z);

  if (az >= ax && az >= ay) {
    return { axis: "z", sign: normal.z >= 0 ? 1 : -1 };
  }
  if (ay >= ax) {
    return { axis: "y", sign: normal.y >= 0 ? 1 : -1 };
  }
  return { axis: "x", sign: normal.x >= 0 ? 1 : -1 };
}

function normalMatchesShell(normal: Vec3, shell: FaceShell): boolean {
  const component = shellComponent(normal, shell);
  const sign: 1 | -1 = component >= 0 ? 1 : -1;
  return sign === shell.sign && Math.abs(component) >= SHELL_NORMAL_MIN;
}

function islandKeyForShell(shell: FaceShell): string {
  const signLabel = shell.sign === 1 ? "+" : "-";
  return `shell:${shell.axis}:${signLabel}`;
}

function resolveIslandKey(mesh: Mesh, faceId: number): string | null {
  if (faceId < 0) {
    return null;
  }
  return islandKeyForShell(faceShellFromNormal(triangleNormal(mesh, faceId)));
}

/** All triangles on the same model side (full front, full back, etc.). */
export function collectTextureChartPatch(
  mesh: Mesh,
  seedFaceId: number,
  _baseline: Float32Array,
): TextureChartPatch {
  const indices = mesh.getIndices();
  if (!indices || seedFaceId < 0) {
    return { triangleIds: [], vertexIndices: [] };
  }

  const faceCount = indices.length / 3;
  const shell = faceShellFromNormal(triangleNormal(mesh, seedFaceId));

  const chartTris: number[] = [];
  for (let faceId = 0; faceId < faceCount; faceId += 1) {
    if (normalMatchesShell(triangleNormal(mesh, faceId), shell)) {
      chartTris.push(faceId);
    }
  }

  if (chartTris.length === 0) {
    chartTris.push(seedFaceId);
  }

  chartTris.sort((a, b) => a - b);
  const vertexSet = new Set<number>();
  for (const faceId of chartTris) {
    for (const vi of getTriangleVertexIndices(mesh, faceId)) {
      vertexSet.add(vi);
    }
  }

  return {
    triangleIds: chartTris,
    vertexIndices: [...vertexSet].sort((a, b) => a - b),
  };
}

function getFaceIslands(mesh: Mesh): MeshFaceUvMetadata {
  const existing = mesh.metadata?.[FACE_ISLANDS_KEY] as MeshFaceUvMetadata | undefined;
  return existing ? { ...existing } : {};
}

function setFaceIslands(mesh: Mesh, islands: MeshFaceUvMetadata): void {
  mesh.metadata = {
    ...mesh.metadata,
    [FACE_ISLANDS_KEY]: islands,
  };
}

export function ensureMeshUvBaseline(mesh: Mesh): Float32Array | null {
  const existing = mesh.metadata?.[UV_BASELINE_KEY] as Float32Array | undefined;
  if (existing && existing.length === (readMeshUvs(mesh)?.length ?? 0)) {
    return existing;
  }

  const uvs = readMeshUvs(mesh);
  if (!uvs) {
    return null;
  }

  const baseline = new Float32Array(uvs);
  mesh.metadata = {
    ...mesh.metadata,
    [UV_BASELINE_KEY]: baseline,
  };
  writeMeshUvs(mesh, new Float32Array(baseline));
  return baseline;
}

function chartUvCenter(uvs: Float32Array, vertexIndices: readonly number[]): {
  centerU: number;
  centerV: number;
} {
  let minU = Infinity;
  let minV = Infinity;
  let maxU = -Infinity;
  let maxV = -Infinity;

  for (const vi of vertexIndices) {
    const u = uvs[vi * 2];
    const v = uvs[vi * 2 + 1];
    minU = Math.min(minU, u);
    minV = Math.min(minV, v);
    maxU = Math.max(maxU, u);
    maxV = Math.max(maxV, v);
  }

  if (!Number.isFinite(minU)) {
    return { centerU: 0.5, centerV: 0.5 };
  }

  return {
    centerU: (minU + maxU) / 2,
    centerV: (minV + maxV) / 2,
  };
}

function rotateUvAroundCenter(
  u: number,
  v: number,
  centerU: number,
  centerV: number,
  radians: number,
): { u: number; v: number } {
  const du = u - centerU;
  const dv = v - centerV;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    u: centerU + du * cos - dv * sin,
    v: centerV + du * sin + dv * cos,
  };
}

export function normalizeFaceUvRotationDeg(degrees: number): number {
  const normalized = degrees % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function rebuildMeshFaceUvs(mesh: Mesh): boolean {
  const baseline = mesh.metadata?.[UV_BASELINE_KEY] as Float32Array | undefined;
  if (!baseline) {
    return false;
  }

  const next = new Float32Array(baseline);
  const islands = getFaceIslands(mesh);

  for (const island of Object.values(islands)) {
    if (island.vertexIndices.length === 0 || island.rotationDeg === 0) {
      continue;
    }
    const { centerU, centerV } = chartUvCenter(baseline, island.vertexIndices);
    const radians = normalizeFaceUvRotationDeg(island.rotationDeg) * DEG_TO_RAD;
    for (const vi of island.vertexIndices) {
      const rotated = rotateUvAroundCenter(
        baseline[vi * 2],
        baseline[vi * 2 + 1],
        centerU,
        centerV,
        radians,
      );
      next[vi * 2] = rotated.u;
      next[vi * 2 + 1] = rotated.v;
    }
  }

  writeMeshUvs(mesh, next);
  return true;
}

export function meshHasFaceUvs(mesh: Mesh): boolean {
  return Boolean(mesh.getVerticesData(VertexBuffer.UVKind)?.length);
}

export function getFaceUvRotationDeg(mesh: Mesh, faceId: number): number {
  const baseline = mesh.metadata?.[UV_BASELINE_KEY] as Float32Array | undefined;
  if (!baseline || faceId < 0) {
    return 0;
  }
  const key = resolveIslandKey(mesh, faceId);
  if (!key) {
    return 0;
  }
  return getFaceIslands(mesh)[key]?.rotationDeg ?? 0;
}

export function setFaceUvRotationDeg(
  mesh: Mesh,
  faceId: number,
  rotationDeg: number,
): boolean {
  const baseline = ensureMeshUvBaseline(mesh);
  if (!baseline || faceId < 0) {
    return false;
  }

  const patch = collectTextureChartPatch(mesh, faceId, baseline);
  const islandKey = resolveIslandKey(mesh, faceId);
  if (!islandKey || patch.vertexIndices.length === 0) {
    return false;
  }

  const islands = getFaceIslands(mesh);
  const normalized = normalizeFaceUvRotationDeg(rotationDeg);

  if (normalized === 0) {
    delete islands[islandKey];
  } else {
    islands[islandKey] = {
      vertexIndices: patch.vertexIndices,
      rotationDeg: normalized,
    };
  }

  setFaceIslands(mesh, islands);
  return rebuildMeshFaceUvs(mesh);
}

export function captureMeshFaceUvSnapshot(mesh: Mesh): {
  uvs: number[];
  faceIslands: MeshFaceUvMetadata;
} | null {
  const uvs = readMeshUvs(mesh);
  if (!uvs) {
    return null;
  }
  return {
    uvs: Array.from(uvs),
    faceIslands: getFaceIslands(mesh),
  };
}

export function applyMeshFaceUvSnapshot(
  mesh: Mesh,
  snapshot: { uvs: number[]; faceIslands: MeshFaceUvMetadata },
): void {
  mesh.metadata = {
    ...mesh.metadata,
    [UV_BASELINE_KEY]: new Float32Array(snapshot.uvs),
  };
  writeMeshUvs(mesh, new Float32Array(snapshot.uvs));
  setFaceIslands(mesh, snapshot.faceIslands);
  mesh.refreshBoundingInfo();
}
