import { DynamicTexture } from "@babylonjs/core/Materials/Textures/dynamicTexture";

function createCanvasTexture(
  draw: (ctx: CanvasRenderingContext2D, size: number) => void,
  size: number,
  name: string,
): DynamicTexture {
  const texture = new DynamicTexture(name, size, null, false);
  const ctx = texture.getContext() as CanvasRenderingContext2D;
  draw(ctx, size);
  texture.update(false);
  texture.hasAlpha = true;
  return texture;
}

export function createSunDiscTexture(): DynamicTexture {
  return createCanvasTexture((ctx, size) => {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, "rgba(255, 255, 250, 1)");
    grad.addColorStop(0.28, "rgba(255, 252, 235, 0.95)");
    grad.addColorStop(0.5, "rgba(255, 235, 185, 0.7)");
    grad.addColorStop(0.72, "rgba(255, 200, 130, 0.35)");
    grad.addColorStop(0.88, "rgba(255, 170, 95, 0.12)");
    grad.addColorStop(1.0, "rgba(255, 150, 80, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }, 256, "sunDisc");
}

export function createSunCoreTexture(): DynamicTexture {
  return createCanvasTexture((ctx, size) => {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, "rgba(255, 255, 255, 1)");
    grad.addColorStop(0.55, "rgba(255, 252, 240, 0.9)");
    grad.addColorStop(0.85, "rgba(255, 245, 220, 0.25)");
    grad.addColorStop(1.0, "rgba(255, 240, 210, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }, 128, "sunCore");
}

export function createSunSpikeTexture(): DynamicTexture {
  return createCanvasTexture((ctx, size) => {
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);

    const drawSpike = (
      angle: number,
      length: number,
      thickness: number,
      alpha: number,
    ) => {
      ctx.save();
      ctx.rotate(angle);
      const grad = ctx.createLinearGradient(-length, 0, length, 0);
      grad.addColorStop(0.0, "rgba(255, 240, 200, 0)");
      grad.addColorStop(0.32, `rgba(255, 250, 230, ${alpha * 0.25})`);
      grad.addColorStop(0.46, `rgba(255, 253, 245, ${alpha})`);
      grad.addColorStop(0.54, `rgba(255, 253, 245, ${alpha})`);
      grad.addColorStop(0.68, `rgba(255, 250, 230, ${alpha * 0.25})`);
      grad.addColorStop(1.0, "rgba(255, 240, 200, 0)");
      ctx.fillStyle = grad;
      ctx.fillRect(-length, -thickness / 2, length * 2, thickness);
      ctx.restore();
    };

    const spikes = [
      { ang: 0.17, len: 235, thick: 4, a: 0.55 },
      { ang: 0.74, len: 170, thick: 2, a: 0.35 },
      { ang: 1.36, len: 245, thick: 4, a: 0.6 },
      { ang: 1.92, len: 180, thick: 2, a: 0.35 },
      { ang: 2.48, len: 215, thick: 3, a: 0.45 },
      { ang: 3.05, len: 155, thick: 2, a: 0.3 },
      { ang: 3.68, len: 240, thick: 4, a: 0.55 },
      { ang: 4.21, len: 165, thick: 2, a: 0.35 },
      { ang: 4.83, len: 210, thick: 3, a: 0.45 },
      { ang: 5.46, len: 175, thick: 2, a: 0.35 },
      { ang: 5.97, len: 225, thick: 3, a: 0.5 },
    ];

    ctx.filter = "blur(1.5px)";
    for (const spike of spikes) {
      drawSpike(spike.ang, spike.len, spike.thick, spike.a);
    }
    ctx.filter = "none";
  }, 512, "sunSpikes");
}

export function createMoonHaloTexture(): DynamicTexture {
  return createCanvasTexture((ctx, size) => {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, "rgba(250, 252, 255, 0)");
    grad.addColorStop(0.5, "rgba(250, 252, 255, 0)");
    grad.addColorStop(0.7, "rgba(252, 254, 255, 0.98)");
    grad.addColorStop(0.78, "rgba(245, 250, 255, 0.7)");
    grad.addColorStop(0.88, "rgba(232, 240, 252, 0.32)");
    grad.addColorStop(1.0, "rgba(215, 225, 245, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }, 256, "moonHalo");
}

/** Ring cookie projected by the spot — bright annulus on floor/walls. */
export function createFlashlightRingProjectionTexture(
  ringThickness: number,
  haloWidth: number,
  haloBrightness: number,
): DynamicTexture {
  const band = Math.max(0.004, Math.min(0.4, ringThickness));
  const widthNorm = Math.min(1, Math.max(0, (haloWidth - 1) / 11));
  const ringInner = 0.05 + widthNorm * 0.36;
  const rise = ringInner;
  const peakIn = ringInner + band * 0.18;
  const peakOut = ringInner + band;
  const fall = ringInner + band * 1.4;

  const centerLevel = Math.round((0.58 - haloBrightness * 0.2) * 255);
  const peakLevel = Math.round((0.82 + haloBrightness * 0.38) * 255);
  const spillLevel = Math.round((0.68 + haloBrightness * 0.14) * 255);
  const edgeLevel = Math.round((0.52 - haloBrightness * 0.08) * 255);

  const c = (level: number, alpha: number) =>
    `rgba(${level}, ${level}, ${Math.min(255, level + 8)}, ${alpha})`;

  return createCanvasTexture((ctx, size) => {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0.0, c(centerLevel, 1));
    grad.addColorStop(Math.max(0.01, ringInner * 0.55), c(centerLevel, 1));
    grad.addColorStop(rise, c(spillLevel, 1));
    grad.addColorStop(peakIn, c(peakLevel, 1));
    grad.addColorStop(peakOut, c(peakLevel, 1));
    grad.addColorStop(fall, c(spillLevel, 1));
    grad.addColorStop(Math.min(0.98, fall + 0.12), c(edgeLevel, 1));
    grad.addColorStop(1.0, c(edgeLevel, 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }, 256, "flashlightRingProjection");
}
