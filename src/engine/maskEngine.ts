import type { BlendMode, LayerMask } from '../types/editor';
import { clamp01, clamp255 } from './colorMath';

function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    const r = parseInt(clean[0] + clean[0], 16) || 0;
    const g = parseInt(clean[1] + clean[1], 16) || 0;
    const b = parseInt(clean[2] + clean[2], 16) || 0;
    return [r, g, b];
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  return [r, g, b];
}

function blurFloatAlpha(alpha: Float32Array, w: number, h: number, radiusPx: number): Float32Array {
  const rad = Math.max(1, Math.min(18, Math.round(radiusPx)));
  const temp = new Float32Array(alpha.length);
  const out = new Float32Array(alpha.length);
  const win = rad * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sum = 0;
    for (let kx = -rad; kx <= rad; kx++) {
      const xx = Math.max(0, Math.min(w - 1, kx));
      sum += alpha[y * w + xx];
    }
    for (let x = 0; x < w; x++) {
      temp[y * w + x] = sum / win;
      const xOut = Math.max(0, x - rad);
      const xIn = Math.min(w - 1, x + rad + 1);
      sum += alpha[y * w + xIn] - alpha[y * w + xOut];
    }
  }

  for (let x = 0; x < w; x++) {
    let sum = 0;
    for (let ky = -rad; ky <= rad; ky++) {
      const yy = Math.max(0, Math.min(h - 1, ky));
      sum += temp[yy * w + x];
    }
    for (let y = 0; y < h; y++) {
      out[y * w + x] = sum / win;
      const yOut = Math.max(0, y - rad);
      const yIn = Math.min(h - 1, y + rad + 1);
      sum += temp[yIn * w + x] - temp[yOut * w + x];
    }
  }

  return out;
}

/**
 * Pure BFS Magic Wand region selection (works both in Browser and Node unit tests).
 */
export function floodFillMagicWandMask(
  srcData: Uint8ClampedArray,
  w: number,
  h: number,
  seedXNorm: number,
  seedYNorm: number,
  tolerance = 32,
  contiguous = true,
): Float32Array {
  const alpha = new Float32Array(w * h);
  if (w < 1 || h < 1) return alpha;

  const sx = Math.max(0, Math.min(w - 1, Math.round(seedXNorm * (w - 1))));
  const sy = Math.max(0, Math.min(h - 1, Math.round(seedYNorm * (h - 1))));
  const si = (sy * w + sx) * 4;
  const sr = srcData[si];
  const sg = srcData[si + 1];
  const sb = srcData[si + 2];

  const maxDist = Math.max(6, (tolerance / 100) * 235 + 10);
  const softSpan = Math.max(8, maxDist * 0.25);

  if (!contiguous) {
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const dist = Math.hypot(srcData[idx] - sr, srcData[idx + 1] - sg, srcData[idx + 2] - sb);
      if (dist <= maxDist) {
        alpha[i] = 1;
      } else if (dist <= maxDist + softSpan) {
        alpha[i] = clamp01(1 - (dist - maxDist) / softSpan);
      }
    }
    return alpha;
  }

  const visited = new Uint8Array(w * h);
  const queue = new Int32Array(w * h);
  let head = 0;
  let tail = 0;
  const startIdx = sy * w + sx;
  visited[startIdx] = 1;
  alpha[startIdx] = 1;
  queue[tail++] = startIdx;

  while (head < tail) {
    const cur = queue[head++];
    const cx = cur % w;
    const cy = (cur - cx) / w;

    const neighbors = [
      cx > 0 ? cur - 1 : -1,
      cx < w - 1 ? cur + 1 : -1,
      cy > 0 ? cur - w : -1,
      cy < h - 1 ? cur + w : -1,
    ];

    for (let n = 0; n < 4; n++) {
      const ni = neighbors[n];
      if (ni < 0 || visited[ni]) continue;
      visited[ni] = 1;
      const pIdx = ni * 4;
      const dist = Math.hypot(srcData[pIdx] - sr, srcData[pIdx + 1] - sg, srcData[pIdx + 2] - sb);
      if (dist <= maxDist) {
        alpha[ni] = 1;
        queue[tail++] = ni;
      } else if (dist <= maxDist + softSpan) {
        alpha[ni] = clamp01(1 - (dist - maxDist) / softSpan);
      }
    }
  }

  return alpha;
}

/**
 * Pure ray-casting point-in-polygon rasterizer for Lasso and Polygon selections.
 */
