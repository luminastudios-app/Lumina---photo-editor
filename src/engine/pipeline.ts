import type {
  AdjustmentsParams,
  AiColorizeParams,
  AiDenoiseParams,
  AiFaceReshapeParams,
  AiFaceRestoreParams,
  AiInstagramEffectParams,
  AiRelightParams,
  AiSkyParams,
  AiSkyPreset,
  BlurParams,
  CropParams,
  EditLayer,
  FrameParams,
  HistogramData,
  ImageLayerParams,
  ShapeParams,
  StickerParams,
  TextParams,
} from '../types/editor';
import {
  applyHslAndSplitTonePixel,
  applyToneAndColorPixel,
  applyToneExtendedPixel,
  clamp01,
  clamp255,
} from './colorMath';
import { buildCompositeCurveLUTs } from './curves';
import { applyDetailEffectsBuffer } from './effectsEngine';
import {
  applyFilterPresetPixel,
  getAllFilterPresets,
  type FilterPreset,
} from './filters';
import { compositeLayerOutput } from './maskEngine';
import {
  applyOverlayEffectToPixels,
  createDefaultOverlayBorder,
  drawCutoutShapeMask,
  getOverlayBoxDimensions,
  renderAlphaContourBorder,
} from './overlayEffects';

export const ASPECT_RATIOS: Record<string, number | null> = {
  free: null,
  '1:1': 1,
  '4:5': 4 / 5,
  '16:9': 16 / 9,
  '9:16': 9 / 16,
};

const imageCache = new Map<string, HTMLImageElement>();

export function loadImageCached(src: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(src);
  if (cached && cached.complete && cached.naturalWidth > 0) {
    return Promise.resolve(cached);
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageCache.set(src, img);
      resolve(img);
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function getOrCreateCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

function cloneCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = getOrCreateCanvas(src.width, src.height);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  return c;
}

function applyClarityAndSharpness(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  clarity: number,
  sharpness: number,
) {
  if (clarity === 0 && sharpness === 0) return;
  const copy = new Uint8ClampedArray(data);
  const sharpAmt = (sharpness / 100) * 0.85;
  const clarAmt = (clarity / 100) * 0.65;

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const c = copy[idx + ch];
        const avg =
          (copy[((y - 1) * w + (x - 1)) * 4 + ch] +
            copy[((y - 1) * w + x) * 4 + ch] +
            copy[((y - 1) * w + (x + 1)) * 4 + ch] +
            copy[(y * w + (x - 1)) * 4 + ch] +
            c +
            copy[(y * w + (x + 1)) * 4 + ch] +
            copy[((y + 1) * w + (x - 1)) * 4 + ch] +
            copy[((y + 1) * w + x) * 4 + ch] +
            copy[((y + 1) * w + (x + 1)) * 4 + ch]) /
          9;

        const detail = c - avg;
        const midWeight = 1 - Math.abs(c / 127.5 - 1) * 0.7;
        const delta = detail * (sharpAmt + clarAmt * midWeight);
        data[idx + ch] = clamp255(Math.round(c + delta));
      }
    }
  }
}

function applyGrainAndVignette(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  grain: number,
  vignette: number,
) {
  if (grain <= 0 && vignette === 0) return;
  const grainAmp = (grain / 100) * 34;
  const vigStrength = vignette / 100;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const invMaxDist = 1 / Math.sqrt(cx * cx + cy * cy);

  for (let y = 0; y < h; y++) {
    const dy = y - cy;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = data[idx];
      let g = data[idx + 1];
      let b = data[idx + 2];

      if (vignette !== 0) {
        const dx = x - cx;
        const dist = Math.sqrt(dx * dx + dy * dy) * invMaxDist;
        const falloff = Math.pow(clamp01((dist - 0.25) / 0.85), 1.85);
        const factor = 1 + vigStrength * 0.85 * falloff;
        r *= factor;
        g *= factor;
        b *= factor;
      }

      if (grainAmp > 0) {
        let n = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
        n = (n ^ (n >> 13)) * 1274126177;
        const noise = (((n ^ (n >> 16)) & 0xff) / 127.5 - 1) * grainAmp;
        r += noise;
        g += noise;
        b += noise;
      }

      data[idx] = clamp255(Math.round(r));
      data[idx + 1] = clamp255(Math.round(g));
      data[idx + 2] = clamp255(Math.round(b));
    }
  }
}

function applyAdjustmentsLayer(imgData: ImageData, adj: AdjustmentsParams) {
  const { data, width, height } = imgData;
  const hasTone =
    adj.exposure !== 0 ||
    (adj.brightness ?? 0) !== 0 ||
    Math.abs((adj.gamma ?? 1) - 1) > 0.01 ||
    adj.contrast !== 0 ||
    adj.highlights !== 0 ||
    adj.shadows !== 0 ||
    adj.whites !== 0 ||
    adj.blacks !== 0 ||
    adj.temperature !== 0 ||
    adj.tint !== 0 ||
    adj.saturation !== 0 ||
    adj.vibrance !== 0 ||
    adj.dehaze !== 0 ||
    adj.fade !== 0;

  if (hasTone) {
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] === 0) continue;
      const [nr, ng, nb] = applyToneAndColorPixel(data[i], data[i + 1], data[i + 2], adj);
      data[i] = nr;
      data[i + 1] = ng;
      data[i + 2] = nb;
    }
  }

  if (adj.clarity !== 0 || adj.sharpness !== 0) {
    applyClarityAndSharpness(data, width, height, adj.clarity, adj.sharpness);
  }

  if (adj.grain > 0 || adj.vignette !== 0) {
    applyGrainAndVignette(data, width, height, adj.grain, adj.vignette);
  }
}

function createBokehBlurredCanvas(
  source: HTMLCanvasElement,
  radiusPx: number,
  bokehShape: string = 'circle',
): HTMLCanvasElement {
  const w = source.width;
  const h = source.height;
  const out = getOrCreateCanvas(w, h);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;

  if (bokehShape === 'anamorphic') {
    // Stretched horizontal oval bokeh pass
    ctx.filter = `blur(${Math.max(1, Math.round(radiusPx * 0.45))}px)`;
    ctx.drawImage(source, 0, 0);
    ctx.filter = 'none';
    const d = ctx.getImageData(0, 0, w, h);
    const copy = new Uint8ClampedArray(d.data);
    const shift = Math.max(2, Math.round(radiusPx * 0.65));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const xl = Math.max(0, x - shift);
        const xr = Math.min(w - 1, x + shift);
        const idx = (y * w + x) * 4;
        const iL = (y * w + xl) * 4;
        const iR = (y * w + xr) * 4;
        d.data[idx] = Math.round(copy[idx] * 0.5 + copy[iL] * 0.25 + copy[iR] * 0.25);
        d.data[idx + 1] = Math.round(copy[idx + 1] * 0.5 + copy[iL + 1] * 0.25 + copy[iR + 1] * 0.25);
        d.data[idx + 2] = Math.round(copy[idx + 2] * 0.5 + copy[iL + 2] * 0.25 + copy[iR + 2] * 0.25);
      }
    }
    ctx.putImageData(d, 0, 0);
    return out;
  }

  ctx.filter = `blur(${radiusPx}px)`;
  ctx.drawImage(source, 0, 0);
  ctx.filter = 'none';

  // Subtle polygonal bokeh specular blade facets for hexagon/octagon
  if (bokehShape === 'hexagon' || bokehShape === 'octagon') {
    const d = ctx.getImageData(0, 0, w, h);
    const px = d.data;
    const sides = bokehShape === 'hexagon' ? 6 : 8;
    const boost = 1.04 + sides * 0.005;
    for (let i = 0; i < px.length; i += 4) {
      const lum = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (lum > 185) {
        px[i] = clamp255(Math.round(px[i] * boost));
        px[i + 1] = clamp255(Math.round(px[i + 1] * boost));
        px[i + 2] = clamp255(Math.round(px[i + 2] * boost));
      }
    }
    ctx.putImageData(d, 0, 0);
  }

  return out;
}

function applyBlurLayer(canvas: HTMLCanvasElement, blur: BlurParams) {
  if (blur.amount <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const radiusPx = Math.max(1, Math.round((blur.amount / 100) * Math.min(w, h) * 0.045));

  const blurredCanvas = createBokehBlurredCanvas(canvas, radiusPx, blur.bokehShape ?? 'circle');
  const bCtx = blurredCanvas.getContext('2d', { willReadFrequently: true })!;

  const origCtx = canvas.getContext('2d', { willReadFrequently: true })!;
  const origData = origCtx.getImageData(0, 0, w, h);
  const blurData = bCtx.getImageData(0, 0, w, h);
  const o = origData.data;
  const bl = blurData.data;

  const cx = blur.centerX * w;
  const cy = blur.centerY * h;
  const minDim = Math.min(w, h);
  const focusRad = blur.radius * minDim;
  const featherPx = Math.max(8, (blur.feather / 100) * minDim * 0.45);
  const radAngle = (blur.angle * Math.PI) / 180;
  const cosA = Math.cos(radAngle);
  const sinA = Math.sin(radAngle);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let blurMask = 0;

      if (blur.mode === 'radial') {
        const d = Math.hypot(x - cx, y - cy);
        blurMask = clamp01((d - focusRad) / featherPx);
      } else if (blur.mode === 'linear') {
        const proj = (x - cx) * sinA + (y - cy) * cosA;
        blurMask = clamp01((proj - focusRad * 0.25) / featherPx);
      } else if (blur.mode === 'tiltshift') {
        const distFromBand = Math.abs(-(x - cx) * sinA + (y - cy) * cosA);
        blurMask = clamp01((distFromBand - focusRad * 0.5) / featherPx);
      } else {
        const dx = (x - cx) / (w * 0.34);
        const dy = (y - cy) / (h * 0.42);
        const ellip = Math.sqrt(dx * dx + dy * dy);
        blurMask = clamp01(
          (ellip - (0.65 + blur.radius * 0.6)) / Math.max(0.15, blur.feather / 120),
        );
      }

      if (blurMask > 0) {
        const m = blurMask;
        o[idx] = Math.round(o[idx] * (1 - m) + bl[idx] * m);
        o[idx + 1] = Math.round(o[idx + 1] * (1 - m) + bl[idx + 1] * m);
        o[idx + 2] = Math.round(o[idx + 2] * (1 - m) + bl[idx + 2] * m);
      }
    }
  }

  origCtx.putImageData(origData, 0, 0);
}

