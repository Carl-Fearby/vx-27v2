import {
  Constants,
  Color3,
  DynamicTexture,
  Matrix,
  Mesh,
  MeshBuilder,
  Quaternion,
  Scene,
  StandardMaterial,
  TransformNode,
  Vector3,
} from "@babylonjs/core";
import {
  DEFAULT_HIP_ROUND_DISPLAY,
  type WeaponRoundDisplayPose,
} from "@/lib/weapons/weaponRoundDisplayTuning";

const VIEWMODEL_RENDERING_GROUP = 3;
const VIEWMODEL_LAYER_MASK = 0x10000000;
/** Nudge plane off the receiver surface to avoid z-fighting. */
const SURFACE_Z_OFFSET = 0.002;

const NORMAL_CORE = "#5eaaff";
const NORMAL_GLOW = "rgba(94, 170, 255, 0.55)";
const NORMAL_HALO = "rgba(58, 140, 255, 0.85)";
const LOW_CORE = "#e6321e";
const LOW_HALO = "rgba(230, 50, 30, 0.9)";
const CONTENT_Y_OFFSET_PX = 20;
const HP_Y_FRAC = 0.24;
const HP_BAR_TO_ROUNDS = 0.52;
const ROUNDS_TO_STAMINA_BAR = 0.44;

const BAR_BLUE = {
  top: "rgb(30, 160, 255)",
  mid: "rgb(70, 200, 255)",
  bottom: "rgb(30, 160, 255)",
};
const BAR_ORANGE = {
  top: "rgb(255, 140, 20)",
  mid: "rgb(255, 180, 60)",
  bottom: "rgb(255, 140, 20)",
};
const BAR_RED = {
  top: "rgb(230, 35, 20)",
  mid: "rgb(255, 75, 50)",
  bottom: "rgb(230, 35, 20)",
};
const BAR_GREEN = {
  top: "rgb(80, 255, 60)",
  mid: "rgb(120, 255, 80)",
  bottom: "rgb(80, 255, 60)",
};

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

function canvasDimensionsForFontSize(sizePx: number) {
  const fs = Math.max(12, Math.round(sizePx));
  return {
    width: Math.max(256, Math.ceil(fs * 3.2)),
    height: Math.max(180, Math.ceil(fs * 2.55)),
  };
}

function hpBarMetrics(hp: number) {
  const safeHp = Number.isFinite(hp) ? Math.max(0, hp) : 100;
  const radioactive = safeHp > 100;
  const pct = radioactive ? 1 : safeHp <= 0 ? 0 : Math.min(1, safeHp / 100);
  let orangeOp = 0;
  let redOp = 0;
  let greenOp = 0;
  if (safeHp > 0) {
    if (radioactive) {
      greenOp = 1;
    } else {
      if (safeHp <= 50) orangeOp = 1;
      if (safeHp <= 25) redOp = 1;
    }
  }
  return { pct, orangeOp, redOp, greenOp };
}

function staminaBarMetrics(stamina: number, hp: number) {
  const safeStamina = Number.isFinite(stamina) ? Math.max(0, stamina) : 1;
  const safeHp = Number.isFinite(hp) ? Math.max(0, hp) : 100;
  const radioactive = safeHp > 100;
  const hpCap = radioactive ? safeHp : 100;
  const displayVal = Math.round(safeStamina * 100);
  const pctOfHpCap = hpCap > 0 ? Math.min(1, displayVal / hpCap) : 0;
  let greenOp = 0;
  if (displayVal > 100 && hpCap > 100) {
    greenOp = Math.min(1, (Math.min(displayVal, hpCap) - 100) / (hpCap - 100));
  }
  let orangeOp = 0;
  let redOp = 0;
  if (displayVal <= 100) {
    if (displayVal <= 50) orangeOp = 1;
    if (displayVal <= 25) redOp = 1;
  } else if (!radioactive) {
    if (pctOfHpCap <= 0.5) orangeOp = 1;
    if (pctOfHpCap <= 0.25) redOp = 1;
  }
  return { displayVal, pctOfHpCap, orangeOp, redOp, greenOp };
}

function chamferedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  corner: number,
) {
  const c = Math.min(corner, w * 0.5, h * 0.5);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

function drawVerticalGradientBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  colors: { top: string; mid: string; bottom: string },
) {
  const grad = ctx.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, colors.top);
  grad.addColorStop(0.45, colors.mid);
  grad.addColorStop(1, colors.bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
}

export type WeaponRoundDisplay = {
  mesh: Mesh;
  setCount: (count: number, low?: boolean, hp?: number, stamina?: number) => void;
  syncPose: (
    tuning: WeaponRoundDisplayPose,
    swayGroup: TransformNode,
  ) => void;
  dispose: () => void;
};