export function rasterizePolygonMask(
  points: Array<{ x: number; y: number }>,
  w: number,
  h: number,
): Float32Array {
  const alpha = new Float32Array(w * h);
  if (points.length < 3 || w < 1 || h < 1) return alpha;

  const pxPts = points.map((p) => ({ x: p.x * w, y: p.y * h }));
  let minX = w;
  let minY = h;
  let maxX = 0;
  let maxY = 0;
  for (const pt of pxPts) {
    if (pt.x < minX) minX = pt.x;
    if (pt.y < minY) minY = pt.y;
    if (pt.x > maxX) maxX = pt.x;
    if (pt.y > maxY) maxY = pt.y;
  }

  const x0 = Math.max(0, Math.floor(minX));
  const y0 = Math.max(0, Math.floor(minY));
  const x1 = Math.min(w - 1, Math.ceil(maxX));
  const y1 = Math.min(h - 1, Math.ceil(maxY));

  for (let y = y0; y <= y1; y++) {
    const py = y + 0.5;
    for (let x = x0; x <= x1; x++) {
      const px = x + 0.5;
      let inside = false;
      for (let i = 0, j = pxPts.length - 1; i < pxPts.length; j = i++) {
        const xi = pxPts[i].x;
        const yi = pxPts[i].y;
        const xj = pxPts[j].x;
        const yj = pxPts[j].y;
        const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi;
        if (intersect) inside = !inside;
      }
      if (inside) alpha[y * w + x] = 1;
    }
  }
  return alpha;
}

/**
 * Morphological dilation (expand > 0) or erosion (expand < 0) on normalized alpha mask.
 */
export function expandContractAlpha(
  alpha: Float32Array,
  w: number,
  h: number,
  expandPx: number,
): Float32Array {
  const steps = Math.min(24, Math.abs(Math.round(expandPx)));
  if (steps === 0) return alpha;
  const dilate = expandPx > 0;
  let cur = new Float32Array(alpha);
  let next = new Float32Array(alpha.length);

  for (let s = 0; s < steps; s++) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        let best = cur[idx];
        if (x > 0) best = dilate ? Math.max(best, cur[idx - 1]) : Math.min(best, cur[idx - 1]);
        if (x < w - 1) best = dilate ? Math.max(best, cur[idx + 1]) : Math.min(best, cur[idx + 1]);
        if (y > 0) best = dilate ? Math.max(best, cur[idx - w]) : Math.min(best, cur[idx - w]);
        if (y < h - 1) best = dilate ? Math.max(best, cur[idx + w]) : Math.min(best, cur[idx + w]);
        next[idx] = best;
      }
    }
    const tmp = cur;
    cur = next;
    next = tmp;
  }
  return cur;
}

/**
 * Evaluates any LayerMask into a normalized Float32Array (0..1 per pixel)
 * matching (w, h), honoring expand, feather, refineEdge, and inverted.
 */