function renderCroppedBase(
  sourceImg: HTMLImageElement,
  crop: CropParams | null,
  maxEdge: number,
): HTMLCanvasElement {
  const sw = sourceImg.naturalWidth;
  const sh = sourceImg.naturalHeight;
  const rot = crop ? crop.rotate90 : 0;
  const isRotated90 = rot === 90 || rot === 270;
  const baseW = isRotated90 ? sh : sw;
  const baseH = isRotated90 ? sw : sh;

  const rect = crop?.cropRect ?? { x: 0, y: 0, w: 1, h: 1 };
  const cropPxW = Math.max(2, baseW * rect.w);
  const cropPxH = Math.max(2, baseH * rect.h);

  const scaleFactor =
    maxEdge > 0 && Math.max(cropPxW, cropPxH) > maxEdge
      ? maxEdge / Math.max(cropPxW, cropPxH)
      : 1;

  const outW = Math.max(2, Math.round(cropPxW * scaleFactor));
  const outH = Math.max(2, Math.round(cropPxH * scaleFactor));

  const fullScaledW = Math.round(baseW * scaleFactor);
  const fullScaledH = Math.round(baseH * scaleFactor);
  const temp = getOrCreateCanvas(fullScaledW, fullScaledH);
  const tCtx = temp.getContext('2d', { willReadFrequently: true })!;
  tCtx.save();
  tCtx.translate(fullScaledW / 2, fullScaledH / 2);

  if (crop) {
    tCtx.translate(crop.offsetX * fullScaledW, crop.offsetY * fullScaledH);
    const totalAngle = ((crop.rotate90 + crop.straighten) * Math.PI) / 180;
    tCtx.rotate(totalAngle);
    const autoScale =
      crop.straighten !== 0
        ? Math.max(
            1,
            Math.abs(Math.cos((crop.straighten * Math.PI) / 180)) +
              Math.abs(Math.sin((crop.straighten * Math.PI) / 180)) * 0.65,
          )
        : 1;
    const totalScale = crop.scale * autoScale;
    tCtx.scale(totalScale * (crop.flipH ? -1 : 1), totalScale * (crop.flipV ? -1 : 1));
  }

  const drawW = sw * scaleFactor;
  const drawH = sh * scaleFactor;
  tCtx.drawImage(sourceImg, -drawW / 2, -drawH / 2, drawW, drawH);
  tCtx.restore();

  const out = getOrCreateCanvas(outW, outH);
  const oCtx = out.getContext('2d', { willReadFrequently: true })!;
  oCtx.drawImage(
    temp,
    rect.x * fullScaledW,
    rect.y * fullScaledH,
    rect.w * fullScaledW,
    rect.h * fullScaledH,
    0,
    0,
    outW,
    outH,
  );
  return out;
}

function drawStickerShape(
  ctx: CanvasRenderingContext2D,
  shape: string,
  size: number,
  color: string,
) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, size * 0.08);
  const r = size / 2;

  if (shape === 'circle') {
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
  } else if (shape === 'ring') {
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2);
    ctx.stroke();
  } else if (shape === 'rect') {
    ctx.beginPath();
    ctx.roundRect(-r, -r * 0.72, size, size * 0.72 * 2, size * 0.12);
    ctx.fill();
  } else if (shape === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.44;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
  } else if (shape === 'heart') {
    ctx.beginPath();
    const s = r * 0.9;
    ctx.moveTo(0, s * 0.75);
    ctx.bezierCurveTo(-s * 1.3, s * 0.05, -s * 0.85, -s * 0.95, 0, -s * 0.32);
    ctx.bezierCurveTo(s * 0.85, -s * 0.95, s * 1.3, s * 0.05, 0, s * 0.75);
    ctx.fill();
  } else if (shape === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-r, -r * 0.25);
    ctx.lineTo(r * 0.25, -r * 0.25);
    ctx.lineTo(r * 0.25, -r * 0.65);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.25, r * 0.65);
    ctx.lineTo(r * 0.25, r * 0.25);
    ctx.lineTo(-r, r * 0.25);
    ctx.closePath();
    ctx.fill();
  }
}

