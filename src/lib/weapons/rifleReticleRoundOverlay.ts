import {
  Constants,
  Color3,
  DynamicTexture,
  Mesh,
  MeshBuilder,
  Scene,
  StandardMaterial,
} from "@babylonjs/core";

const VIEWMODEL_RENDERING_GROUP = 3;
const VIEWMODEL_LAYER_MASK = 0x10000000;

const NORMAL_CORE = "#5eaaff";
const NORMAL_GLOW = "rgba(94, 170, 255, 0.55)";
const NORMAL_HALO = "rgba(58, 140, 255, 0.85)";
const LOW_CORE = "#e6321e";
const LOW_HALO = "rgba(230, 50, 30, 0.9)";

const CANVAS_W = 128;
const CANVAS_H = 64;
const FONT_PX = 28;
const PLANE_W = 0.032;
const PLANE_H = 0.016;
/** Bottom-left of reticle plane, nudged toward camera (view sees back face). */
const LOCAL_X = -0.36;
const LOCAL_Y = -0.36;
const LOCAL_Z = -0.005;

function hudRoundsFontSpec(sizePx: number): string {
  return `700 ${sizePx}px Orbitron, "Eurostile", "Rajdhani", sans-serif`;
}

function applyHudRoundsTextStyle(ctx: CanvasRenderingContext2D, sizePx: number) {
  ctx.font = hudRoundsFontSpec(sizePx);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if ("letterSpacing" in ctx) {
    (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
      `${sizePx * 0.08}px`;
  }
}

export type RifleReticleRoundOverlay = {
  setRoundCount: (
    count: number,
    low?: boolean,
    aimBlend?: number,
    visible?: boolean,
  ) => void;
  dispose: () => void;
};

export function createRifleReticleRoundOverlay(
  scene: Scene,
  parentMesh: Mesh,
): RifleReticleRoundOverlay {
  let lastCount = -1;
  let lastLow = false;
  let fontLoadGen = 0;

  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const texture = new DynamicTexture(
    "rifleReticleRoundOverlay",
    canvas,
    scene,
    false,
  );
  texture.hasAlpha = true;
  const ctx = texture.getContext() as CanvasRenderingContext2D;

  const material = new StandardMaterial("rifleReticleRoundOverlayMaterial", scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  material.disableDepthWrite = true;
  material.depthFunction = Constants.ALWAYS;

  const mesh = MeshBuilder.CreatePlane("rifleReticleRoundOverlay", { size: 1 }, scene);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = VIEWMODEL_RENDERING_GROUP;
  mesh.layerMask = VIEWMODEL_LAYER_MASK;
  mesh.alphaIndex = 10057;
  mesh.parent = parentMesh;
  mesh.position.set(LOCAL_X, LOCAL_Y, LOCAL_Z);
  mesh.scaling.set(PLANE_W, PLANE_H, 1);
  mesh.setEnabled(false);

  function draw(count: number, low: boolean) {
    if (count === lastCount && low === lastLow) {
      return;
    }
    lastCount = count;
    lastLow = low;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    const text = String(Math.max(0, Math.floor(count))).padStart(2, "0");
    const cx = CANVAS_W / 2;
    const cy = CANVAS_H / 2;
    applyHudRoundsTextStyle(ctx, FONT_PX);

    if (low) {
      ctx.shadowColor = LOW_HALO;
      ctx.shadowBlur = 12;
      ctx.fillStyle = "rgba(230, 50, 30, 0.45)";
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 6;
      ctx.fillStyle = LOW_CORE;
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
    } else {
      ctx.shadowColor = NORMAL_HALO;
      ctx.shadowBlur = 14;
      ctx.fillStyle = NORMAL_GLOW;
      ctx.fillText(text, cx, cy);
      ctx.shadowBlur = 0;
      ctx.fillStyle = NORMAL_CORE;
      ctx.fillText(text, cx, cy);
    }

    texture.update(false);
  }

  function primeFont() {
    if (typeof document === "undefined" || !document.fonts?.load) {
      draw(0, false);
      return;
    }
    const gen = ++fontLoadGen;
    document.fonts.load(hudRoundsFontSpec(FONT_PX)).then(() => {
      if (gen !== fontLoadGen) return;
      draw(lastCount >= 0 ? lastCount : 0, lastLow);
    });
  }

  function setRoundCount(count: number, low = false, aimBlend = 0, visible = true) {
    const adsReady = visible && aimBlend >= 0.5;
    mesh.setEnabled(adsReady);
    if (!adsReady) {
      return;
    }
    draw(count, low);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
    mesh.dispose();
  }

  primeFont();
  draw(0, false);

  return { setRoundCount, dispose };
}