export function evaluateMaskAlpha(
  mask: LayerMask,
  srcData: Uint8ClampedArray,
  w: number,
  h: number,
  aiMaskData?: Uint8ClampedArray | null,
): Float32Array {
  let alpha: Float32Array = new Float32Array(w * h);

  if (mask.kind === 'brush') {
    if (typeof document !== 'undefined') {
      const mc = document.createElement('canvas');
      mc.width = w;
      mc.height = h;
      const mCtx = mc.getContext('2d', { willReadFrequently: true });
      if (mCtx) {
        mCtx.clearRect(0, 0, w, h);
        const minDim = Math.min(w, h);
        for (const st of mask.brushStrokes ?? []) {
          if (st.points.length === 0) continue;
          const rPx = Math.max(2, st.size * minDim);
          const hardness = clamp01((st.hardness ?? 70) / 100);
          mCtx.save();
          mCtx.globalCompositeOperation = st.tool === 'erase' ? 'destination-out' : 'source-over';
          mCtx.globalAlpha = clamp01((st.opacity ?? 100) / 100);
          if (hardness < 0.95) {
            mCtx.shadowColor = 'rgba(255,255,255,1)';
            mCtx.shadowBlur = rPx * (1 - hardness) * 0.65;
          }
          mCtx.strokeStyle = '#FFFFFF';
          mCtx.lineWidth = rPx;
          mCtx.lineCap = 'round';
          mCtx.lineJoin = 'round';
          mCtx.beginPath();
          mCtx.moveTo(st.points[0].x * w, st.points[0].y * h);
          for (let i = 1; i < st.points.length; i++) {
            mCtx.lineTo(st.points[i].x * w, st.points[i].y * h);
          }
          if (st.points.length === 1) {
            mCtx.lineTo(st.points[0].x * w + 0.1, st.points[0].y * h);
          }
          mCtx.stroke();
          mCtx.restore();
        }
        const mPixels = mCtx.getImageData(0, 0, w, h).data;
        for (let i = 0; i < w * h; i++) {
          alpha[i] = mPixels[i * 4 + 3] / 255;
        }
      }
    }
  } else if (mask.kind === 'linear') {
    const g = mask.gradient ?? { x1: 0.5, y1: 0.15, x2: 0.5, y2: 0.85, radius: 0.35 };
    const dx = (g.x2 - g.x1) * w;
    const dy = (g.y2 - g.y1) * h;
    const lenSq = Math.max(1, dx * dx + dy * dy);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const px = x - g.x1 * w;
        const py = y - g.y1 * h;
        const proj = clamp01((px * dx + py * dy) / lenSq);
        alpha[y * w + x] = 1 - proj;
      }
    }
  } else if (mask.kind === 'radial') {
    const g = mask.gradient ?? { x1: 0.5, y1: 0.5, x2: 0.5, y2: 0.85, radius: 0.36 };
    const cx = g.x1 * w;
    const cy = g.y1 * h;
    const maxR = Math.max(8, g.radius * Math.min(w, h));
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dist = Math.hypot(x - cx, y - cy);
        alpha[y * w + x] = clamp01(1 - Math.pow(dist / maxR, 1.5));
      }
    }
  } else if (mask.kind === 'luminosity') {
    const lum = mask.luminosity ?? { min: 100, max: 255, softness: 40 };
    const soft = Math.max(2, lum.softness);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const yVal = 0.299 * srcData[idx] + 0.587 * srcData[idx + 1] + 0.114 * srcData[idx + 2];
      const low = clamp01((yVal - (lum.min - soft)) / soft);
      const high = clamp01(((lum.max + soft) - yVal) / soft);
      alpha[i] = Math.min(low, high);
    }
  } else if (mask.kind === 'color-range') {
    const cr = mask.colorRange ?? { hex: '#3B82F6', tolerance: 35, softness: 20 };
    const [tr, tg, tb] = hexToRgbTuple(cr.hex);
    const maxDist = (cr.tolerance / 100) * 260 + 8;
    const soft = Math.max(4, (cr.softness / 100) * 140);
    for (let i = 0; i < w * h; i++) {
      const idx = i * 4;
      const dr = srcData[idx] - tr;
      const dg = srcData[idx + 1] - tg;
      const db = srcData[idx + 2] - tb;
      const dist = Math.sqrt(dr * dr + dg * dg + db * db);
      alpha[i] = clamp01(1 - (dist - maxDist) / soft);
    }
  } else if (mask.kind === 'magic-wand') {
    const wand = mask.wand ?? { seedX: 0.5, seedY: 0.5, tolerance: 32, contiguous: true };
    alpha = floodFillMagicWandMask(
      srcData,
      w,
      h,
      wand.seedX,
      wand.seedY,
      wand.tolerance,
      wand.contiguous,
    );
  } else if (mask.kind === 'lasso' || mask.kind === 'polygon') {
    alpha = rasterizePolygonMask(mask.polygonPoints ?? [], w, h);
  } else if (mask.kind === 'ai-subject' || mask.kind === 'ai-sky') {
    if (aiMaskData && aiMaskData.length >= w * h * 4) {
      for (let i = 0; i < w * h; i++) {
        alpha[i] = aiMaskData[i * 4] / 255;
      }
    } else {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (mask.kind === 'ai-sky') {
            alpha[y * w + x] = clamp01(1 - y / (h * 0.58));
          } else {
            const dx = (x - w * 0.5) / (w * 0.36);
            const dy = (y - h * 0.48) / (h * 0.42);
            alpha[y * w + x] = clamp01(1 - Math.hypot(dx, dy) * 0.7);
          }
        }
      }
    }
  }

  // Expand / Contract morphological edge offset
  if (mask.expand && Math.abs(mask.expand) >= 1) {
    const scaledExpand = Math.round((mask.expand / 30) * Math.max(1, Math.min(w, h) * 0.035));
    if (scaledExpand !== 0) {
      alpha = expandContractAlpha(alpha, w, h, scaledExpand);
    }
  }

  // Refine Edge: expand/contract transition threshold around 0.5
  if (mask.refineEdge !== 0) {
    const shift = (mask.refineEdge / 50) * 0.32;
    const slope = mask.refineEdge > 0 ? 1 + (mask.refineEdge / 50) * 1.4 : 1;
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = clamp01((alpha[i] + shift - 0.5) * slope + 0.5);
    }
  }

  // Feather mask blur
  if (mask.feather > 0) {
    const featherPx = Math.max(1, (mask.feather / 50) * Math.min(w, h) * 0.035);
    alpha = blurFloatAlpha(alpha, w, h, featherPx);
  }

  if (mask.inverted) {
    for (let i = 0; i < alpha.length; i++) {
      alpha[i] = 1 - alpha[i];
    }
  }

  return alpha;
}