function drawShapeLayer(ctx: CanvasRenderingContext2D, w: number, h: number, p: ShapeParams) {
  const minDim = Math.min(w, h);
  const pxSize = p.size * minDim;
  const r = pxSize / 2;
  ctx.save();
  ctx.globalAlpha = clamp01(p.opacity);
  ctx.translate(p.x * w, p.y * h);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.fillStyle = p.fillColor;
  ctx.strokeStyle = p.strokeColor;
  ctx.lineWidth = Math.max(0, (p.strokeWidth * minDim) / 1080);

  ctx.beginPath();
  if (p.kind === 'rect' || p.kind === 'badge') {
    const corner = Math.min(r * 0.85, (p.cornerRadius / 50) * r);
    const hh = p.kind === 'badge' ? pxSize * 0.56 : pxSize * 0.75;
    ctx.roundRect(-r, -hh / 2, pxSize, hh, corner);
  } else if (p.kind === 'circle') {
    ctx.arc(0, 0, r, 0, Math.PI * 2);
  } else if (p.kind === 'ring') {
    ctx.arc(0, 0, r * 0.85, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    return;
  } else if (p.kind === 'triangle') {
    ctx.moveTo(0, -r);
    ctx.lineTo(r * 0.9, r * 0.75);
    ctx.lineTo(-r * 0.9, r * 0.75);
    ctx.closePath();
  } else if (p.kind === 'star') {
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const a = (i * Math.PI) / 5 - Math.PI / 2;
      if (i === 0) ctx.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
      else ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
  } else if (p.kind === 'heart') {
    const s = r * 0.9;
    ctx.moveTo(0, s * 0.75);
    ctx.bezierCurveTo(-s * 1.3, s * 0.05, -s * 0.85, -s * 0.95, 0, -s * 0.32);
    ctx.bezierCurveTo(s * 0.85, -s * 0.95, s * 1.3, s * 0.05, 0, s * 0.75);
  } else if (p.kind === 'arrow') {
    ctx.moveTo(-r, -r * 0.25);
    ctx.lineTo(r * 0.25, -r * 0.25);
    ctx.lineTo(r * 0.25, -r * 0.65);
    ctx.lineTo(r, 0);
    ctx.lineTo(r * 0.25, r * 0.65);
    ctx.lineTo(r * 0.25, r * 0.25);
    ctx.lineTo(-r, r * 0.25);
    ctx.closePath();
  }
  ctx.fill();
  if (p.strokeWidth > 0) ctx.stroke();
  ctx.restore();
}

function resolveTextFill(
  ctx: CanvasRenderingContext2D,
  boxW: number,
  boxH: number,
  p: TextParams,
): string | CanvasGradient {
  if (!p.gradientEnabled) return p.color;
  const rad = ((p.gradientAngle ?? 45) * Math.PI) / 180;
  const r = Math.max(24, Math.hypot(boxW, boxH) * 0.55);
  const grad = ctx.createLinearGradient(
    -Math.cos(rad) * r,
    -Math.sin(rad) * r,
    Math.cos(rad) * r,
    Math.sin(rad) * r,
  );
  grad.addColorStop(0, p.gradientColor1 || '#F59E0B');
  grad.addColorStop(1, p.gradientColor2 || '#EC4899');
  return grad;
}

function drawTextLayer(ctx: CanvasRenderingContext2D, w: number, h: number, p: TextParams) {
  if (!p.text.trim()) return;
  const scaleRef = h / 1080;
  const pxSize = Math.max(10, p.fontSize * scaleRef);

  ctx.save();
  ctx.translate(p.x * w, p.y * h);
  ctx.rotate((p.rotation * Math.PI) / 180);
  ctx.font = `${p.fontWeight} ${pxSize}px "${p.fontFamily}", sans-serif`;
  ctx.textBaseline = 'middle';

  const spacingPx = (p.letterSpacing ?? 0) * scaleRef;
  if ('letterSpacing' in ctx) {
    (ctx as unknown as { letterSpacing: string }).letterSpacing = `${spacingPx}px`;
  }

  const lines = p.text.split('\n');
  const lineMult = p.lineHeight ?? 1.22;
  const lineH = pxSize * lineMult;
  const totalH = lines.length * lineH;
  const maxW = Math.max(...lines.map((line) => ctx.measureText(line).width), 20);

  if (p.bgEnabled) {
    const padX = pxSize * 0.45;
    const padY = pxSize * 0.28;
    ctx.fillStyle = p.bgColor;
    ctx.beginPath();
    ctx.roundRect(
      -maxW / 2 - padX,
      -totalH / 2 - padY,
      maxW + padX * 2,
      totalH + padY * 2,
      pxSize * 0.28,
    );
    ctx.fill();
  }

  if ((p.glowBlur ?? 0) > 0) {
    ctx.shadowColor = p.glowColor || p.color;
    ctx.shadowBlur = (p.glowBlur ?? 0) * scaleRef;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
  } else if (p.shadowBlur > 0) {
    ctx.shadowColor = p.shadowColor;
    ctx.shadowBlur = p.shadowBlur * scaleRef;
    ctx.shadowOffsetY = 2 * scaleRef;
  }

  const fillStyle = resolveTextFill(ctx, maxW, Math.max(totalH, pxSize * 2), p);
  const pathStyle = p.pathStyle ?? 'arc';
  const curve = p.curveAmount ?? 0;

  if (pathStyle === 'circle' && lines.length > 0) {
    const single = lines.join(' ');
    const chars = Array.from(single);
    const radius = Math.max(pxSize * 1.8, maxW / (Math.PI * 1.45));
    const stepA = (Math.PI * 2) / Math.max(1, chars.length);
    ctx.textAlign = 'center';
    chars.forEach((ch, idx) => {
      const a = -Math.PI / 2 + idx * stepA;
      ctx.save();
      ctx.rotate(a);
      ctx.translate(0, -radius);
      if (p.strokeWidth > 0) {
        ctx.lineWidth = p.strokeWidth * scaleRef * 2;
        ctx.strokeStyle = p.strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, 0, 0);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  } else if (pathStyle === 'wave' && Math.abs(curve) > 2 && lines.length > 0) {
    const single = lines.join(' ');
    const chars = Array.from(single);
    const amp = pxSize * (curve / 100) * 0.9;
    ctx.textAlign = 'center';
    const widths = chars.map((ch) => Math.max(pxSize * 0.28, ctx.measureText(ch).width));
    const totalCharW = widths.reduce((a, b) => a + b, 0);
    let cursorX = -totalCharW / 2;
    chars.forEach((ch, idx) => {
      const cw = widths[idx];
      const cx = cursorX + cw / 2;
      const t = (idx / Math.max(1, chars.length - 1)) * Math.PI * 2;
      const cy = Math.sin(t) * amp;
      const slope = Math.cos(t) * (amp / Math.max(30, totalCharW / (Math.PI * 2)));
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(Math.atan(slope));
      if (p.strokeWidth > 0) {
        ctx.lineWidth = p.strokeWidth * scaleRef * 2;
        ctx.strokeStyle = p.strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, 0, 0);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
      cursorX += cw;
    });
  } else if (Math.abs(curve) > 2 && lines.length > 0) {
    // Curved text along a circular arc path
    const single = lines.join(' ');
    const chars = Array.from(single);
    const radius = Math.max(pxSize * 2, (maxW * 120) / Math.max(8, Math.abs(curve)));
    const totalAngle = (maxW / radius) * (curve > 0 ? 1 : -1);
    const stepA = chars.length > 1 ? totalAngle / Math.max(1, chars.length - 1) : 0;
    const ySign = curve > 0 ? 1 : -1;
    ctx.textAlign = 'center';

    chars.forEach((ch, idx) => {
      const a = -totalAngle / 2 + idx * stepA;
      ctx.save();
      ctx.translate(0, ySign * radius);
      ctx.rotate(a);
      ctx.translate(0, -ySign * radius);
      if (p.strokeWidth > 0) {
        ctx.lineWidth = p.strokeWidth * scaleRef * 2;
        ctx.strokeStyle = p.strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(ch, 0, 0);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    });
  } else {
    const align = p.textAlign ?? 'center';
    ctx.textAlign = align;
    const xAnchor = align === 'left' ? -maxW / 2 : align === 'right' ? maxW / 2 : 0;
    lines.forEach((line, idx) => {
      const ly = -totalH / 2 + lineH * (idx + 0.5);
      if (p.strokeWidth > 0) {
        ctx.lineWidth = p.strokeWidth * scaleRef * 2;
        ctx.strokeStyle = p.strokeColor;
        ctx.lineJoin = 'round';
        ctx.strokeText(line, xAnchor, ly);
      }
      ctx.fillStyle = fillStyle;
      ctx.fillText(line, xAnchor, ly);
    });
  }

  ctx.restore();
}

async function drawStickerLayer(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: StickerParams,
) {
  const minDim = Math.min(w, h);
  const pxSize = p.size * minDim;
  ctx.save();
  ctx.globalAlpha = clamp01(p.opacity);
  ctx.translate(p.x * w, p.y * h);
  ctx.rotate((p.rotation * Math.PI) / 180);

  if (p.kind === 'emoji') {
    ctx.font = `${pxSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.value, 0, 0);
  } else if (p.kind === 'image' && p.src) {
    try {
      const stImg = await loadImageCached(p.src);
      const ratio = stImg.naturalWidth / Math.max(1, stImg.naturalHeight);
      const dw = ratio >= 1 ? pxSize : pxSize * ratio;
      const dh = ratio >= 1 ? pxSize / ratio : pxSize;
      ctx.drawImage(stImg, -dw / 2, -dh / 2, dw, dh);
    } catch {
      // ignore unloadable custom sticker
    }
  } else {
    drawStickerShape(ctx, p.value, pxSize, p.color);
  }

  ctx.restore();
}

async function renderIsolatedOverlayLayer(
  w: number,
  h: number,
  p: ImageLayerParams,
): Promise<HTMLCanvasElement | null> {
  if (!p.src) return null;
  try {
    const img = await loadImageCached(p.src);
    const ratio = p.aspectRatio ?? img.naturalWidth / Math.max(1, img.naturalHeight);
    const { dw, dh } = getOverlayBoxDimensions(w, h, { scale: p.scale, aspectRatio: ratio });

    // Process effects & mask at balanced working resolution (crisp & responsive)
    const maxLocalDim = 960;
    const scaleDown = Math.min(1, maxLocalDim / Math.max(1, dw, dh));
    const ow = Math.max(4, Math.round(dw * scaleDown));
    const oh = Math.max(4, Math.round(dh * scaleDown));

    const localCanvas = getOrCreateCanvas(ow, oh);
    const lCtx = localCanvas.getContext('2d', { willReadFrequently: true })!;
    lCtx.drawImage(img, 0, 0, ow, oh);

    // 1. Stack non-destructive pixel effects (excluding outer drop-shadow handled with padding)
    const enabledEffects = (p.effects ?? []).filter((fx) => fx.enabled && fx.intensity > 0);
    const dropShadows = enabledEffects.filter((fx) => fx.kind === 'drop-shadow');
    const pixelEffects = enabledEffects.filter((fx) => fx.kind !== 'drop-shadow');

    if (pixelEffects.length > 0) {
      const imgData = lCtx.getImageData(0, 0, ow, oh);
      for (const fx of pixelEffects) {
        applyOverlayEffectToPixels(imgData.data, ow, oh, fx.kind, fx.intensity);
      }
      lCtx.putImageData(imgData, 0, 0);
    }

    // 2. Non-destructive Cutout Shape, Erase & Restore brush strokes, and Invert
    const strokes = p.eraseStrokes ?? [];
    const cutoutShape = p.cutoutShape ?? 'none';
    const cutoutInverted = Boolean(p.cutoutInverted);
    if (strokes.length > 0 || cutoutShape !== 'none' || cutoutInverted) {
      const maskCanvas = getOrCreateCanvas(ow, oh);
      const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
      drawCutoutShapeMask(mCtx, ow, oh, cutoutShape);
      const minLocal = Math.min(ow, oh);
      for (const st of strokes) {
        if (st.points.length === 0) continue;
        const rPx = Math.max(2, st.size * minLocal);
        const hardness = clamp01((st.hardness ?? 75) / 100);
        mCtx.save();
        mCtx.globalCompositeOperation = st.tool === 'erase' ? 'destination-out' : 'source-over';
        mCtx.globalAlpha = clamp01((st.opacity ?? 100) / 100);
        if (hardness < 0.95) {
          mCtx.shadowColor = st.tool === 'erase' ? 'rgba(0,0,0,1)' : '#FFFFFF';
          mCtx.shadowBlur = rPx * (1 - hardness) * 0.7;
        }
        mCtx.strokeStyle = '#FFFFFF';
        mCtx.lineWidth = rPx;
        mCtx.lineCap = 'round';
        mCtx.lineJoin = 'round';
        mCtx.beginPath();
        mCtx.moveTo(st.points[0].x * ow, st.points[0].y * oh);
        for (let i = 1; i < st.points.length; i++) {
          mCtx.lineTo(st.points[i].x * ow, st.points[i].y * oh);
        }
        if (st.points.length === 1) {
          mCtx.lineTo(st.points[0].x * ow + 0.1, st.points[0].y * oh);
        }
        mCtx.stroke();
        mCtx.restore();
      }
      if (cutoutInverted) {
        const mImg = mCtx.getImageData(0, 0, ow, oh);
        const lImg = lCtx.getImageData(0, 0, ow, oh);
        for (let i = 3; i < mImg.data.length; i += 4) {
          const curCombined = Math.round((lImg.data[i] / 255) * mImg.data[i]);
          mImg.data[i] = 255 - curCombined;
          lImg.data[i] = 255;
        }
        mCtx.putImageData(mImg, 0, 0);
        lCtx.putImageData(lImg, 0, 0);
      }
      lCtx.save();
      lCtx.globalCompositeOperation = 'destination-in';
      lCtx.drawImage(maskCanvas, 0, 0);
      lCtx.restore();
    }

    // 3. Apply rounded corners clipping & object-hugging alpha contour border stroke
    const border = p.border;
    const hasRadius = Boolean(border && border.radius > 0);
    const hasBorderStroke = Boolean(border && border.width > 0);

    let framedCanvas = localCanvas;
    if (hasRadius || hasBorderStroke) {
      const bw = hasBorderStroke ? Math.max(1, (border!.width * Math.min(ow, oh)) / 360) : 0;
      const padB = hasBorderStroke ? Math.ceil(bw) + 2 : 0;
      framedCanvas = getOrCreateCanvas(ow + padB * 2, oh + padB * 2);
      const fCtx = framedCanvas.getContext('2d', { willReadFrequently: true })!;
      renderAlphaContourBorder(
        fCtx,
        localCanvas,
        ow,
        oh,
        padB,
        bw,
        border ?? createDefaultOverlayBorder(),
      );
    }

    // 4. Optional outer Drop Shadow (rendered with outer padding around shape/cutout)
    let finalLocal = framedCanvas;
    let padRatioX = framedCanvas.width / ow;
    let padRatioY = framedCanvas.height / oh;

    if (dropShadows.length > 0) {
      const strong = Math.max(...dropShadows.map((d) => d.intensity)) / 100;
      const shPad = Math.max(6, Math.round(Math.min(ow, oh) * 0.14 * strong));
      const shCanvas = getOrCreateCanvas(framedCanvas.width + shPad * 2, framedCanvas.height + shPad * 2);
      const sCtx = shCanvas.getContext('2d', { willReadFrequently: true })!;
      sCtx.save();
      sCtx.shadowColor = `rgba(0, 0, 0, ${(0.35 + strong * 0.55).toFixed(2)})`;
      sCtx.shadowBlur = shPad * 0.72;
      sCtx.shadowOffsetX = shPad * 0.28;
      sCtx.shadowOffsetY = shPad * 0.34;
      sCtx.drawImage(framedCanvas, shPad, shPad);
      sCtx.restore();
      finalLocal = shCanvas;
      padRatioX = shCanvas.width / ow;
      padRatioY = shCanvas.height / oh;
    }

    // 5. Place overlay cleanly on a transparent full-size (w x h) buffer
    const out = getOrCreateCanvas(w, h);
    const oCtx = out.getContext('2d', { willReadFrequently: true })!;
    const drawW = dw * padRatioX;
    const drawH = dh * padRatioY;

    oCtx.save();
    oCtx.translate(p.x * w, p.y * h);
    oCtx.rotate((p.rotation * Math.PI) / 180);
    oCtx.scale(p.flipH ? -1 : 1, p.flipV ? -1 : 1);
    oCtx.drawImage(finalLocal, -drawW / 2, -drawH / 2, drawW, drawH);
    oCtx.restore();

    return out;
  } catch {
    return null;
  }
}

function applyFrame(canvas: HTMLCanvasElement, frame: FrameParams): HTMLCanvasElement {
  if (frame.style === 'none') return canvas;
  const w = canvas.width;
  const h = canvas.height;
  const scaleRef = Math.min(w, h) / 1080;
  const borderPx = Math.max(2, Math.round(frame.width * scaleRef));

  if (frame.style === 'rounded') {
    const out = getOrCreateCanvas(w, h);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    const rad = Math.min(w / 2, h / 2, frame.innerRadius * scaleRef);
    ctx.beginPath();
    ctx.roundRect(0, 0, w, h, rad);
    ctx.clip();
    ctx.drawImage(canvas, 0, 0);
    return out;
  }

  if (frame.style === 'solid') {
    const out = getOrCreateCanvas(w + borderPx * 2, h + borderPx * 2);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = frame.color;
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, borderPx, borderPx);
    return out;
  }

  if (frame.style === 'double') {
    const out = getOrCreateCanvas(w + borderPx * 2, h + borderPx * 2);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = frame.color || '#FAFAFA';
    ctx.fillRect(0, 0, out.width, out.height);
    const innerLine = Math.max(1, Math.round(borderPx * 0.35));
    ctx.strokeStyle = 'rgba(20,20,24,0.45)';
    ctx.lineWidth = Math.max(1, Math.round(scaleRef * 3));
    ctx.strokeRect(innerLine, innerLine, out.width - innerLine * 2, out.height - innerLine * 2);
    ctx.drawImage(canvas, borderPx, borderPx);
    return out;
  }

  if (frame.style === 'polaroid') {
    const bottomPad = Math.round(borderPx * 3.2);
    const out = getOrCreateCanvas(w + borderPx * 2, h + borderPx + bottomPad);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = frame.color || '#FAFAFA';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, borderPx, borderPx);
    ctx.strokeStyle = 'rgba(0,0,0,0.08)';
    ctx.lineWidth = Math.max(1, scaleRef * 2);
    ctx.strokeRect(borderPx, borderPx, w, h);
    return out;
  }

  if (frame.style === 'torn-paper') {
    const pad = Math.max(12, borderPx * 1.25);
    const out = getOrCreateCanvas(w + pad * 2, h + pad * 2);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = frame.color || '#F4EFE6';
    ctx.fillRect(0, 0, out.width, out.height);

    // Draw subtle deckle inner shadow + organic torn paper cutout around the photo
    const step = Math.max(8, Math.round(Math.min(w, h) * 0.025));
    const amp = Math.max(3, pad * 0.34);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    for (let x = pad; x <= out.width - pad; x += step) {
      const j = (Math.sin(x * 0.19) * 0.6 + Math.cos(x * 0.43) * 0.4) * amp;
      ctx.lineTo(x, pad + j);
    }
    for (let y = pad; y <= out.height - pad; y += step) {
      const j = (Math.sin(y * 0.23) * 0.6 + Math.cos(y * 0.51) * 0.4) * amp;
      ctx.lineTo(out.width - pad + j, y);
    }
    for (let x = out.width - pad; x >= pad; x -= step) {
      const j = (Math.sin(x * 0.29) * 0.6 + Math.cos(x * 0.37) * 0.4) * amp;
      ctx.lineTo(x, out.height - pad + j);
    }
    for (let y = out.height - pad; y >= pad; y -= step) {
      const j = (Math.sin(y * 0.31) * 0.6 + Math.cos(y * 0.61) * 0.4) * amp;
      ctx.lineTo(pad + j, y);
    }
    ctx.closePath();
    ctx.shadowColor = 'rgba(0,0,0,0.28)';
    ctx.shadowBlur = Math.max(4, pad * 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.08)';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(canvas, pad, pad);
    ctx.restore();
    return out;
  }

  if (frame.style === 'grunge') {
    const pad = Math.max(10, borderPx * 1.15);
    const out = getOrCreateCanvas(w + pad * 2, h + pad * 2);
    const ctx = out.getContext('2d', { willReadFrequently: true })!;
    ctx.fillStyle = frame.color || '#141519';
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(canvas, pad, pad);

    // Distressed ink splatters & worn rough inner edge notches
    ctx.save();
    ctx.fillStyle = frame.color || '#141519';
    for (let s = 0; s < 140; s++) {
      const edge = s % 4;
      const frac = (((s * 7919 + 19) % 1000) / 1000);
      const jitter = (((s * 3571 + 7) % 100) / 100) * pad * 1.35;
      const rad = Math.max(1.5, ((s % 7) + 1) * (pad * 0.085));
      let sx = 0, sy = 0;
      if (edge === 0) {
        sx = frac * out.width;
        sy = pad * 0.55 + jitter;
      } else if (edge === 1) {
        sx = out.width - pad * 0.55 - jitter;
        sy = frac * out.height;
      } else if (edge === 2) {
        sx = frac * out.width;
        sy = out.height - pad * 0.55 - jitter;
      } else {
        sx = pad * 0.55 + jitter;
        sy = frac * out.height;
      }
      ctx.globalAlpha = 0.45 + (s % 5) * 0.1;
      ctx.beginPath();
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    return out;
  }

  const out = getOrCreateCanvas(w + borderPx * 2, h + borderPx * 2);
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.fillStyle = '#0B0B0D';
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.drawImage(canvas, borderPx, borderPx);

  ctx.fillStyle = '#24262D';
  const holeW = Math.max(4, borderPx * 0.48);
  const holeH = Math.max(6, borderPx * 0.68);
  const step = holeW * 2.2;
  for (let x = borderPx; x < out.width - borderPx; x += step) {
    ctx.beginPath();
    ctx.roundRect(x, borderPx * 0.16, holeW, holeH, 2);
    ctx.roundRect(x, out.height - borderPx * 0.84, holeW, holeH, 2);
    ctx.fill();
  }
  return out;
}

export const AI_BG_GRADIENTS: Record<string, [string, string]> = {
  sunset: ['#FF7E5F', '#FEB47B'],
  ocean: ['#0F2027', '#2C5364'],
  studio: ['#1F242D', '#3B4252'],
  peach: ['#FBD3E9', '#BB377D'],
  emerald: ['#134E5E', '#71B280'],
};

const AI_SKY_COLORS: Record<AiSkyPreset, [string, string, string]> = {
  sunset: ['#1E1B4B', '#F97316', '#FDE047'],
  dusk: ['#0F172A', '#7E22CE', '#F472B6'],
  azure: ['#0369A1', '#38BDF8', '#E0F2FE'],
  night: ['#020617', '#0F172A', '#1E3A8A'],
  pastel: ['#8B5CF6', '#F472B6', '#FDE68A'],
};

function drawRealisticAtmosphericSky(sCtx: CanvasRenderingContext2D, w: number, h: number, preset: AiSkyPreset) {
  const [cTop, cMid, cHorizon] = AI_SKY_COLORS[preset] ?? AI_SKY_COLORS.sunset;
  const grad = sCtx.createLinearGradient(0, 0, 0, h * 0.78);
  grad.addColorStop(0, cTop);
  grad.addColorStop(0.55, cMid);
  grad.addColorStop(1, cHorizon);
  sCtx.fillStyle = grad;
  sCtx.fillRect(0, 0, w, h);

  // Atmospheric sun / moon / celestial focal glow
  sCtx.save();
  if (preset === 'sunset' || preset === 'golden-hour' as never) {
    const sunGrad = sCtx.createRadialGradient(w * 0.68, h * 0.36, w * 0.015, w * 0.68, h * 0.36, w * 0.55);
    sunGrad.addColorStop(0, 'rgba(255, 252, 220, 0.95)');
    sunGrad.addColorStop(0.18, 'rgba(253, 224, 71, 0.65)');
    sunGrad.addColorStop(0.55, 'rgba(249, 115, 22, 0.25)');
    sunGrad.addColorStop(1, 'rgba(249, 115, 22, 0)');
    sCtx.fillStyle = sunGrad;
    sCtx.fillRect(0, 0, w, h);
  } else if (preset === 'azure') {
    const sunGrad = sCtx.createRadialGradient(w * 0.28, h * 0.18, w * 0.02, w * 0.28, h * 0.18, w * 0.55);
    sunGrad.addColorStop(0, 'rgba(255, 255, 255, 0.75)');
    sunGrad.addColorStop(0.35, 'rgba(224, 242, 254, 0.32)');
    sunGrad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    sCtx.fillStyle = sunGrad;
    sCtx.fillRect(0, 0, w, h);
  } else if (preset === 'night') {
    // Soft moon + Milky Way glow + starfield
    const moonGrad = sCtx.createRadialGradient(w * 0.72, h * 0.2, 2, w * 0.72, h * 0.2, w * 0.28);
    moonGrad.addColorStop(0, 'rgba(248, 250, 252, 0.95)');
    moonGrad.addColorStop(0.08, 'rgba(226, 232, 240, 0.55)');
    moonGrad.addColorStop(0.4, 'rgba(59, 130, 246, 0.18)');
    moonGrad.addColorStop(1, 'rgba(15, 23, 42, 0)');
    sCtx.fillStyle = moonGrad;
    sCtx.fillRect(0, 0, w, h);
    const starCount = Math.min(180, Math.round((w * h) / 1600));
    for (let s = 0; s < starCount; s++) {
      const sx = ((s * 7919 + 104729) % 1000) / 1000;
      const sy = ((s * 6271 + 31337) % 1000) / 1000;
      if (sy > 0.65) continue;
      const alpha = (0.35 + ((s * 17) % 65) / 100) * (1 - sy * 1.1);
      const rad = ((s * 13) % 10) === 0 ? Math.max(1.2, w * 0.0022) : Math.max(0.7, w * 0.0012);
      sCtx.fillStyle = `rgba(248, 250, 252, ${Math.max(0.08, alpha).toFixed(2)})`;
      sCtx.beginPath();
      sCtx.arc(sx * w, sy * h, rad, 0, Math.PI * 2);
      sCtx.fill();
    }
  } else if (preset === 'dusk' || preset === 'pastel') {
    const glowGrad = sCtx.createRadialGradient(w * 0.5, h * 0.45, w * 0.05, w * 0.5, h * 0.45, w * 0.65);
    glowGrad.addColorStop(0, preset === 'dusk' ? 'rgba(244, 114, 182, 0.45)' : 'rgba(253, 230, 138, 0.55)');
    glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
    sCtx.fillStyle = glowGrad;
    sCtx.fillRect(0, 0, w, h);
  }

  // Volumetric procedural soft clouds for daytime/sunset/pastel/dusk skies
  if (preset !== 'night') {
    const cloudColor =
      preset === 'sunset'
        ? '255, 214, 170'
        : preset === 'dusk'
        ? '249, 168, 212'
        : preset === 'pastel'
        ? '255, 240, 245'
        : '255, 255, 255';
    for (let c = 0; c < 18; c++) {
      const cx = (((c * 37 + 19) % 100) / 100) * w;
      const cy = (0.08 + ((c * 23 + 7) % 42) / 100) * h;
      const rx = w * (0.12 + ((c * 13) % 14) / 100);
      const ry = rx * (0.28 + ((c * 7) % 12) / 100);
      const cg = sCtx.createRadialGradient(cx, cy, ry * 0.15, cx, cy, rx);
      const op = 0.14 + ((c * 11) % 18) / 100;
      cg.addColorStop(0, `rgba(${cloudColor}, ${op.toFixed(2)})`);
      cg.addColorStop(0.55, `rgba(${cloudColor}, ${(op * 0.55).toFixed(2)})`);
      cg.addColorStop(1, `rgba(${cloudColor}, 0)`);
      sCtx.save();
      sCtx.translate(cx, cy);
      sCtx.scale(1, ry / Math.max(1, rx));
      sCtx.translate(-cx, -cy);
      sCtx.fillStyle = cg;
      sCtx.fillRect(cx - rx, cy - rx, rx * 2, rx * 2);
      sCtx.restore();
    }
  }
  sCtx.restore();
}

function applyAiRelightInline(canvas: HTMLCanvasElement, p: AiRelightParams) {
  if (p.intensity <= 0) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  const w = canvas.width;
  const h = canvas.height;
  const rad = (p.angle * Math.PI) / 180;
  const lx = Math.cos(rad);
  const ly = Math.sin(rad);
  const str = (p.intensity / 100) * 0.52;
  const warmR = p.warmth >= 0 ? 1 + (p.warmth / 100) * 0.25 : 1 + (p.warmth / 100) * 0.15;
  const warmB = p.warmth >= 0 ? 1 - (p.warmth / 100) * 0.15 : 1 - (p.warmth / 100) * 0.25;
  const elevGain = 0.55 + (p.elevation / 90) * 0.45;

  for (let y = 0; y < h; y++) {
    const ny = (y / Math.max(1, h)) * 2 - 1;
    for (let x = 0; x < w; x++) {
      const nx = (x / Math.max(1, w)) * 2 - 1;
      const dot = nx * lx + ny * ly;
      const keyFactor = 1 + dot * str * elevGain;
      const i = (y * w + x) * 4;
      d[i] = clamp255(Math.round(d[i] * keyFactor * (dot > 0 ? warmR : 1)));
      d[i + 1] = clamp255(Math.round(d[i + 1] * keyFactor));
      d[i + 2] = clamp255(Math.round(d[i + 2] * keyFactor * (dot > 0 ? warmB : 1)));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

/**
 * Pure helper: Renders signature Instagram-style AI Lighting & Visual Effects onto RGBA pixel buffers.
 */
export function applyAiInstagramEffectBuffer(
  d: Uint8ClampedArray,
  w: number,
  h: number,
  p: AiInstagramEffectParams,
) {
  if (p.intensity <= 0) return;
  const str = clamp01(p.intensity / 100);
  const beamNorm = Math.max(0.12, p.beamSize / 100);
  const maxDim = Math.max(w, h);
  const cx = p.centerX * w;
  const cy = p.centerY * h;
  const warmFactor = p.warmth / 50; // -1..1
  const ambientDark = clamp01(p.ambientDarkness / 100);

  for (let y = 0; y < h; y++) {
    const yn = y / Math.max(1, h);
    for (let x = 0; x < w; x++) {
      const xn = x / Math.max(1, w);
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;

      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      const dx = x - cx;
      const dy = y - cy;
      const distNorm = Math.hypot(dx, dy) / Math.max(1, maxDim * beamNorm);

      if (p.effect === 'flashlight') {
        // Focused Instagram xenon spotlight beam + moody ambient shadow surround
        const beamCore = Math.exp(-distNorm * distNorm * 2.1);
        const edgeRim = Math.exp(-Math.pow(distNorm - 0.85, 2) * 8.0) * 0.18;
        const surroundDrop = (1 - Math.exp(-distNorm * distNorm * 1.45)) * ambientDark * 0.92 * str;

        const spotLift = 1 + str * (beamCore * 0.58 + edgeRim) - surroundDrop;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const xenonGlow = beamCore * str * (22 + lum * 28);

        r = r * spotLift + xenonGlow * (1 + warmFactor * 0.35);
        g = g * spotLift + xenonGlow * (0.98 + warmFactor * 0.12);
        b = b * spotLift + xenonGlow * (0.94 - warmFactor * 0.25);

        // Crisp midtone contrast boost inside beam
        if (beamCore > 0.25) {
          const cBoost = 1 + beamCore * str * 0.22;
          r = (r - 128) * cBoost + 128;
          g = (g - 128) * cBoost + 128;
          b = (b - 128) * cBoost + 128;
        }
      } else if (p.effect === 'disposable-flash') {
        // 90s direct on-camera flash: punchy hard falloff, crisp bright center, slight cool ambient roll-off
        const flashMask = clamp01(1 - Math.pow(distNorm * 0.92, 2.3));
        const edgeDrop = (1 - flashMask) * ambientDark * 0.68 * str;
        const flashGain = 1 + flashMask * 0.52 * str - edgeDrop;
        const flashAdd = Math.pow(flashMask, 1.8) * 26 * str;

        r = r * flashGain + flashAdd * (1 + warmFactor * 0.2);
        g = g * (flashGain + edgeDrop * 0.06) + flashAdd * 1.01;
        b = b * (flashGain + edgeDrop * 0.08) + flashAdd * (0.96 - warmFactor * 0.2);
      } else if (p.effect === 'golden-hour') {
        // Diagonal sunset ray passing through (cx, cy)
        const rayDist = Math.abs((x - cx) * 0.62 - (y - cy) * 0.78) / Math.max(1, maxDim * beamNorm * 0.9);
        const radial = Math.exp(-distNorm * distNorm * 0.85);
        const sunRay = clamp01(Math.exp(-rayDist * rayDist * 1.8) * 0.75 + radial * 0.45);
        const sunMix = sunRay * str;

        r = r * (1 + sunMix * 0.24) + sunMix * (52 + warmFactor * 16);
        g = g * (1 + sunMix * 0.12) + sunMix * (28 + warmFactor * 8);
        b = b * (1 - sunMix * 0.06) - sunMix * (14 - warmFactor * 12);
      } else if (p.effect === 'neon-gel') {
        // Dual studio gel split lighting: cyan left-top + magenta/violet right-bottom
        const leftGel = clamp01(1 - xn * 1.25 - yn * 0.35);
        const rightGel = clamp01(xn * 1.25 + yn * 0.35 - 0.55);
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const rim = (0.45 + lum * 0.75) * str;

        r = r * (1 - str * 0.12) + rightGel * rim * 125 + leftGel * rim * 12;
        g = g * (1 - str * 0.12) + leftGel * rim * 108 + rightGel * rim * 16;
        b = b * (1 - str * 0.08) + leftGel * rim * 135 + rightGel * rim * 118;
      } else if (p.effect === 'dreamy-aura') {
        // Soft ethereal highlight bloom + pastel rose/amber halo around focal point
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const halo = Math.exp(-distNorm * distNorm * 1.1);
        const glow = clamp01((lum - 0.35) * 1.5) * 0.55 + halo * 0.45;
        const lift = glow * str;

        r = r * (1 - lift * 0.12) + lift * (72 + warmFactor * 14);
        g = g * (1 - lift * 0.1) + lift * 58;
        b = b * (1 - lift * 0.08) + lift * (76 - warmFactor * 14);
      } else if (p.effect === 'prism') {
        // Crystal optical prism rainbow dispersion streaks centered near (cx, cy)
        const anglePhase = (x - cx) * 0.028 + (y - cy) * 0.022;
        const bandMask = Math.exp(-Math.pow((x - cx) * 0.45 - (y - cy) * 0.85, 2) / Math.max(200, maxDim * maxDim * beamNorm * 0.25));
        const spot = Math.exp(-distNorm * distNorm * 0.65);
        const pStrength = clamp01((bandMask * 0.8 + spot * 0.35)) * str;

        const pr = Math.max(0, Math.sin(anglePhase)) * 115;
        const pg = Math.max(0, Math.sin(anglePhase + 2.094)) * 105;
        const pb = Math.max(0, Math.sin(anglePhase + 4.188)) * 125;

        r = r + pr * pStrength;
        g = g + pg * pStrength;
        b = b + pb * pStrength;
      }

      d[i] = clamp255(Math.round(r));
      d[i + 1] = clamp255(Math.round(g));
      d[i + 2] = clamp255(Math.round(b));
    }
  }
}

function applyAiInstagramEffectInline(canvas: HTMLCanvasElement, p: AiInstagramEffectParams) {
  if (p.intensity <= 0) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyAiInstagramEffectBuffer(imgData.data, canvas.width, canvas.height, p);
  ctx.putImageData(imgData, 0, 0);
}

async function applyAiSkyReplacementInline(canvas: HTMLCanvasElement, p: AiSkyParams) {
  if (p.blend <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;

  let maskData: Uint8ClampedArray | null = null;
  if (p.maskDataUrl) {
    try {
      const mImg = await loadImageCached(p.maskDataUrl);
      const mc = getOrCreateCanvas(w, h);
      const mCtx = mc.getContext('2d', { willReadFrequently: true })!;
      mCtx.drawImage(mImg, 0, 0, w, h);
      maskData = mCtx.getImageData(0, 0, w, h).data;
    } catch {
      maskData = null;
    }
  }

  const skyCanvas = getOrCreateCanvas(w, h);
  const sCtx = skyCanvas.getContext('2d')!;
  drawRealisticAtmosphericSky(sCtx, w, h, p.skyPreset);
  const skyData = sCtx.getImageData(0, 0, w, h).data;

  const blendAmt = clamp01(p.blend / 100);
  const horiz = clamp01(p.horizonMatch / 100);

  // Sample average sky horizon tint for natural ground atmospheric bounce
  let avgSkyR = 0;
  let avgSkyG = 0;
  let avgSkyB = 0;
  const sampleRow = Math.floor(h * 0.45);
  for (let x = 0; x < w; x++) {
    const si = (sampleRow * w + x) * 4;
    avgSkyR += skyData[si];
    avgSkyG += skyData[si + 1];
    avgSkyB += skyData[si + 2];
  }
  avgSkyR /= Math.max(1, w);
  avgSkyG /= Math.max(1, w);
  avgSkyB /= Math.max(1, w);

  for (let y = 0; y < h; y++) {
    const yn = y / Math.max(1, h);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const m = maskData ? maskData[i] / 255 : clamp01(1 - yn * 1.6);
      const k = clamp01(m * blendAmt);
      if (k > 0.02) {
        // Blend sky crisp with subtle preservation of dramatic existing cloud texture when bright
        d[i] = clamp255(Math.round(d[i] * (1 - k) + skyData[i] * k));
        d[i + 1] = clamp255(Math.round(d[i + 1] * (1 - k) + skyData[i + 1] * k));
        d[i + 2] = clamp255(Math.round(d[i + 2] * (1 - k) + skyData[i + 2] * k));
      }
      // Atmospheric ground/horizon light match
      if (horiz > 0 && k < 0.85) {
        const haze = (1 - k) * horiz * 0.24 * clamp01(1.15 - yn);
        d[i] = clamp255(Math.round(d[i] * (1 - haze) + avgSkyR * haze));
        d[i + 1] = clamp255(Math.round(d[i + 1] * (1 - haze) + avgSkyG * haze));
        d[i + 2] = clamp255(Math.round(d[i + 2] * (1 - haze) + avgSkyB * haze));
      }
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyAiFaceReshapeInline(canvas: HTMLCanvasElement, p: AiFaceReshapeParams) {
  if (p.strength <= 0 || (p.slim === 0 && p.jawline === 0 && p.faceWidth === 0)) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const orig = ctx.getImageData(0, 0, w, h);
  const src = new Uint8ClampedArray(orig.data);
  const dst = orig.data;

  const cx = w * 0.5;
  const cy = h * 0.44;
  const radX = w * 0.24;
  const radY = h * 0.28;
  const str = clamp01(p.strength / 100);

  for (let y = 0; y < h; y++) {
    const dy = (y - cy) / radY;
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / radX;
      const r2 = dx * dx + dy * dy;
      if (r2 >= 1) continue;
      const falloff = Math.pow(1 - r2, 1.8) * str;
      // Jawline targets lower face ellipse
      const jawW = dy > 0.1 ? falloff : falloff * 0.25;
      const squeeze =
        (p.slim / 50) * 0.16 * falloff +
        (p.jawline / 50) * 0.14 * jawW -
        (p.faceWidth / 50) * 0.16 * falloff;
      const sx = Math.max(0, Math.min(w - 1, Math.round(x + (x - cx) * squeeze)));
      const sy = y;
      const dIdx = (y * w + x) * 4;
      const sIdx = (sy * w + sx) * 4;
      dst[dIdx] = src[sIdx];
      dst[dIdx + 1] = src[sIdx + 1];
      dst[dIdx + 2] = src[sIdx + 2];
    }
  }
  ctx.putImageData(orig, 0, 0);
}

function applyAiDenoiseInline(canvas: HTMLCanvasElement, p: AiDenoiseParams) {
  if (p.strength <= 0) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyDetailEffectsBuffer(imgData.data, canvas.width, canvas.height, {
    unsharpAmount: Math.round((p.detailPreserve / 100) * 35),
    unsharpRadius: 1,
    unsharpThreshold: 5,
    noiseLuma: Math.round(p.strength * 0.85),
    noiseChroma: Math.round(p.strength),
    texture: 0,
    bloomAmount: 0,
    bloomRadius: 8,
    chromaticAberration: 0,
    halation: 0,
    lightLeak: 0,
    lightLeakStyle: 'amber-left',
    dustScratches: 0,
    lensDistortion: 0,
    perspectiveX: 0,
    perspectiveY: 0,
  });
  ctx.putImageData(imgData, 0, 0);
}

function applyAiColorizeInline(canvas: HTMLCanvasElement, p: AiColorizeParams) {
  if (p.strength <= 0) return;
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const str = clamp01(p.strength / 100);
  const warmShift = (p.warmth / 50) * 18;

  for (let y = 0; y < h; y++) {
    const yn = y / Math.max(1, h);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255;
      // Contextual sky-cool top / natural foliage & skin mid / earthy shadow tinting
      const skyWeight = clamp01(1 - yn * 2.1) * clamp01((l - 0.32) * 2.2);
      const midWarmth = Math.sin(l * Math.PI);
      const targetR = d[i] + (midWarmth * 26 - skyWeight * 22 + warmShift) * str;
      const targetG = d[i + 1] + (midWarmth * 12 + (1 - skyWeight) * 6) * str;
      const targetB = d[i + 2] + (skyWeight * 36 - midWarmth * 14 - warmShift * 0.6) * str;
      d[i] = clamp255(Math.round(targetR));
      d[i + 1] = clamp255(Math.round(targetG));
      d[i + 2] = clamp255(Math.round(targetB));
    }
  }
  ctx.putImageData(imgData, 0, 0);
}

function applyAiFaceRestoreInline(canvas: HTMLCanvasElement, p: AiFaceRestoreParams) {
  if (p.strength <= 0) return;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  applyDetailEffectsBuffer(imgData.data, canvas.width, canvas.height, {
    unsharpAmount: Math.round((p.clarity / 100) * 75 + (p.strength / 100) * 35),
    unsharpRadius: 2,
    unsharpThreshold: 3,
    noiseLuma: Math.round(p.strength * 0.45),
    noiseChroma: Math.round(p.strength * 0.7),
    texture: Math.round((p.clarity / 100) * 28),
    bloomAmount: 0,
    bloomRadius: 6,
    chromaticAberration: 0,
    halation: 0,
    lightLeak: 0,
    lightLeakStyle: 'amber-left',
    dustScratches: 0,
    lensDistortion: 0,
    perspectiveX: 0,
    perspectiveY: 0,
  });
  ctx.putImageData(imgData, 0, 0);
}

function applyRetouchInline(
  canvas: HTMLCanvasElement,
  p: { skinSmooth: number; teethWhiten: number; eyeBrighten: number; blemishRemove: number },
) {
  const w = canvas.width;
  const h = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const orig = ctx.getImageData(0, 0, w, h);
  const d = orig.data;

  let smoothData: Uint8ClampedArray | null = null;
  if (p.skinSmooth > 0 || p.blemishRemove > 0) {
    const blurCanvas = getOrCreateCanvas(w, h);
    const bCtx = blurCanvas.getContext('2d', { willReadFrequently: true })!;
    const rad = Math.max(2, Math.round(Math.min(w, h) * 0.012));
    bCtx.filter = `blur(${rad}px)`;
    bCtx.drawImage(canvas, 0, 0);
    smoothData = bCtx.getImageData(0, 0, w, h).data;
  }

  const smoothAmt = (p.skinSmooth / 100) * 0.68;
  const blemishAmt = p.blemishRemove / 100;
  const teethAmt = p.teethWhiten / 100;
  const eyeAmt = p.eyeBrighten / 100;

  for (let y = 0; y < h; y++) {
    const yn = y / h;
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      let r = d[idx];
      let g = d[idx + 1];
      let b = d[idx + 2];

      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
      const isSkin = cb >= 77 && cb <= 127 && cr >= 133 && cr <= 175 && r > g && g > b * 0.8;

      if (smoothData && isSkin) {
        const sr = smoothData[idx];
        const sg = smoothData[idx + 1];
        const sb = smoothData[idx + 2];
        const edgeDiff = Math.abs(r - sr) + Math.abs(g - sg) + Math.abs(b - sb);

        if (smoothAmt > 0 && edgeDiff < 55) {
          const wSmooth = smoothAmt * (1 - edgeDiff / 60);
          r = r * (1 - wSmooth) + sr * wSmooth;
          g = g * (1 - wSmooth) + sg * wSmooth;
          b = b * (1 - wSmooth) + sb * wSmooth;
        }

        if (blemishAmt > 0 && (sr - r > 12 || sg - g > 12)) {
          const wb = clamp01(blemishAmt * 0.9);
          r = r * (1 - wb) + sr * wb;
          g = g * (1 - wb) + sg * wb;
          b = b * (1 - wb) + sb * wb;
        }
      }

      if (teethAmt > 0 && yn > 0.35 && yn < 0.85) {
        const lum = (r + g + b) / 3;
        const maxC = Math.max(r, g, b);
        const minC = Math.min(r, g, b);
        const sat = maxC > 0 ? (maxC - minC) / maxC : 0;
        if (lum > 145 && sat < 0.28 && r >= b) {
          const wt = teethAmt * 0.55 * clamp01((lum - 145) / 80);
          const target = Math.min(255, lum + 24 * wt);
          r = r * (1 - wt) + target * wt;
          g = g * (1 - wt) + target * wt;
          b = b * (1 - wt) + Math.min(255, target + 4) * wt;
        }
      }

      if (eyeAmt > 0 && yn > 0.2 && yn < 0.55) {
        const xn = x / w;
        if (xn > 0.25 && xn < 0.75) {
          const lum = (r + g + b) / 3;
          if (lum > 130 && Math.abs(r - b) < 35) {
            const lift = 1 + eyeAmt * 0.22;
            r *= lift;
            g *= lift;
            b *= lift * 1.03;
          }
        }
      }

      d[idx] = clamp255(Math.round(r));
      d[idx + 1] = clamp255(Math.round(g));
      d[idx + 2] = clamp255(Math.round(b));
    }
  }

  ctx.putImageData(orig, 0, 0);
}

/**
 * Renders the full non-destructive edit stack onto an HTMLCanvasElement
 * honoring layer masks, blend modes, per-layer opacity, groups, and all layer types.
 */
export async function renderEditStack(
  sourceSrc: string,
  layers: EditLayer[],
  options: { maxEdge?: number; showOriginal?: boolean; extraPresets?: FilterPreset[] } = {},
): Promise<{ canvas: HTMLCanvasElement; histogram: HistogramData }> {
  const { maxEdge = 0, showOriginal = false, extraPresets = [] } = options;
  const img = await loadImageCached(sourceSrc);

  const disabledGroupIds = new Set(
    layers.filter((l) => l.type === 'group' && !l.enabled).map((l) => l.id),
  );
  const activeLayers = showOriginal
    ? []
    : layers.filter((l) => l.enabled && (!l.groupId || !disabledGroupIds.has(l.groupId)));

  const cropLayer = activeLayers.find((l) => l.type === 'crop') as
    | Extract<EditLayer, { type: 'crop' }>
    | undefined;

  let canvas = renderCroppedBase(img, cropLayer ? cropLayer.params : null, maxEdge);
  const allPresets = getAllFilterPresets(extraPresets);

  for (const layer of activeLayers) {
    if (layer.type === 'crop' || layer.type === 'group') continue;

    const needsBlendOrMask =
      Boolean(layer.mask?.enabled) ||
      (layer.opacity !== undefined && layer.opacity < 100) ||
      (layer.blendMode !== undefined && layer.blendMode !== 'normal');

    const prevCanvas = needsBlendOrMask ? cloneCanvas(canvas) : null;

    if (layer.type === 'ai-outpaint' && layer.params.resultDataUrl) {
      try {
        const outImg = await loadImageCached(layer.params.resultDataUrl);
        canvas = renderCroppedBase(outImg, cropLayer ? cropLayer.params : null, maxEdge);
      } catch {
        // ignore
      }
      continue;
    }

    if (layer.type === 'ai-upscale' && layer.params.resultDataUrl) {
      try {
        const upImg = await loadImageCached(layer.params.resultDataUrl);
        const targetMax = maxEdge > 0 ? maxEdge : upImg.naturalWidth;
        canvas = renderCroppedBase(upImg, cropLayer ? cropLayer.params : null, targetMax);
      } catch {
        // Ignore invalid dataUrl
      }
      continue;
    }

    if (layer.type === 'ai-eraser' && layer.params.resultDataUrl) {
      try {
        const erImg = await loadImageCached(layer.params.resultDataUrl);
        canvas = renderCroppedBase(erImg, cropLayer ? cropLayer.params : null, maxEdge);
      } catch {
        // Ignore
      }
      continue;
    }

    if (layer.type === 'ai-style' && layer.params.resultDataUrl) {
      try {
        const stImg = await loadImageCached(layer.params.resultDataUrl);
        const strength = clamp01(layer.params.strength / 100);
        if (strength > 0) {
          const styled = renderCroppedBase(stImg, cropLayer ? cropLayer.params : null, maxEdge);
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.save();
          ctx.globalAlpha = strength;
          ctx.drawImage(styled, 0, 0, canvas.width, canvas.height);
          ctx.restore();
        }
      } catch {
        // Ignore
      }
    } else if (layer.type === 'ai-background' && layer.params.maskDataUrl) {
      try {
        const maskImg = await loadImageCached(layer.params.maskDataUrl);
        const w = canvas.width;
        const h = canvas.height;
        const maskCanvas = renderCroppedBase(maskImg, cropLayer ? cropLayer.params : null, maxEdge);
        const mCtx = maskCanvas.getContext('2d', { willReadFrequently: true })!;
        const mData = mCtx.getImageData(0, 0, w, h).data;

        const fgCanvas = getOrCreateCanvas(w, h);
        const fgCtx = fgCanvas.getContext('2d', { willReadFrequently: true })!;
        fgCtx.drawImage(canvas, 0, 0);
        const fgImgData = fgCtx.getImageData(0, 0, w, h);
        const fg = fgImgData.data;

        const thresh = (layer.params.threshold / 100) * 200 + 25;
        const feather = Math.max(1, layer.params.feather * 2.2);

        for (let i = 0; i < fg.length; i += 4) {
          const alphaVal = mData[i];
          const soft = clamp01((alphaVal - (thresh - feather)) / (feather * 2));
          fg[i + 3] = Math.round(fg[i + 3] * soft);
        }
        fgCtx.putImageData(fgImgData, 0, 0);

        const bgCtx = canvas.getContext('2d', { willReadFrequently: true })!;
        if (layer.params.mode === 'transparent') {
          bgCtx.clearRect(0, 0, w, h);
          bgCtx.drawImage(fgCanvas, 0, 0);
        } else if (layer.params.mode === 'solid') {
          bgCtx.fillStyle = layer.params.color;
          bgCtx.fillRect(0, 0, w, h);
          bgCtx.drawImage(fgCanvas, 0, 0);
        } else if (layer.params.mode === 'gradient') {
          const [c1, c2] = AI_BG_GRADIENTS[layer.params.gradientPreset] ?? AI_BG_GRADIENTS.sunset;
          const grad = bgCtx.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, c1);
          grad.addColorStop(1, c2);
          bgCtx.fillStyle = grad;
          bgCtx.fillRect(0, 0, w, h);
          bgCtx.drawImage(fgCanvas, 0, 0);
        } else if (layer.params.mode === 'blur') {
          const blurPx = Math.max(
            2,
            Math.round((layer.params.blurAmount / 100) * Math.min(w, h) * 0.04),
          );
          const tempBg = createBokehBlurredCanvas(
            canvas,
            blurPx,
            layer.params.bokehShape ?? 'circle',
          );
          bgCtx.clearRect(0, 0, w, h);
          bgCtx.drawImage(tempBg, 0, 0);
          bgCtx.drawImage(fgCanvas, 0, 0);
        }
      } catch {
        // Ignore
      }
    } else if (layer.type === 'ai-retouch') {
      const p = layer.params;
      if (p.skinSmooth > 0 || p.teethWhiten > 0 || p.eyeBrighten > 0 || p.blemishRemove > 0) {
        applyRetouchInline(canvas, p);
      }
    } else if (layer.type === 'ai-relight') {
      applyAiRelightInline(canvas, layer.params);
    } else if (layer.type === 'ai-ig-effect') {
      applyAiInstagramEffectInline(canvas, layer.params);
    } else if (layer.type === 'ai-sky') {
      await applyAiSkyReplacementInline(canvas, layer.params);
    } else if (layer.type === 'ai-face-reshape') {
      applyAiFaceReshapeInline(canvas, layer.params);
    } else if (layer.type === 'ai-denoise') {
      applyAiDenoiseInline(canvas, layer.params);
    } else if (layer.type === 'ai-colorize') {
      applyAiColorizeInline(canvas, layer.params);
    } else if (layer.type === 'ai-face-restore') {
      applyAiFaceRestoreInline(canvas, layer.params);
    } else if (layer.type === 'adjustments') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyAdjustmentsLayer(imgData, layer.params);
      ctx.putImageData(imgData, 0, 0);
    } else if (layer.type === 'tone-extended') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const [nr, ng, nb] = applyToneExtendedPixel(d[i], d[i + 1], d[i + 2], layer.params);
        d[i] = nr;
        d[i + 1] = ng;
        d[i + 2] = nb;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (layer.type === 'detail-effects') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      applyDetailEffectsBuffer(imgData.data, canvas.width, canvas.height, layer.params);
      const stackedFx = (layer.params.picsartFx ?? []).filter((fx) => fx.enabled && fx.intensity > 0);
      for (const fx of stackedFx) {
        applyOverlayEffectToPixels(imgData.data, canvas.width, canvas.height, fx.kind, fx.intensity);
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (layer.type === 'hsl') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        const [nr, ng, nb] = applyHslAndSplitTonePixel(d[i], d[i + 1], d[i + 2], layer.params);
        d[i] = nr;
        d[i + 1] = ng;
        d[i + 2] = nb;
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (layer.type === 'curves') {
      const luts = buildCompositeCurveLUTs(layer.params);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const d = imgData.data;
      for (let i = 0; i < d.length; i += 4) {
        if (d[i + 3] === 0) continue;
        d[i] = luts.r[d[i]];
        d[i + 1] = luts.g[d[i + 1]];
        d[i + 2] = luts.b[d[i + 2]];
      }
      ctx.putImageData(imgData, 0, 0);
    } else if (layer.type === 'filter') {
      const preset = allPresets.find((p) => p.id === layer.params.presetId);
      if (preset && layer.params.intensity > 0) {
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const d = imgData.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] === 0) continue;
          const [nr, ng, nb] = applyFilterPresetPixel(
            d[i],
            d[i + 1],
            d[i + 2],
            preset,
            layer.params.intensity,
          );
          d[i] = nr;
          d[i + 1] = ng;
          d[i + 2] = nb;
        }
        if (preset.adjustments.grain || preset.adjustments.vignette) {
          applyGrainAndVignette(
            d,
            canvas.width,
            canvas.height,
            (preset.adjustments.grain ?? 0) * (layer.params.intensity / 100),
            (preset.adjustments.vignette ?? 0) * (layer.params.intensity / 100),
          );
        }
        ctx.putImageData(imgData, 0, 0);
      }
    } else if (layer.type === 'blur') {
      applyBlurLayer(canvas, layer.params);
    } else if (layer.type === 'draw') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      const w = canvas.width;
      const h = canvas.height;
      const minDim = Math.min(w, h);
      for (const stroke of layer.params.strokes) {
        if (stroke.points.length === 0) continue;
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        const lineW = Math.max(1, stroke.size * minDim);
        ctx.lineWidth = lineW;
        if (stroke.tool === 'eraser') {
          ctx.globalCompositeOperation = 'destination-out';
          ctx.globalAlpha = stroke.opacity;
          ctx.strokeStyle = 'rgba(0,0,0,1)';
        } else {
          ctx.globalAlpha = stroke.opacity;
          ctx.strokeStyle = stroke.color;
          if (stroke.neon) {
            ctx.shadowColor = stroke.color;
            ctx.shadowBlur = Math.max(6, lineW * 1.45);
          }
        }
        ctx.beginPath();
        ctx.moveTo(stroke.points[0].x * w, stroke.points[0].y * h);
        for (let i = 1; i < stroke.points.length; i++) {
          ctx.lineTo(stroke.points[i].x * w, stroke.points[i].y * h);
        }
        if (stroke.points.length === 1) {
          ctx.lineTo(stroke.points[0].x * w + 0.01, stroke.points[0].y * h);
        }
        ctx.stroke();

        // Crisp glowing inner core for Neon & Glow Brush
        if (stroke.tool === 'brush' && stroke.neon) {
          ctx.shadowBlur = Math.max(3, lineW * 0.45);
          ctx.shadowColor = '#FFFFFF';
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = Math.max(1, lineW * 0.42);
          ctx.stroke();
        }
        ctx.restore();
      }
    } else if (layer.type === 'image') {
      const overlayCanvas = await renderIsolatedOverlayLayer(canvas.width, canvas.height, layer.params);
      if (overlayCanvas) {
        if (needsBlendOrMask && prevCanvas) {
          let aiMaskData: Uint8ClampedArray | null = null;
          if (layer.mask?.aiMaskDataUrl) {
            try {
              const mImg = await loadImageCached(layer.mask.aiMaskDataUrl);
              const mc = getOrCreateCanvas(canvas.width, canvas.height);
              const mCtx = mc.getContext('2d', { willReadFrequently: true })!;
              mCtx.drawImage(mImg, 0, 0, canvas.width, canvas.height);
              aiMaskData = mCtx.getImageData(0, 0, canvas.width, canvas.height).data;
            } catch {
              aiMaskData = null;
            }
          }
          canvas = compositeLayerOutput(prevCanvas, overlayCanvas, {
            mask: layer.mask,
            opacity: layer.opacity,
            blendMode: layer.blendMode,
            aiMaskData,
          });
        } else {
          const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(overlayCanvas, 0, 0);
        }
      }
      continue;
    } else if (layer.type === 'shape') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      drawShapeLayer(ctx, canvas.width, canvas.height, layer.params);
    } else if (layer.type === 'sticker') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      await drawStickerLayer(ctx, canvas.width, canvas.height, layer.params);
    } else if (layer.type === 'text') {
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      drawTextLayer(ctx, canvas.width, canvas.height, layer.params);
    } else if (layer.type === 'frame') {
      canvas = applyFrame(canvas, layer.params);
      continue;
    }

    if (prevCanvas && needsBlendOrMask) {
      let aiMaskData: Uint8ClampedArray | null = null;
      if (layer.mask?.aiMaskDataUrl) {
        try {
          const mImg = await loadImageCached(layer.mask.aiMaskDataUrl);
          const mc = getOrCreateCanvas(canvas.width, canvas.height);
          const mCtx = mc.getContext('2d', { willReadFrequently: true })!;
          mCtx.drawImage(mImg, 0, 0, canvas.width, canvas.height);
          aiMaskData = mCtx.getImageData(0, 0, canvas.width, canvas.height).data;
        } catch {
          aiMaskData = null;
        }
      }
      canvas = compositeLayerOutput(prevCanvas, canvas, {
        mask: layer.mask,
        opacity: layer.opacity,
        blendMode: layer.blendMode,
        aiMaskData,
      });
    }
  }

  const histogram = computeHistogram(canvas);
  return { canvas, histogram };
}

export function computeHistogram(canvas: HTMLCanvasElement): HistogramData {
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  const w = canvas.width;
  const h = canvas.height;
  const data = ctx.getImageData(0, 0, w, h).data;
  const r = new Array<number>(256).fill(0);
  const g = new Array<number>(256).fill(0);
  const b = new Array<number>(256).fill(0);
  const luma = new Array<number>(256).fill(0);

  const stride = Math.max(1, Math.floor((w * h) / 60000));
  for (let i = 0; i < data.length; i += 4 * stride) {
    if (data[i + 3] < 16) continue;
    const rv = data[i];
    const gv = data[i + 1];
    const bv = data[i + 2];
    const lv = Math.min(255, Math.round(0.299 * rv + 0.587 * gv + 0.114 * bv));
    r[rv]++;
    g[gv]++;
    b[bv]++;
    luma[lv]++;
  }

  let maxCount = 1;
  for (let i = 4; i < 252; i++) {
    if (r[i] > maxCount) maxCount = r[i];
    if (g[i] > maxCount) maxCount = g[i];
    if (b[i] > maxCount) maxCount = b[i];
    if (luma[i] > maxCount) maxCount = luma[i];
  }

  return { r, g, b, luma, maxCount };
}

/**
 * Generates live thumbnail data URLs for all presets using the user's actual photo.
 */
export async function generatePresetThumbnails(
  sourceSrc: string,
  presets: FilterPreset[],
  size = 88,
): Promise<Record<string, string>> {
  const img = await loadImageCached(sourceSrc);
  const base = renderCroppedBase(img, null, size);
  const baseCtx = base.getContext('2d', { willReadFrequently: true })!;
  const baseData = baseCtx.getImageData(0, 0, base.width, base.height);
  const workCanvas = getOrCreateCanvas(base.width, base.height);
  const workCtx = workCanvas.getContext('2d', { willReadFrequently: true })!;

  const result: Record<string, string> = {};
  for (const preset of presets) {
    const outData = new ImageData(
      new Uint8ClampedArray(baseData.data),
      base.width,
      base.height,
    );
    const d = outData.data;
    for (let i = 0; i < d.length; i += 4) {
      const [nr, ng, nb] = applyFilterPresetPixel(d[i], d[i + 1], d[i + 2], preset, 100);
      d[i] = nr;
      d[i + 1] = ng;
      d[i + 2] = nb;
    }
    workCtx.putImageData(outData, 0, 0);
    result[preset.id] = workCanvas.toDataURL('image/jpeg', 0.82);
  }
  return result;
}