export function createWeaponRoundDisplay(
  scene: Scene,
  sway: TransformNode,
  weaponRoot: TransformNode,
  id: string,
  defaultPose: WeaponRoundDisplayPose = DEFAULT_HIP_ROUND_DISPLAY,
): WeaponRoundDisplay {
  let fontSize = defaultPose.fontSize;
  let logicalCanvasW = 256;
  let logicalCanvasH = 180;
  let fontLoadGen = 0;
  let lastHp = -1;
  let lastCount = -1;
  let lastStaminaPct = -1;
  let lastLow = false;
  let lastDrawnHp = 100;
  let lastDrawnCount = 0;
  let lastDrawnStamina = 1;
  let lastDrawnLow = false;

  const canvas = document.createElement("canvas");
  const texture = new DynamicTexture(
    `weaponRoundDisplay_${id}`,
    canvas,
    scene,
    false,
  );
  texture.hasAlpha = true;
  let ctx = texture.getContext() as CanvasRenderingContext2D;

  const material = new StandardMaterial(`weaponRoundDisplayMaterial_${id}`, scene);
  material.diffuseTexture = texture;
  material.emissiveTexture = texture;
  material.opacityTexture = texture;
  material.emissiveColor = new Color3(1, 1, 1);
  material.disableLighting = true;
  material.backFaceCulling = false;
  material.useAlphaFromDiffuseTexture = true;
  material.disableDepthWrite = true;
  material.depthFunction = Constants.ALWAYS;

  const anchor = new TransformNode(`weaponRoundAnchor_${id}`, scene);
  anchor.parent = weaponRoot;

  const mesh = MeshBuilder.CreatePlane(`weaponRoundDisplay_${id}`, { size: 1 }, scene);
  mesh.material = material;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.renderingGroupId = VIEWMODEL_RENDERING_GROUP;
  mesh.layerMask = VIEWMODEL_LAYER_MASK;
  mesh.alphaIndex = 10050;
  mesh.rotationQuaternion = new Quaternion();
  mesh.parent = sway;

  const swayInverse = new Matrix();
  const localMatrix = new Matrix();
  const localScale = new Vector3();
  const localPosition = new Vector3();
  const localRotation = mesh.rotationQuaternion ?? new Quaternion();
  mesh.rotationQuaternion = localRotation;

  function canvasDpr() {
    if (typeof window === "undefined") return 1;
    return Math.min(window.devicePixelRatio || 1, 2);
  }

  function resizeCanvasForFontSize(sizePx: number) {
    const { width, height } = canvasDimensionsForFontSize(sizePx);
    const dpr = canvasDpr();
    const physicalW = Math.round(width * dpr);
    const physicalH = Math.round(height * dpr);
    logicalCanvasW = width;
    logicalCanvasH = height;
    if (canvas.width === physicalW && canvas.height === physicalH) {
      return false;
    }
    canvas.width = physicalW;
    canvas.height = physicalH;
    texture.scaleTo(physicalW, physicalH);
    ctx = texture.getContext() as CanvasRenderingContext2D;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return true;
  }

  function meterBarHeight() {
    return Math.max(4, Math.round(fontSize * 0.14));
  }

  function drawMeterBar(
    cx: number,
    barTopY: number,
    metrics: { pct: number; orangeOp: number; redOp: number; greenOp: number },
  ) {
    const barW = Math.round(fontSize * 2.15);
    const barH = meterBarHeight();
    const corner = Math.max(1, Math.round(barH * 0.35));
    const x = cx - barW / 2;
    const y = barTopY;
    const { pct, orangeOp, redOp, greenOp } = metrics;
    const fillW = Math.max(corner * 2, Math.round(barW * pct));

    ctx.save();
    chamferedRectPath(ctx, x, y, barW, barH, corner);
    ctx.fillStyle = "rgba(0, 0, 0, 0.72)";
    ctx.fill();
    ctx.strokeStyle = "rgba(180, 220, 255, 0.55)";
    ctx.lineWidth = Math.max(1, Math.round(fontSize * 0.04));
    ctx.stroke();

    if (fillW > 0) {
      ctx.save();
      chamferedRectPath(ctx, x, y, fillW, barH, corner);
      ctx.clip();
      drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_BLUE);
      if (orangeOp > 0) {
        ctx.globalAlpha = orangeOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_ORANGE);
      }
      if (redOp > 0) {
        ctx.globalAlpha = redOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_RED);
      }
      if (greenOp > 0) {
        ctx.globalAlpha = greenOp;
        drawVerticalGradientBar(ctx, x, y, fillW, barH, BAR_GREEN);
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function drawGlowTextAt(
    text: string,
    x: number,
    y: number,
    sizePx: number,
    palette: "low" | "normal",
  ) {
    applyHudRoundsTextStyle(ctx, sizePx);
    if (palette === "low") {
      ctx.shadowColor = LOW_HALO;
      ctx.shadowBlur = 16;
      ctx.fillStyle = "rgba(230, 50, 30, 0.45)";
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 8;
      ctx.fillStyle = LOW_CORE;
      ctx.fillText(text, x, y);
      ctx.shadowBlur = 0;
      return;
    }
    ctx.shadowColor = NORMAL_HALO;
    ctx.shadowBlur = 22;
    ctx.fillStyle = NORMAL_GLOW;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 12;
    ctx.fillStyle = NORMAL_GLOW;
    ctx.fillText(text, x, y);
    ctx.shadowBlur = 0;
    ctx.fillStyle = NORMAL_CORE;
    ctx.fillText(text, x, y);
  }

  function draw(hp: number, count: number, stamina: number, low: boolean) {
    const staminaPct = Math.round(
      Math.max(0, Number.isFinite(stamina) ? stamina : 1) * 100,
    );
    if (
      hp === lastHp &&
      count === lastCount &&
      staminaPct === lastStaminaPct &&
      low === lastLow
    ) {
      return;
    }
    lastHp = hp;
    lastCount = count;
    lastStaminaPct = staminaPct;
    lastLow = low;
    lastDrawnHp = hp;
    lastDrawnCount = count;
    lastDrawnStamina = stamina;
    lastDrawnLow = low;

    ctx.clearRect(0, 0, logicalCanvasW, logicalCanvasH);
    const cx = logicalCanvasW / 2;
    const roundsText = String(Math.max(0, Math.floor(count))).padStart(2, "0");
    const barH = meterBarHeight();
    const yOff = CONTENT_Y_OFFSET_PX;
    const hpBarTopY = logicalCanvasH * HP_Y_FRAC + yOff;

    drawMeterBar(cx, hpBarTopY, hpBarMetrics(hp));

    const roundsY = hpBarTopY + barH + fontSize * HP_BAR_TO_ROUNDS;
    drawGlowTextAt(roundsText, cx, roundsY, fontSize, low ? "low" : "normal");

    const barTopY = roundsY + fontSize * ROUNDS_TO_STAMINA_BAR;
    const staminaMetrics = staminaBarMetrics(stamina, hp);
    drawMeterBar(cx, barTopY, {
      pct: staminaMetrics.pctOfHpCap,
      orangeOp: staminaMetrics.orangeOp,
      redOp: staminaMetrics.redOp,
      greenOp: staminaMetrics.greenOp,
    });

    texture.update(false);
  }

  function redrawNow() {
    lastHp = -1;
    lastCount = -1;
    lastStaminaPct = -1;
    draw(lastDrawnHp, lastDrawnCount, lastDrawnStamina, lastDrawnLow);
  }

  function primeHudFont(sizePx: number) {
    const spec = hudRoundsFontSpec(sizePx);
    if (typeof document === "undefined" || !document.fonts?.load) {
      redrawNow();
      return;
    }
    const gen = ++fontLoadGen;
    document.fonts.load(spec).then(() => {
      if (gen !== fontLoadGen || fontSize !== sizePx) return;
      redrawNow();
    });
  }

  function applyVisualTuning(tuning: WeaponRoundDisplayPose) {
    const w = tuning.planeWidth * tuning.scale;
    const h = tuning.planeHeight * tuning.scale;
    mesh.scaling.set(w, h, 1);

    const nextFontSize = Math.round(tuning.fontSize);
    if (fontSize !== nextFontSize) {
      fontSize = nextFontSize;
      resizeCanvasForFontSize(fontSize);
      primeHudFont(fontSize);
      redrawNow();
    }
  }

  function syncPose(tuning: WeaponRoundDisplayPose, swayGroup: TransformNode) {
    anchor.position.set(tuning.posX, tuning.posY, tuning.posZ);
    anchor.rotation.set(tuning.rotX, tuning.rotY, tuning.rotZ);
    anchor.scaling.setAll(1);
    anchor.computeWorldMatrix(true);
    swayGroup.computeWorldMatrix(true);
    swayGroup.getWorldMatrix().invertToRef(swayInverse);
    anchor.getWorldMatrix().multiplyToRef(swayInverse, localMatrix);
    localMatrix.decompose(localScale, localRotation, localPosition);
    mesh.position.copyFrom(localPosition);
    mesh.position.z += SURFACE_Z_OFFSET;
    mesh.rotationQuaternion?.copyFrom(localRotation);
    applyVisualTuning(tuning);
  }

  function dispose() {
    texture.dispose();
    material.dispose();
    mesh.dispose();
    anchor.dispose();
  }

  resizeCanvasForFontSize(fontSize);
  primeHudFont(fontSize);
  draw(100, 88, 1, false);

  return {
    mesh,
    setCount: (count, low = false, hp = 100, stamina = 1) => {
      draw(hp, count, stamina, low);
    },
    syncPose,
    dispose,
  };
}