/**
 * Extracts pixels inside a LayerMask selection from the rendered canvas into
 * a tight-bounded transparent PNG dataUrl ready to paste as a new Image overlay layer.
 */
export function extractSelectionAsNewOverlay(
  renderedCanvas: HTMLCanvasElement,
  mask: LayerMask,
): {
  dataUrl: string;
  x: number;
  y: number;
  scale: number;
  aspectRatio: number;
} | null {
  const w = renderedCanvas.width;
  const h = renderedCanvas.height;
  const ctx = renderedCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || w < 2 || h < 2) return null;

  const srcData = ctx.getImageData(0, 0, w, h);
  const alpha = evaluateMaskAlpha(mask, srcData.data, w, h);

  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] > 0.05) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const cropW = Math.max(2, maxX - minX + 1);
  const cropH = Math.max(2, maxY - minY + 1);
  const out = document.createElement('canvas');
  out.width = cropW;
  out.height = cropH;
  const oCtx = out.getContext('2d', { willReadFrequently: true })!;
  const outImg = oCtx.createImageData(cropW, cropH);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const si = ((minY + y) * w + (minX + x)) * 4;
      const di = (y * cropW + x) * 4;
      const aMask = alpha[(minY + y) * w + (minX + x)];
      outImg.data[di] = srcData.data[si];
      outImg.data[di + 1] = srcData.data[si + 1];
      outImg.data[di + 2] = srcData.data[si + 2];
      outImg.data[di + 3] = clamp255(Math.round(srcData.data[si + 3] * aMask));
    }
  }
  oCtx.putImageData(outImg, 0, 0);

  const aspectRatio = cropW / cropH;
  const fitRef = aspectRatio >= 1 ? cropW : cropH;
  const scale = Number(Math.max(0.15, Math.min(2.2, fitRef / (Math.min(w, h) * 0.55))).toFixed(3));
  const centerX = (minX + cropW / 2) / w;
  const centerY = (minY + cropH / 2) / h;

  return {
    dataUrl: out.toDataURL('image/png'),
    x: Math.max(0.05, Math.min(0.95, centerX)),
    y: Math.max(0.05, Math.min(0.95, centerY)),
    scale,
    aspectRatio,
  };
}

/**
 * Composites editedCanvas over baseCanvas honoring optional LayerMask, opacity (0..100), and BlendMode.
 */
export function compositeLayerOutput(
  baseCanvas: HTMLCanvasElement,
  editedCanvas: HTMLCanvasElement,
  options: {
    mask?: LayerMask;
    opacity?: number;
    blendMode?: BlendMode;
    aiMaskData?: Uint8ClampedArray | null;
  },
): HTMLCanvasElement {
  const { mask, opacity = 100, blendMode = 'normal', aiMaskData } = options;
  const w = editedCanvas.width;
  const h = editedCanvas.height;
  const alphaOpacity = clamp01(opacity / 100);

  if (!mask?.enabled && alphaOpacity >= 0.999 && blendMode === 'normal') {
    return editedCanvas;
  }

  const layerCanvas = document.createElement('canvas');
  layerCanvas.width = w;
  layerCanvas.height = h;
  const lCtx = layerCanvas.getContext('2d', { willReadFrequently: true })!;
  lCtx.drawImage(editedCanvas, 0, 0, w, h);

  if (mask && mask.enabled) {
    const bCtx = baseCanvas.getContext('2d', { willReadFrequently: true })!;
    const baseData = bCtx.getImageData(0, 0, Math.min(w, baseCanvas.width), Math.min(h, baseCanvas.height));
    const edData = lCtx.getImageData(0, 0, w, h);
    const alpha = evaluateMaskAlpha(mask, baseData.data, w, h, aiMaskData);
    const ed = edData.data;
    for (let i = 0; i < w * h; i++) {
      ed[i * 4 + 3] = clamp255(Math.round(ed[i * 4 + 3] * alpha[i]));
    }
    lCtx.putImageData(edData, 0, 0);
  }

  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const oCtx = out.getContext('2d', { willReadFrequently: true })!;
  oCtx.drawImage(baseCanvas, 0, 0, w, h);

  oCtx.save();
  oCtx.globalAlpha = alphaOpacity;
  oCtx.globalCompositeOperation =
    blendMode === 'normal' ? 'source-over' : (blendMode as GlobalCompositeOperation);
  oCtx.drawImage(layerCanvas, 0, 0, w, h);
  oCtx.restore();
  return out;
}
