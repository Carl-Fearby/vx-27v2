import {
  Color3,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  Vector3,
} from "@babylonjs/core";

const MAX_TRACERS = 24;
const TRACER_LIFE_SEC = 0.085;
const BOLT_MAX_LEN = 5.5;
const BOLT_EXTEND_PHASE = 0.2;
const CORE_DIAMETER = 0.035;
const GLOW_DIAMETER = 0.13;
const LASER_CORE = new Color3(0.85, 0.96, 1);
const LASER_GLOW = new Color3(0.16, 0.62, 1);

type TracerEntry = {
  root: Mesh;
  core: Mesh;
  glow: Mesh;
  age: number;
  active: boolean;
  from: Vector3;
  direction: Vector3;
  range: number;
};

export type LaserTracerSystem = {
  spawn: (from: Vector3, direction: Vector3, range?: number) => void;
  update: (dt: number) => void;
  dispose: () => void;
};

const upVector = new Vector3(0, 1, 0);
const scratchAxis = new Vector3();
const scratchQuat = new Quaternion();
const scratchMid = new Vector3();

function createLaserMaterial(
  scene: Scene,
  name: string,
  color: Color3,
  alpha: number,
): StandardMaterial {
  const material = new StandardMaterial(name, scene);
  material.diffuseColor = color;
  material.emissiveColor = color;
  material.alpha = alpha;
  material.disableLighting = true;
  material.backFaceCulling = false;
  return material;
}

function alignCylinderToDirection(mesh: Mesh, direction: Vector3): void {
  const dot = Vector3.Dot(upVector, direction);
  if (dot > 0.9999) {
    mesh.rotationQuaternion = Quaternion.Identity();
    return;
  }
  if (dot < -0.9999) {
    mesh.rotationQuaternion = Quaternion.RotationAxis(Vector3.Right(), Math.PI);
    return;
  }

  Vector3.CrossToRef(upVector, direction, scratchAxis);
  scratchAxis.normalize();
  Quaternion.RotationAxisToRef(
    scratchAxis,
    Math.acos(Math.max(-1, Math.min(1, dot))),
    scratchQuat,
  );
  mesh.rotationQuaternion = scratchQuat.clone();
}

function setTracerSegment(entry: TracerEntry, length: number, brightness: number): void {
  const safeLength = Math.max(0.001, length);
  scratchMid.copyFrom(entry.from).addInPlace(entry.direction.scale(safeLength * 0.5));
  entry.root.position.copyFrom(scratchMid);
  alignCylinderToDirection(entry.root, entry.direction);
  entry.core.scaling.y = safeLength;
  entry.glow.scaling.y = safeLength;

  const coreMaterial = entry.core.material;
  const glowMaterial = entry.glow.material;
  if (coreMaterial instanceof StandardMaterial) {
    coreMaterial.alpha = brightness;
  }
  if (glowMaterial instanceof StandardMaterial) {
    glowMaterial.alpha = 0.45 * brightness;
  }
}

function createTracerEntry(
  scene: Scene,
  coreMaterial: StandardMaterial,
  glowMaterial: StandardMaterial,
): TracerEntry {
  const root = new Mesh("laserTracer", scene);
  root.isPickable = false;
  root.setEnabled(false);

  const glow = MeshBuilder.CreateCylinder(
    "laserTracerGlow",
    { height: 1, diameter: GLOW_DIAMETER, tessellation: 12 },
    scene,
  );
  glow.parent = root;
  glow.material = glowMaterial.clone("laserTracerGlowMaterialInstance");
  glow.isPickable = false;
  glow.alwaysSelectAsActiveMesh = true;

  const core = MeshBuilder.CreateCylinder(
    "laserTracerCore",
    { height: 1, diameter: CORE_DIAMETER, tessellation: 8 },
    scene,
  );
  core.parent = root;
  core.material = coreMaterial.clone("laserTracerCoreMaterialInstance");
  core.isPickable = false;
  core.alwaysSelectAsActiveMesh = true;

  return {
    root,
    core,
    glow,
    age: 0,
    active: false,
    from: new Vector3(),
    direction: new Vector3(0, 0, 1),
    range: BOLT_MAX_LEN,
  };
}

export function createLaserTracerSystem(scene: Scene): LaserTracerSystem {
  const coreMaterial = createLaserMaterial(scene, "laserTracerCoreMaterial", LASER_CORE, 1);
  const glowMaterial = createLaserMaterial(scene, "laserTracerGlowMaterial", LASER_GLOW, 0.45);
  const pool = Array.from({ length: MAX_TRACERS }, () =>
    createTracerEntry(scene, coreMaterial, glowMaterial),
  );
  const active: TracerEntry[] = [];

  const recycle = (entry: TracerEntry) => {
    entry.root.setEnabled(false);
    entry.active = false;
    entry.age = 0;
    pool.push(entry);
  };

  return {
    spawn(from, direction, range = BOLT_MAX_LEN) {
      let entry = pool.pop();
      if (!entry && active.length > 0) {
        entry = active.shift();
        if (entry) {
          entry.root.setEnabled(false);
        }
      }
      if (!entry || direction.lengthSquared() <= 0.0001) {
        return;
      }

      entry.from.copyFrom(from);
      entry.direction.copyFrom(direction).normalize();
      entry.range = Math.max(0.1, range);
      entry.age = 0;
      entry.active = true;
      entry.root.setEnabled(true);
      setTracerSegment(entry, 0.001, 1);
      active.push(entry);
    },

    update(dt) {
      for (let i = active.length - 1; i >= 0; i -= 1) {
        const entry = active[i];
        entry.age += dt;
        const t = entry.age / TRACER_LIFE_SEC;
        if (t >= 1) {
          active.splice(i, 1);
          recycle(entry);
          continue;
        }

        const lengthMul =
          t < BOLT_EXTEND_PHASE
            ? 1 - (1 - t / BOLT_EXTEND_PHASE) ** 3
            : 1;
        const brightness =
          t < BOLT_EXTEND_PHASE
            ? 1
            : (1 - (t - BOLT_EXTEND_PHASE) / (1 - BOLT_EXTEND_PHASE)) ** 2;
        const length = Math.min(entry.range, BOLT_MAX_LEN) * lengthMul;
        setTracerSegment(entry, length, brightness);
      }
    },

    dispose() {
      for (const entry of [...active, ...pool]) {
        entry.root.dispose(false, true);
      }
      active.length = 0;
      pool.length = 0;
      coreMaterial.dispose();
      glowMaterial.dispose();
    },
  };
}
