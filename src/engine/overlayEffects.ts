import type {
  ImageLayerParams,
  OverlayBorderParams,
  OverlayCutoutShape,
  OverlayEffectCategory,
  OverlayEffectItem,
  OverlayEffectKind,
} from '../types/editor';
import { clamp01, clamp255, hslToRgb, rgbToHsl } from './colorMath';

export interface OverlayEffectDefinition {
  kind: OverlayEffectKind;
  label: string;
  category: OverlayEffectCategory;
  defaultIntensity: number;
}

export const OVERLAY_EFFECT_CATEGORIES: Array<{
  id: OverlayEffectCategory | 'all';
  label: string;
}> = [
  { id: 'all', label: 'All' },
  { id: 'blur', label: 'Blur' },
  { id: 'artistic', label: 'Artistic' },
  { id: 'retro', label: 'Retro' },
  { id: 'distort', label: 'Distort' },
  { id: 'light', label: 'Light' },
  { id: 'color', label: 'Colour' },
  { id: 'texture', label: 'Texture' },
  { id: 'face', label: 'Face' },
  { id: 'body', label: 'Body' },
  { id: 'cutout', label: 'BG Removal' },
];

export const OVERLAY_EFFECT_CATALOG: OverlayEffectDefinition[] = [
  // Blur
  { kind: 'blur', label: 'Blur', category: 'blur', defaultIntensity: 50 },
  { kind: 'motion-blur', label: 'Motion Blur', category: 'blur', defaultIntensity: 55 },
  { kind: 'radial-blur', label: 'Radial Blur', category: 'blur', defaultIntensity: 55 },
  { kind: 'zoom-blur', label: 'Zoom Blur', category: 'blur', defaultIntensity: 60 },
  { kind: 'tilt-shift', label: 'Tilt-Shift', category: 'blur', defaultIntensity: 65 },
  { kind: 'bokeh', label: 'Bokeh', category: 'blur', defaultIntensity: 65 },

  // Artistic
  { kind: 'oil-paint', label: 'Oil Paint', category: 'artistic', defaultIntensity: 65 },
  { kind: 'watercolor', label: 'Watercolour', category: 'artistic', defaultIntensity: 70 },
  { kind: 'sketch', label: 'Sketch', category: 'artistic', defaultIntensity: 75 },
  { kind: 'pencil', label: 'Pencil', category: 'artistic', defaultIntensity: 75 },
  { kind: 'cartoon', label: 'Cartoon', category: 'artistic', defaultIntensity: 70 },
  { kind: 'comic', label: 'Comic', category: 'artistic', defaultIntensity: 75 },
  { kind: 'pop-art', label: 'Pop Art', category: 'artistic', defaultIntensity: 80 },
  { kind: 'pointillism', label: 'Pointillism', category: 'artistic', defaultIntensity: 70 },
  { kind: 'mosaic', label: 'Mosaic', category: 'artistic', defaultIntensity: 55 },
  { kind: 'stained-glass', label: 'Stained Glass', category: 'artistic', defaultIntensity: 70 },
  { kind: 'sharpen', label: 'Sharpen', category: 'artistic', defaultIntensity: 60 },

  // Retro
  { kind: 'film-grain', label: 'Film Grain', category: 'retro', defaultIntensity: 55 },
  { kind: 'light-leak', label: 'Light Leak', category: 'retro', defaultIntensity: 65 },
  { kind: 'dust', label: 'Dust & Scratches', category: 'retro', defaultIntensity: 55 },
  { kind: 'halftone', label: 'Halftone', category: 'retro', defaultIntensity: 65 },
  { kind: 'vhs', label: 'VHS', category: 'retro', defaultIntensity: 68 },
  { kind: 'lomo', label: 'Lomo', category: 'retro', defaultIntensity: 72 },
  { kind: 'vintage-fade', label: 'Vintage Fade', category: 'retro', defaultIntensity: 65 },

  // Distort
  { kind: 'fisheye', label: 'Fisheye', category: 'distort', defaultIntensity: 60 },
  { kind: 'mirror', label: 'Mirror', category: 'distort', defaultIntensity: 100 },
  { kind: 'kaleidoscope', label: 'Kaleidoscope', category: 'distort', defaultIntensity: 75 },
  { kind: 'twirl', label: 'Twirl', category: 'distort', defaultIntensity: 55 },
  { kind: 'bulge', label: 'Bulge', category: 'distort', defaultIntensity: 60 },
  { kind: 'pinch', label: 'Pinch', category: 'distort', defaultIntensity: 60 },
  { kind: 'ripple', label: 'Ripple', category: 'distort', defaultIntensity: 55 },
  { kind: 'glitch', label: 'Glitch', category: 'distort', defaultIntensity: 65 },
  { kind: 'pixelate', label: 'Pixelate', category: 'distort', defaultIntensity: 48 },
  { kind: 'rgb-split', label: 'RGB Split', category: 'distort', defaultIntensity: 60 },
  { kind: 'scanlines', label: 'Scanlines', category: 'distort', defaultIntensity: 60 },

  // Light
  { kind: 'glow', label: 'Glow', category: 'light', defaultIntensity: 65 },
  { kind: 'bloom', label: 'Bloom', category: 'light', defaultIntensity: 68 },
  { kind: 'neon', label: 'Neon', category: 'light', defaultIntensity: 75 },
  { kind: 'neon-outline', label: 'Neon Outline', category: 'light', defaultIntensity: 75 },
  { kind: 'sun-flare', label: 'Sun Flare', category: 'light', defaultIntensity: 70 },
  { kind: 'lens-flare', label: 'Lens Flare', category: 'light', defaultIntensity: 70 },
  { kind: 'rainbow', label: 'Rainbow', category: 'light', defaultIntensity: 62 },
  { kind: 'spotlight', label: 'Spotlight', category: 'light', defaultIntensity: 72 },
  { kind: 'drop-shadow', label: 'Drop Shadow', category: 'light', defaultIntensity: 70 },
  { kind: 'inner-shadow', label: 'Inner Shadow', category: 'light', defaultIntensity: 65 },
  { kind: 'vignette', label: 'Vignette', category: 'light', defaultIntensity: 65 },

  // Colour
  { kind: 'duotone', label: 'Duotone', category: 'color', defaultIntensity: 80 },
  { kind: 'posterize', label: 'Posterize', category: 'color', defaultIntensity: 65 },
  { kind: 'solarize', label: 'Solarize', category: 'color', defaultIntensity: 65 },
  { kind: 'thermal', label: 'Thermal', category: 'color', defaultIntensity: 85 },
  { kind: 'gradient-map', label: 'Gradient Map', category: 'color', defaultIntensity: 78 },
  { kind: 'invert', label: 'Invert', category: 'color', defaultIntensity: 100 },

  // Texture
  { kind: 'paper', label: 'Paper', category: 'texture', defaultIntensity: 60 },
  { kind: 'canvas', label: 'Canvas', category: 'texture', defaultIntensity: 60 },
  { kind: 'grunge', label: 'Grunge', category: 'texture', defaultIntensity: 62 },
  { kind: 'bokeh-overlay', label: 'Bokeh Overlay', category: 'texture', defaultIntensity: 65 },
  { kind: 'snow', label: 'Snow', category: 'texture', defaultIntensity: 65 },
  { kind: 'rain', label: 'Rain', category: 'texture', defaultIntensity: 65 },
  { kind: 'sparkle', label: 'Sparkle', category: 'texture', defaultIntensity: 65 },

  // Face
  { kind: 'smooth-skin', label: 'Smooth Skin', category: 'face', defaultIntensity: 60 },
  { kind: 'whiten-teeth', label: 'Whiten Teeth', category: 'face', defaultIntensity: 65 },
  { kind: 'brighten-eyes', label: 'Brighten Eyes', category: 'face', defaultIntensity: 60 },
  { kind: 'slim-face', label: 'Slim Face', category: 'face', defaultIntensity: 55 },
  { kind: 'enlarge-eyes', label: 'Enlarge Eyes', category: 'face', defaultIntensity: 55 },
  { kind: 'remove-blemishes', label: 'Remove Blemishes', category: 'face', defaultIntensity: 65 },

  // Body
  { kind: 'body-reshape', label: 'Reshape', category: 'body', defaultIntensity: 55 },
  { kind: 'body-slim', label: 'Slim', category: 'body', defaultIntensity: 55 },
  { kind: 'body-widen', label: 'Widen', category: 'body', defaultIntensity: 55 },
  { kind: 'body-lengthen', label: 'Lengthen', category: 'body', defaultIntensity: 55 },

  // Cutout
  { kind: 'bg-remove', label: 'AI BG Remove', category: 'cutout', defaultIntensity: 65 },
];

export function createDefaultOverlayBorder(): OverlayBorderParams {
  return {
    width: 0,
    color: '#FFFFFF',
    style: 'solid',
    radius: 0,
  };
}

export function createOverlayEffectItem(kind: OverlayEffectKind): OverlayEffectItem {
  const def = OVERLAY_EFFECT_CATALOG.find((e) => e.kind === kind) ?? OVERLAY_EFFECT_CATALOG[0];
  return {
    id: `ovfx_${kind}_${Math.random().toString(36).slice(2, 7)}`,
    kind: def.kind,
    label: def.label,
    category: def.category,
    intensity: def.defaultIntensity,
    enabled: true,
  };
}

// ---------- Per-Overlay Undo / Redo History ----------

export interface OverlayHistoryEntry {
  past: ImageLayerParams[];
  future: ImageLayerParams[];
}

export function cloneImageLayerParams(p: ImageLayerParams): ImageLayerParams {
  return JSON.parse(JSON.stringify(p)) as ImageLayerParams;
}

export function pushOverlayHistory(
  map: Record<string, OverlayHistoryEntry>,
  layerId: string,
  prevParams: ImageLayerParams,
): Record<string, OverlayHistoryEntry> {
  const cur = map[layerId] ?? { past: [], future: [] };
  return {
    ...map,
    [layerId]: {
      past: [...cur.past, cloneImageLayerParams(prevParams)].slice(-40),
      future: [],
    },
  };
}

export function undoOverlayHistory(
  map: Record<string, OverlayHistoryEntry>,
  layerId: string,
  currentParams: ImageLayerParams,
): { nextMap: Record<string, OverlayHistoryEntry>; params: ImageLayerParams } | null {
  const cur = map[layerId];
  if (!cur || cur.past.length === 0) return null;
  const previous = cur.past[cur.past.length - 1];
  return {
    params: cloneImageLayerParams(previous),
    nextMap: {
      ...map,
      [layerId]: {
        past: cur.past.slice(0, -1),
        future: [cloneImageLayerParams(currentParams), ...cur.future].slice(0, 40),
      },
    },
  };
}

export function redoOverlayHistory(
  map: Record<string, OverlayHistoryEntry>,
  layerId: string,
  currentParams: ImageLayerParams,
): { nextMap: Record<string, OverlayHistoryEntry>; params: ImageLayerParams } | null {
  const cur = map[layerId];
  if (!cur || cur.future.length === 0) return null;
  const next = cur.future[0];
  return {
    params: cloneImageLayerParams(next),
    nextMap: {
      ...map,
      [layerId]: {
        past: [...cur.past, cloneImageLayerParams(currentParams)].slice(-40),
        future: cur.future.slice(1),
      },
    },
  };
}

// ---------- Overlay Geometry & Auto-Snap Helpers ----------

export interface OverlaySnapResult {
  x: number;
  y: number;
  rotation: number;
  snapX: number | null;
  snapY: number | null;
  snapAngle: number | null;
}

const POS_SNAP_TARGETS = [0.5, 1 / 3, 2 / 3];
const ANGLE_SNAP_TARGETS = [-180, -135, -90, -45, 0, 45, 90, 135, 180];

export function computeOverlaySnap(
  rawX: number,
  rawY: number,
  rawRotation: number,
  enabled: boolean,
  posThreshold = 0.024,
  angleThreshold = 4.5,
): OverlaySnapResult {
  let x = Math.max(0.02, Math.min(0.98, rawX));
  let y = Math.max(0.02, Math.min(0.98, rawY));
  let rotation = rawRotation;
  while (rotation > 180) rotation -= 360;
  while (rotation < -180) rotation += 360;

  let snapX: number | null = null;
  let snapY: number | null = null;
  let snapAngle: number | null = null;

  if (enabled) {
    for (const tx of POS_SNAP_TARGETS) {
      if (Math.abs(x - tx) <= posThreshold) {
        x = tx;
        snapX = tx;
        break;
      }
    }
    for (const ty of POS_SNAP_TARGETS) {
      if (Math.abs(y - ty) <= posThreshold) {
        y = ty;
        snapY = ty;
        break;
      }
    }
    for (const ta of ANGLE_SNAP_TARGETS) {
      if (Math.abs(rotation - ta) <= angleThreshold) {
        rotation = ta === -180 ? 180 : ta;
        snapAngle = rotation;
        break;
      }
    }
  }

  return { x, y, rotation: Math.round(rotation), snapX, snapY, snapAngle };
}

export function getOverlayBoxDimensions(
  canvasW: number,
  canvasH: number,
  params: Pick<ImageLayerParams, 'scale' | 'aspectRatio'>,
): { dw: number; dh: number } {
  const baseFit = Math.min(canvasW, canvasH) * 0.55 * params.scale;
  const ratio = Math.max(0.15, Math.min(6, params.aspectRatio ?? 1));
  const dw = ratio >= 1 ? baseFit : baseFit * ratio;
  const dh = ratio >= 1 ? baseFit / ratio : baseFit;
  return { dw: Math.max(4, dw), dh: Math.max(4, dh) };
}

/**
 * Maps a normalized canvas point (nx, ny in 0..1) into overlay-local coordinates (lx, ly in 0..1)
 * accounting for translation, rotation, scale, flipH, and flipV.
 */
export function canvasPointToOverlayLocal(
  nx: number,
  ny: number,
  canvasW: number,
  canvasH: number,
  params: ImageLayerParams,
): { x: number; y: number } {
  const { dw, dh } = getOverlayBoxDimensions(canvasW, canvasH, params);
  const dx = nx * canvasW - params.x * canvasW;
  const dy = ny * canvasH - params.y * canvasH;
  const rad = (-params.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  let rx = dx * cos - dy * sin;
  let ry = dx * sin + dy * cos;
  if (params.flipH) rx = -rx;
  if (params.flipV) ry = -ry;
  return {
    x: rx / dw + 0.5,
    y: ry / dh + 0.5,
  };
}

// ---------- Pixel-Level Overlay Effects Engine ----------

function fastBoxBlurRgba(src: Uint8ClampedArray, w: number, h: number, radius: number): Uint8ClampedArray {
  const r = Math.max(1, Math.min(18, Math.round(radius)));
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const win = r * 2 + 1;

  for (let y = 0; y < h; y++) {
    let sr = 0, sg = 0, sb = 0, sa = 0;
    for (let kx = -r; kx <= r; kx++) {
      const xx = Math.max(0, Math.min(w - 1, kx));
      const idx = (y * w + xx) * 4;
      sr += src[idx];
      sg += src[idx + 1];
      sb += src[idx + 2];
      sa += src[idx + 3];
    }
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      tmp[i] = sr / win;
      tmp[i + 1] = sg / win;
      tmp[i + 2] = sb / win;
      tmp[i + 3] = sa / win;
      const xOut = Math.max(0, x - r);
      const xIn = Math.min(w - 1, x + r + 1);
      const oIdx = (y * w + xOut) * 4;
      const iIdx = (y * w + xIn) * 4;
      sr += src[iIdx] - src[oIdx];
      sg += src[iIdx + 1] - src[oIdx + 1];
      sb += src[iIdx + 2] - src[oIdx + 2];
      sa += src[iIdx + 3] - src[oIdx + 3];
    }
  }

  for (let x = 0; x < w; x++) {
    let sr = 0, sg = 0, sb = 0, sa = 0;
    for (let ky = -r; ky <= r; ky++) {
      const yy = Math.max(0, Math.min(h - 1, ky));
      const idx = (yy * w + x) * 4;
      sr += tmp[idx];
      sg += tmp[idx + 1];
      sb += tmp[idx + 2];
      sa += tmp[idx + 3];
    }
    for (let y = 0; y < h; y++) {
      const i = (y * w + x) * 4;
      out[i] = sr / win;
      out[i + 1] = sg / win;
      out[i + 2] = sb / win;
      out[i + 3] = sa / win;
      const yOut = Math.max(0, y - r);
      const yIn = Math.min(h - 1, y + r + 1);
      const oIdx = (yOut * w + x) * 4;
      const iIdx = (yIn * w + x) * 4;
      sr += tmp[iIdx] - tmp[oIdx];
      sg += tmp[iIdx + 1] - tmp[oIdx + 1];
      sb += tmp[iIdx + 2] - tmp[oIdx + 2];
      sa += tmp[iIdx + 3] - tmp[oIdx + 3];
    }
  }
  return out;
}

function sampleBilinear(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  sx: number,
  sy: number,
): [number, number, number, number] {
  const x = Math.max(0, Math.min(w - 1.001, sx));
  const y = Math.max(0, Math.min(h - 1.001, sy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const fx = x - x0;
  const fy = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  const lerp = (a: number, b: number, c: number, d: number) =>
    (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy;
  return [
    lerp(src[i00], src[i10], src[i01], src[i11]),
    lerp(src[i00 + 1], src[i10 + 1], src[i01 + 1], src[i11 + 1]),
    lerp(src[i00 + 2], src[i10 + 2], src[i01 + 2], src[i11 + 2]),
    lerp(src[i00 + 3], src[i10 + 3], src[i01 + 3], src[i11 + 3]),
  ];
}

/**
 * Pure RGBA pixel processor implementing every Picsart-style overlay effect (0..100 intensity).
 * Note: Drop Shadow also gets extra outer-padding treatment in pipeline.ts when compositing,
 * and here works cleanly on any padded or unpadded RGBA buffer.
 */
export function applyOverlayEffectToPixels(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  kind: OverlayEffectKind,
  intensity: number,
): void {
  const amt = clamp01(intensity / 100);
  if (amt <= 0 || w < 2 || h < 2) return;
  const copy = new Uint8ClampedArray(data);

  switch (kind) {
    case 'blur': {
      const rad = Math.max(1, Math.round(amt * Math.min(w, h) * 0.045));
      const blurred = fastBoxBlurRgba(copy, w, h, rad);
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + blurred[i] * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + blurred[i + 1] * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + blurred[i + 2] * amt));
      }
      break;
    }

    case 'motion-blur': {
      const taps = Math.max(3, Math.round(amt * 14));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sr = 0, sg = 0, sb = 0, cnt = 0;
          for (let k = -taps; k <= taps; k++) {
            const sx = Math.max(0, Math.min(w - 1, x + k));
            const si = (y * w + sx) * 4;
            sr += copy[si];
            sg += copy[si + 1];
            sb += copy[si + 2];
            cnt++;
          }
          const idx = (y * w + x) * 4;
          data[idx] = clamp255(Math.round(sr / cnt));
          data[idx + 1] = clamp255(Math.round(sg / cnt));
          data[idx + 2] = clamp255(Math.round(sb / cnt));
        }
      }
      break;
    }

    case 'radial-blur': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const samples = 7;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          let sr = 0, sg = 0, sb = 0;
          for (let s = 0; s < samples; s++) {
            const f = 1 - (s / (samples - 1)) * amt * 0.14;
            const [r, g, b] = sampleBilinear(copy, w, h, cx + dx * f, cy + dy * f);
            sr += r;
            sg += g;
            sb += b;
          }
          const idx = (y * w + x) * 4;
          data[idx] = clamp255(Math.round(sr / samples));
          data[idx + 1] = clamp255(Math.round(sg / samples));
          data[idx + 2] = clamp255(Math.round(sb / samples));
        }
      }
      break;
    }

    case 'tilt-shift': {
      const rad = Math.max(2, Math.round(amt * Math.min(w, h) * 0.04));
      const blurred = fastBoxBlurRgba(copy, w, h, rad);
      for (let y = 0; y < h; y++) {
        const dist = Math.abs(y / h - 0.5);
        const wBlur = clamp01((dist - 0.14) / 0.28) * amt;
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - wBlur) + blurred[i] * wBlur));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - wBlur) + blurred[i + 1] * wBlur));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - wBlur) + blurred[i + 2] * wBlur));
        }
      }
      break;
    }

    case 'sharpen': {
      const blurred = fastBoxBlurRgba(copy, w, h, 2);
      const gain = amt * 1.9;
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(Math.round(copy[i] + (copy[i] - blurred[i]) * gain));
        data[i + 1] = clamp255(Math.round(copy[i + 1] + (copy[i + 1] - blurred[i + 1]) * gain));
        data[i + 2] = clamp255(Math.round(copy[i + 2] + (copy[i + 2] - blurred[i + 2]) * gain));
      }
      break;
    }

    case 'pixelate': {
      const cell = Math.max(2, Math.round(2 + amt * Math.min(w, h) * 0.09));
      for (let by = 0; by < h; by += cell) {
        for (let bx = 0; bx < w; bx += cell) {
          const sx = Math.min(w - 1, bx + Math.floor(cell / 2));
          const sy = Math.min(h - 1, by + Math.floor(cell / 2));
          const si = (sy * w + sx) * 4;
          const r = copy[si], g = copy[si + 1], b = copy[si + 2];
          for (let y = by; y < Math.min(h, by + cell); y++) {
            for (let x = bx; x < Math.min(w, bx + cell); x++) {
              const i = (y * w + x) * 4;
              data[i] = r;
              data[i + 1] = g;
              data[i + 2] = b;
            }
          }
        }
      }
      break;
    }

    case 'mosaic': {
      const cell = Math.max(4, Math.round(4 + amt * Math.min(w, h) * 0.08));
      for (let by = 0; by < h; by += cell) {
        for (let bx = 0; bx < w; bx += cell) {
          let sr = 0, sg = 0, sb = 0, cnt = 0;
          for (let y = by; y < Math.min(h, by + cell); y++) {
            for (let x = bx; x < Math.min(w, bx + cell); x++) {
              const si = (y * w + x) * 4;
              sr += copy[si];
              sg += copy[si + 1];
              sb += copy[si + 2];
              cnt++;
            }
          }
          const mr = Math.round(sr / Math.max(1, cnt));
          const mg = Math.round(sg / Math.max(1, cnt));
          const mb = Math.round(sb / Math.max(1, cnt));
          for (let y = by; y < Math.min(h, by + cell); y++) {
            for (let x = bx; x < Math.min(w, bx + cell); x++) {
              const i = (y * w + x) * 4;
              const grout = x === bx || y === by;
              data[i] = grout ? Math.round(mr * 0.72) : mr;
              data[i + 1] = grout ? Math.round(mg * 0.72) : mg;
              data[i + 2] = grout ? Math.round(mb * 0.72) : mb;
            }
          }
        }
      }
      break;
    }

    case 'halftone': {
      const pitch = Math.max(4, Math.round(5 + amt * 8));
      const half = pitch * 0.5;
      for (let by = 0; by < h; by += pitch) {
        for (let bx = 0; bx < w; bx += pitch) {
          const sx = Math.min(w - 1, bx + Math.floor(half));
          const sy = Math.min(h - 1, by + Math.floor(half));
          const si = (sy * w + sx) * 4;
          const lum = (0.299 * copy[si] + 0.587 * copy[si + 1] + 0.114 * copy[si + 2]) / 255;
          const dotR = (1 - lum) * half * 0.95;
          for (let y = by; y < Math.min(h, by + pitch); y++) {
            for (let x = bx; x < Math.min(w, bx + pitch); x++) {
              const dist = Math.hypot(x - (bx + half), y - (by + half));
              const i = (y * w + x) * 4;
              const ink = dist <= dotR ? 22 : 244;
              data[i] = clamp255(Math.round(copy[i] * (1 - amt) + ink * amt));
              data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + ink * amt));
              data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + ink * amt));
            }
          }
        }
      }
      break;
    }

    case 'glow': {
      const blurred = fastBoxBlurRgba(copy, w, h, Math.max(2, Math.round(amt * 10)));
      for (let i = 0; i < data.length; i += 4) {
        const lift = Math.max(0, (blurred[i] + blurred[i + 1] + blurred[i + 2]) / 765 - 0.35);
        const g = amt * (0.4 + lift * 0.9);
        data[i] = clamp255(Math.round(copy[i] + blurred[i] * g));
        data[i + 1] = clamp255(Math.round(copy[i + 1] + blurred[i + 1] * g));
        data[i + 2] = clamp255(Math.round(copy[i + 2] + blurred[i + 2] * g));
      }
      break;
    }

    case 'neon-outline': {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const lIdx = (y * w + (x - 1)) * 4;
          const rIdx = (y * w + (x + 1)) * 4;
          const uIdx = ((y - 1) * w + x) * 4;
          const dIdx = ((y + 1) * w + x) * 4;
          const gx = Math.abs(copy[rIdx] - copy[lIdx]) + Math.abs(copy[rIdx + 1] - copy[lIdx + 1]);
          const gy = Math.abs(copy[dIdx] - copy[uIdx]) + Math.abs(copy[dIdx + 1] - copy[uIdx + 1]);
          const edge = clamp01((gx + gy) / 240);
          const nr = edge * 56;
          const ng = edge * 235;
          const nb = edge * 255;
          data[idx] = clamp255(Math.round(copy[idx] * (1 - amt * 0.72) + nr * amt * 1.4));
          data[idx + 1] = clamp255(Math.round(copy[idx + 1] * (1 - amt * 0.72) + ng * amt * 1.4));
          data[idx + 2] = clamp255(Math.round(copy[idx + 2] * (1 - amt * 0.72) + nb * amt * 1.4));
        }
      }
      break;
    }

    case 'drop-shadow': {
      // Shift alpha mask down-right onto transparent/outer regions; inside opaque regions keeps image intact.
      const ox = Math.max(2, Math.round(amt * Math.min(w, h) * 0.045));
      const oy = ox;
      const blurSrc = new Uint8ClampedArray(copy.length);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const sx = x - ox;
          const sy = y - oy;
          const idx = (y * w + x) * 4;
          if (sx >= 0 && sy >= 0 && sx < w && sy < h) {
            const sa = copy[(sy * w + sx) * 4 + 3];
            blurSrc[idx + 3] = Math.round(sa * 0.68 * amt);
          }
        }
      }
      const blurredShadow = fastBoxBlurRgba(blurSrc, w, h, Math.max(2, Math.round(amt * 7)));
      for (let i = 0; i < data.length; i += 4) {
        const fgA = copy[i + 3] / 255;
        const shA = blurredShadow[i + 3] / 255;
        const outA = fgA + shA * (1 - fgA);
        if (outA > 0.001) {
          data[i] = clamp255(Math.round((copy[i] * fgA) / outA));
          data[i + 1] = clamp255(Math.round((copy[i + 1] * fgA) / outA));
          data[i + 2] = clamp255(Math.round((copy[i + 2] * fgA) / outA));
          data[i + 3] = clamp255(Math.round(outA * 255));
        }
      }
      break;
    }

    case 'inner-shadow': {
      const thick = Math.max(4, Math.min(w, h) * (0.06 + amt * 0.14));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dEdge = Math.min(x, y, w - 1 - x, h - 1 - y);
          const shade = clamp01(1 - dEdge / thick) * amt * 0.78;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - shade)));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - shade)));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - shade)));
        }
      }
      break;
    }

    case 'sketch': {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const l1 = 0.299 * copy[idx - 4] + 0.587 * copy[idx - 3] + 0.114 * copy[idx - 2];
          const l2 = 0.299 * copy[idx + 4] + 0.587 * copy[idx + 5] + 0.114 * copy[idx + 6];
          const u = ((y - 1) * w + x) * 4;
          const dn = ((y + 1) * w + x) * 4;
          const lu = 0.299 * copy[u] + 0.587 * copy[u + 1] + 0.114 * copy[u + 2];
          const ld = 0.299 * copy[dn] + 0.587 * copy[dn + 1] + 0.114 * copy[dn + 2];
          const edge = Math.min(255, Math.hypot(l2 - l1, ld - lu) * 2.5);
          const paper = clamp255(245 - edge);
          data[idx] = clamp255(Math.round(copy[idx] * (1 - amt) + paper * amt));
          data[idx + 1] = clamp255(Math.round(copy[idx + 1] * (1 - amt) + paper * amt));
          data[idx + 2] = clamp255(Math.round(copy[idx + 2] * (1 - amt) + paper * amt));
        }
      }
      break;
    }

    case 'oil-paint': {
      const levels = Math.max(4, Math.round(12 - amt * 6));
      const step = 255 / levels;
      const smooth = fastBoxBlurRgba(copy, w, h, Math.max(1, Math.round(amt * 3)));
      for (let i = 0; i < data.length; i += 4) {
        const qr = Math.round(smooth[i] / step) * step;
        const qg = Math.round(smooth[i + 1] / step) * step;
        const qb = Math.round(smooth[i + 2] / step) * step;
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + qr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + qg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + qb * amt));
      }
      break;
    }

    case 'watercolor': {
      const soft = fastBoxBlurRgba(copy, w, h, Math.max(2, Math.round(amt * 4)));
      for (let i = 0; i < data.length; i += 4) {
        const edgeBoost = (Math.abs(copy[i] - soft[i]) + Math.abs(copy[i + 1] - soft[i + 1])) * 0.2;
        const wr = clamp255(soft[i] * 1.06 + 10 - edgeBoost);
        const wg = clamp255(soft[i + 1] * 1.06 + 8 - edgeBoost);
        const wb = clamp255(soft[i + 2] * 1.08 + 12 - edgeBoost);
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + wr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + wg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + wb * amt));
      }
      break;
    }

    case 'comic': {
      const qStep = 52;
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const idx = (y * w + x) * 4;
          const r = Math.round(copy[idx] / qStep) * qStep;
          const g = Math.round(copy[idx + 1] / qStep) * qStep;
          const b = Math.round(copy[idx + 2] / qStep) * qStep;
          const diff =
            Math.abs(copy[idx + 4] - copy[idx - 4]) +
            Math.abs(copy[((y + 1) * w + x) * 4] - copy[((y - 1) * w + x) * 4]);
          const ink = diff > 95 ? 0.2 : 1;
          data[idx] = clamp255(Math.round(copy[idx] * (1 - amt) + r * ink * amt));
          data[idx + 1] = clamp255(Math.round(copy[idx + 1] * (1 - amt) + g * ink * amt));
          data[idx + 2] = clamp255(Math.round(copy[idx + 2] * (1 - amt) + b * ink * amt));
        }
      }
      break;
    }

    case 'cartoon': {
      const smooth = fastBoxBlurRgba(copy, w, h, 2);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          const q = 42;
          const cr = Math.round(smooth[i] / q) * q;
          const cg = Math.round(smooth[i + 1] / q) * q;
          const cb = Math.round(smooth[i + 2] / q) * q;
          const diff =
            Math.abs(smooth[i + 4] - smooth[i - 4]) +
            Math.abs(smooth[((y + 1) * w + x) * 4] - smooth[((y - 1) * w + x) * 4]);
          const line = diff > 75 ? 0.25 : 1;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + cr * line * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + cg * line * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + cb * line * amt));
        }
      }
      break;
    }

    case 'film-grain': {
      const strength = amt * 46;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const n = ((hash - Math.floor(hash)) - 0.5) * strength;
          data[i] = clamp255(Math.round(copy[i] + n));
          data[i + 1] = clamp255(Math.round(copy[i + 1] + n));
          data[i + 2] = clamp255(Math.round(copy[i + 2] + n));
        }
      }
      break;
    }

    case 'dust': {
      const count = Math.max(12, Math.round(amt * 140));
      for (let dIdx = 0; dIdx < count; dIdx++) {
        const px = Math.floor(((dIdx * 7919 + 104729) % 1000) / 1000 * w);
        const py = Math.floor(((dIdx * 6271 + 31337) % 1000) / 1000 * h);
        const len = dIdx % 5 === 0 ? 7 : 2;
        for (let k = 0; k < len; k++) {
          const x = Math.min(w - 1, px + k);
          const y = Math.min(h - 1, py + (dIdx % 2 === 0 ? k : 0));
          const idx = (y * w + x) * 4;
          const speck = 235;
          data[idx] = clamp255(Math.round(data[idx] * (1 - amt * 0.7) + speck * amt * 0.7));
          data[idx + 1] = clamp255(Math.round(data[idx + 1] * (1 - amt * 0.7) + speck * amt * 0.7));
          data[idx + 2] = clamp255(Math.round(data[idx + 2] * (1 - amt * 0.7) + speck * amt * 0.7));
        }
      }
      break;
    }

    case 'light-leak': {
      for (let y = 0; y < h; y++) {
        const yn = y / h;
        for (let x = 0; x < w; x++) {
          const xn = x / w;
          const w1 = Math.max(0, 1 - Math.hypot(xn - 0.12, yn - 0.25) * 1.45) * amt;
          const w2 = Math.max(0, 1 - Math.hypot(xn - 0.88, yn - 0.78) * 1.55) * amt;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] + w1 * 185 + w2 * 145));
          data[i + 1] = clamp255(Math.round(copy[i + 1] + w1 * 95 + w2 * 45));
          data[i + 2] = clamp255(Math.round(copy[i + 2] + w1 * 28 + w2 * 95));
        }
      }
      break;
    }

    case 'vintage-fade': {
      for (let i = 0; i < data.length; i += 4) {
        const r = copy[i] * 0.88 + 26;
        const g = copy[i + 1] * 0.86 + 22;
        const b = copy[i + 2] * 0.82 + 24;
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + (r * 0.94 + g * 0.06) * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + g * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + (b * 0.9 + 14) * amt));
      }
      break;
    }

    case 'duotone': {
      // Deep indigo shadows (#1E1B4B) -> vibrant coral highlights (#FB7185)
      for (let i = 0; i < data.length; i += 4) {
        const t = (0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2]) / 255;
        const dr = 30 * (1 - t) + 251 * t;
        const dg = 27 * (1 - t) + 113 * t;
        const db = 75 * (1 - t) + 133 * t;
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + dr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + dg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + db * amt));
      }
      break;
    }

    case 'posterize': {
      const levels = Math.max(2, Math.round(9 - amt * 6));
      const step = 255 / (levels - 1);
      for (let i = 0; i < data.length; i += 4) {
        const pr = Math.round(copy[i] / step) * step;
        const pg = Math.round(copy[i + 1] / step) * step;
        const pb = Math.round(copy[i + 2] / step) * step;
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + pr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + pg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + pb * amt));
      }
      break;
    }

    case 'solarize': {
      const thresh = 128;
      for (let i = 0; i < data.length; i += 4) {
        const sr = copy[i] > thresh ? 255 - copy[i] : copy[i];
        const sg = copy[i + 1] > thresh ? 255 - copy[i + 1] : copy[i + 1];
        const sb = copy[i + 2] > thresh ? 255 - copy[i + 2] : copy[i + 2];
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + sr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + sg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + sb * amt));
      }
      break;
    }

    case 'invert': {
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + (255 - copy[i]) * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + (255 - copy[i + 1]) * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + (255 - copy[i + 2]) * amt));
      }
      break;
    }

    case 'vignette': {
      for (let y = 0; y < h; y++) {
        const dy = (y / h - 0.5) * 2;
        for (let x = 0; x < w; x++) {
          const dx = (x / w - 0.5) * 2;
          const dist = Math.hypot(dx, dy) / 1.414;
          const dark = clamp01(Math.pow(dist, 2) * amt * 0.9);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - dark)));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - dark)));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - dark)));
        }
      }
      break;
    }

    case 'fisheye': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const maxR = Math.min(cx, cy);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const nx = (x - cx) / maxR;
          const ny = (y - cy) / maxR;
          const r = Math.hypot(nx, ny);
          const i = (y * w + x) * 4;
          if (r > 0.0001 && r < 1.35) {
            const nr = Math.pow(r, 1 + amt * 0.75);
            const sx = cx + (nx / r) * nr * maxR;
            const sy = cy + (ny / r) * nr * maxR;
            const [sr, sg, sb, sa] = sampleBilinear(copy, w, h, sx, sy);
            data[i] = clamp255(Math.round(sr));
            data[i + 1] = clamp255(Math.round(sg));
            data[i + 2] = clamp255(Math.round(sb));
            data[i + 3] = clamp255(Math.round(sa));
          }
        }
      }
      break;
    }

    case 'mirror': {
      const halfW = Math.floor(w / 2);
      for (let y = 0; y < h; y++) {
        for (let x = halfW; x < w; x++) {
          const sx = Math.max(0, Math.min(w - 1, w - 1 - x));
          const i = (y * w + x) * 4;
          const si = (y * w + sx) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + copy[si] * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + copy[si + 1] * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + copy[si + 2] * amt));
        }
      }
      break;
    }

    case 'kaleidoscope': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const sectors = 6;
      const slice = (Math.PI * 2) / sectors;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const rad = Math.hypot(dx, dy);
          let theta = Math.atan2(dy, dx);
          if (theta < 0) theta += Math.PI * 2;
          let sec = theta % slice;
          if (Math.floor(theta / slice) % 2 === 1) sec = slice - sec;
          const sx = cx + Math.cos(sec) * rad;
          const sy = cy + Math.sin(sec) * rad;
          const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, sy);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + sr * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + sg * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + sb * amt));
        }
      }
      break;
    }

    case 'glitch': {
      const shiftMax = Math.max(3, Math.round(amt * w * 0.08));
      for (let y = 0; y < h; y++) {
        const band = Math.floor(y / 8);
        const trigger = ((band * 37 + 13) % 7) < 3;
        const dx = trigger ? (((band * 29) % 2 === 0 ? 1 : -1) * shiftMax) : 0;
        for (let x = 0; x < w; x++) {
          const sx = Math.max(0, Math.min(w - 1, x + dx));
          const sxB = Math.max(0, Math.min(w - 1, x - Math.round(dx * 0.7)));
          const i = (y * w + x) * 4;
          data[i] = copy[(y * w + sx) * 4];
          data[i + 1] = copy[i + 1];
          data[i + 2] = copy[(y * w + sxB) * 4 + 2];
        }
      }
      break;
    }

    case 'rgb-split': {
      const shift = Math.max(1, Math.round(amt * w * 0.035));
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const xr = Math.min(w - 1, x + shift);
          const xb = Math.max(0, x - shift);
          const i = (y * w + x) * 4;
          data[i] = copy[(y * w + xr) * 4];
          data[i + 1] = copy[i + 1];
          data[i + 2] = copy[(y * w + xb) * 4 + 2];
        }
      }
      break;
    }

    case 'scanlines': {
      const darkFactor = 1 - amt * 0.55;
      for (let y = 0; y < h; y++) {
        if (y % 3 === 0) {
          for (let x = 0; x < w; x++) {
            const i = (y * w + x) * 4;
            data[i] = clamp255(Math.round(copy[i] * darkFactor));
            data[i + 1] = clamp255(Math.round(copy[i + 1] * darkFactor));
            data[i + 2] = clamp255(Math.round(copy[i + 2] * darkFactor));
          }
        }
      }
      break;
    }

    case 'zoom-blur': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const samples = 9;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const edgeDist = Math.hypot(dx / cx, dy / cy);
          const stretch = Math.min(0.28, amt * 0.22 * (0.35 + edgeDist));
          let sr = 0, sg = 0, sb = 0;
          for (let s = 0; s < samples; s++) {
            const f = 1 - (s / (samples - 1)) * stretch;
            const [r, g, b] = sampleBilinear(copy, w, h, cx + dx * f, cy + dy * f);
            sr += r;
            sg += g;
            sb += b;
          }
          const idx = (y * w + x) * 4;
          data[idx] = clamp255(Math.round(sr / samples));
          data[idx + 1] = clamp255(Math.round(sg / samples));
          data[idx + 2] = clamp255(Math.round(sb / samples));
        }
      }
      break;
    }

    case 'bokeh': {
      const rad = Math.max(2, Math.round(amt * Math.min(w, h) * 0.045));
      const soft = fastBoxBlurRgba(copy, w, h, rad);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const dx = (x - w * 0.5) / (w * 0.45);
          const dy = (y - h * 0.5) / (h * 0.45);
          const blurW = clamp01((Math.hypot(dx, dy) - 0.32) / 0.6) * amt;
          const lum = (0.299 * soft[i] + 0.587 * soft[i + 1] + 0.114 * soft[i + 2]) / 255;
          const highlightSpark = lum > 0.65 ? (lum - 0.65) * 95 * amt : 0;
          data[i] = clamp255(Math.round(copy[i] * (1 - blurW) + soft[i] * blurW + highlightSpark));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - blurW) + soft[i + 1] * blurW + highlightSpark));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - blurW) + soft[i + 2] * blurW + highlightSpark));
        }
      }
      break;
    }

    case 'pencil': {
      const blurred = fastBoxBlurRgba(copy, w, h, Math.max(2, Math.round(amt * 5)));
      for (let i = 0; i < data.length; i += 4) {
        const gOrig = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
        const gBlur = 0.299 * blurred[i] + 0.587 * blurred[i + 1] + 0.114 * blurred[i + 2];
        // Color dodge pencil sketch formula
        const inv = 255 - gBlur;
        const sketch = inv <= 1 ? 255 : Math.min(255, (gOrig * 255) / (255 - inv + 1));
        const val = clamp255(Math.round(sketch * 0.92 + 12));
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + val * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + val * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + val * amt));
      }
      break;
    }

    case 'pop-art': {
      const palette: Array<[number, number, number]> = [
        [239, 68, 68],
        [245, 158, 11],
        [16, 185, 129],
        [236, 72, 153],
      ];
      for (let y = 0; y < h; y++) {
        const qy = y < h / 2 ? 0 : 1;
        for (let x = 0; x < w; x++) {
          const qx = x < w / 2 ? 0 : 1;
          const [tr, tg, tb] = palette[qy * 2 + qx];
          const sx = Math.min(w - 1, (x % Math.max(1, Math.floor(w / 2))) * 2);
          const sy = Math.min(h - 1, (y % Math.max(1, Math.floor(h / 2))) * 2);
          const si = (sy * w + sx) * 4;
          const lum = (0.299 * copy[si] + 0.587 * copy[si + 1] + 0.114 * copy[si + 2]) / 255;
          const qLum = lum > 0.58 ? 0.95 : lum > 0.3 ? 0.55 : 0.14;
          const pr = tr * qLum + (lum > 0.72 ? 45 : 0);
          const pg = tg * qLum + (lum > 0.72 ? 45 : 0);
          const pb = tb * qLum + (lum > 0.72 ? 45 : 0);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + pr * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + pg * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + pb * amt));
        }
      }
      break;
    }

    case 'pointillism': {
      const pitch = Math.max(3, Math.round(3 + amt * Math.min(w, h) * 0.03));
      const radius = pitch * 0.48;
      for (let by = 0; by < h; by += pitch) {
        for (let bx = 0; bx < w; bx += pitch) {
          const cx = Math.min(w - 1, bx + Math.floor(pitch / 2));
          const cy = Math.min(h - 1, by + Math.floor(pitch / 2));
          const si = (cy * w + cx) * 4;
          const cr = clamp255(Math.round(copy[si] * 1.1));
          const cg = clamp255(Math.round(copy[si + 1] * 1.1));
          const cb = clamp255(Math.round(copy[si + 2] * 1.1));
          for (let y = by; y < Math.min(h, by + pitch); y++) {
            for (let x = bx; x < Math.min(w, bx + pitch); x++) {
              const d = Math.hypot(x - cx, y - cy);
              const i = (y * w + x) * 4;
              if (d <= radius) {
                data[i] = clamp255(Math.round(copy[i] * (1 - amt) + cr * amt));
                data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + cg * amt));
                data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + cb * amt));
              } else {
                data[i] = clamp255(Math.round(copy[i] * (1 - amt) + 235 * amt));
                data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + 232 * amt));
                data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + 225 * amt));
              }
            }
          }
        }
      }
      break;
    }

    case 'stained-glass': {
      const cell = Math.max(5, Math.round(6 + amt * Math.min(w, h) * 0.075));
      const seeds: Array<{ x: number; y: number; r: number; g: number; b: number }> = [];
      for (let gy = 0; gy < h; gy += cell) {
        for (let gx = 0; gx < w; gx += cell) {
          const jx = ((gx * 37 + gy * 17) % cell) * 0.65;
          const jy = ((gx * 23 + gy * 41) % cell) * 0.65;
          const sx = Math.min(w - 1, Math.round(gx + jx + cell * 0.2));
          const sy = Math.min(h - 1, Math.round(gy + jy + cell * 0.2));
          const si = (sy * w + sx) * 4;
          seeds.push({ x: sx, y: sy, r: copy[si], g: copy[si + 1], b: copy[si + 2] });
        }
      }
      const cols = Math.max(1, Math.ceil(w / cell));
      for (let y = 0; y < h; y++) {
        const gY = Math.floor(y / cell);
        for (let x = 0; x < w; x++) {
          const gX = Math.floor(x / cell);
          let best = seeds[0];
          let minD = 1e9;
          let secondD = 1e9;
          for (let oy = -1; oy <= 1; oy++) {
            const ry = gY + oy;
            if (ry < 0) continue;
            for (let ox = -1; ox <= 1; ox++) {
              const rx = gX + ox;
              if (rx < 0 || rx >= cols) continue;
              const s = seeds[ry * cols + rx];
              if (!s) continue;
              const d = (x - s.x) * (x - s.x) + (y - s.y) * (y - s.y);
              if (d < minD) {
                secondD = minD;
                minD = d;
                best = s;
              } else if (d < secondD) {
                secondD = d;
              }
            }
          }
          const i = (y * w + x) * 4;
          const leadBorder = Math.sqrt(secondD) - Math.sqrt(minD) < 1.3 ? 0.22 : 1.05;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + best.r * leadBorder * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + best.g * leadBorder * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + best.b * leadBorder * amt));
        }
      }
      break;
    }

    case 'vhs': {
      const shift = Math.max(1, Math.round(amt * w * 0.02));
      for (let y = 0; y < h; y++) {
        const wobble = Math.round(Math.sin(y * 0.24) * amt * 3);
        const trackingBand = y > h * 0.82 && y < h * 0.87 ? 32 : 0;
        const lineDark = y % 2 === 0 ? 0.92 : 1.04;
        for (let x = 0; x < w; x++) {
          const sxR = Math.max(0, Math.min(w - 1, x + shift + wobble));
          const sxG = Math.max(0, Math.min(w - 1, x + wobble));
          const sxB = Math.max(0, Math.min(w - 1, x - shift + wobble));
          const i = (y * w + x) * 4;
          const r = copy[(y * w + sxR) * 4] * lineDark + trackingBand;
          const g = copy[(y * w + sxG) * 4 + 1] * 0.94 * lineDark + trackingBand;
          const b = copy[(y * w + sxB) * 4 + 2] * 1.08 * lineDark + trackingBand;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + r * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + g * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + b * amt));
        }
      }
      break;
    }

    case 'lomo': {
      for (let y = 0; y < h; y++) {
        const dy = (y / h - 0.5) * 2;
        for (let x = 0; x < w; x++) {
          const dx = (x / w - 0.5) * 2;
          const vig = clamp01(1 - Math.pow(Math.hypot(dx, dy) / 1.45, 2) * amt * 0.78);
          const i = (y * w + x) * 4;
          const c = (v: number) => clamp255(((v / 255 - 0.5) * (1 + amt * 0.55) + 0.5) * 255);
          const lr = c(copy[i]) * 1.06 * vig;
          const lg = c(copy[i + 1]) * 1.02 * vig;
          const lb = c(copy[i + 2]) * 0.88 * vig;
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + lr * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + lg * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + lb * amt));
        }
      }
      break;
    }

    case 'twirl': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const maxR = Math.min(cx, cy) * 0.95;
      const maxAngle = amt * Math.PI * 1.65;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.hypot(dx, dy);
          const i = (y * w + x) * 4;
          if (r < maxR && r > 0.001) {
            const pct = 1 - r / maxR;
            const theta = Math.atan2(dy, dx) + pct * pct * maxAngle;
            const sx = cx + Math.cos(theta) * r;
            const sy = cy + Math.sin(theta) * r;
            const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, sy);
            data[i] = clamp255(Math.round(sr));
            data[i + 1] = clamp255(Math.round(sg));
            data[i + 2] = clamp255(Math.round(sb));
          }
        }
      }
      break;
    }

    case 'bulge':
    case 'pinch': {
      const cx = w * 0.5;
      const cy = h * 0.5;
      const maxR = Math.min(cx, cy) * 0.92;
      const power = kind === 'bulge' ? 1 + amt * 0.75 : Math.max(0.35, 1 - amt * 0.55);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const r = Math.hypot(dx, dy);
          if (r < maxR && r > 0.001) {
            const rn = r / maxR;
            const nr = Math.pow(rn, power) * maxR;
            const sx = cx + (dx / r) * nr;
            const sy = cy + (dy / r) * nr;
            const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, sy);
            const i = (y * w + x) * 4;
            data[i] = clamp255(Math.round(sr));
            data[i + 1] = clamp255(Math.round(sg));
            data[i + 2] = clamp255(Math.round(sb));
          }
        }
      }
      break;
    }

    case 'ripple': {
      const amp = Math.max(1.5, amt * Math.min(w, h) * 0.045);
      const cx = w * 0.5;
      const cy = h * 0.5;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const dy = y - cy;
          const dist = Math.hypot(dx, dy);
          const wave = Math.sin(dist * 0.22) * amp;
          const sx = x + (dx / Math.max(1, dist)) * wave;
          const sy = y + (dy / Math.max(1, dist)) * wave;
          const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, sy);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(sr));
          data[i + 1] = clamp255(Math.round(sg));
          data[i + 2] = clamp255(Math.round(sb));
        }
      }
      break;
    }

    case 'bloom': {
      const blurred = fastBoxBlurRgba(copy, w, h, Math.max(2, Math.round(amt * 12)));
      for (let i = 0; i < data.length; i += 4) {
        const lum = (blurred[i] + blurred[i + 1] + blurred[i + 2]) / 765;
        const boost = Math.max(0, lum - 0.28) * amt * 1.45;
        data[i] = clamp255(Math.round(copy[i] + blurred[i] * boost * 1.05));
        data[i + 1] = clamp255(Math.round(copy[i + 1] + blurred[i + 1] * boost * 0.98));
        data[i + 2] = clamp255(Math.round(copy[i + 2] + blurred[i + 2] * boost * 1.1));
      }
      break;
    }

    case 'neon': {
      const glowBlur = fastBoxBlurRgba(copy, w, h, 2);
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          const i = (y * w + x) * 4;
          const gx = Math.abs(glowBlur[i + 4] - glowBlur[i - 4]);
          const gy = Math.abs(glowBlur[((y + 1) * w + x) * 4] - glowBlur[((y - 1) * w + x) * 4]);
          const edge = clamp01((gx + gy) / 95);
          const nr = edge * 236;
          const ng = edge * 72;
          const nb = edge * 245;
          const baseDark = 1 - amt * 0.45;
          data[i] = clamp255(Math.round(copy[i] * baseDark + nr * amt * 1.4));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * baseDark + ng * amt * 1.4));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * baseDark + nb * amt * 1.4));
        }
      }
      break;
    }

    case 'sun-flare': {
      const fx = w * 0.78;
      const fy = h * 0.2;
      const maxD = Math.hypot(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d = Math.hypot(x - fx, y - fy) / maxD;
          const ang = Math.atan2(y - fy, x - fx);
          const ray = 0.75 + 0.25 * Math.sin(ang * 8);
          const flare = Math.pow(Math.max(0, 1 - d * 1.35), 2.1) * amt * ray;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] + flare * 255));
          data[i + 1] = clamp255(Math.round(copy[i + 1] + flare * 205));
          data[i + 2] = clamp255(Math.round(copy[i + 2] + flare * 115));
        }
      }
      break;
    }

    case 'lens-flare': {
      const s1x = w * 0.24, s1y = h * 0.24;
      const s2x = w * 0.62, s2y = h * 0.62;
      const s3x = w * 0.78, s3y = h * 0.78;
      const maxD = Math.min(w, h);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d1 = Math.hypot(x - s1x, y - s1y) / (maxD * 0.42);
          const d2 = Math.hypot(x - s2x, y - s2y) / (maxD * 0.24);
          const d3 = Math.hypot(x - s3x, y - s3y) / (maxD * 0.16);
          const c1 = Math.exp(-d1 * d1 * 2.4) * amt;
          const ring2 = Math.exp(-Math.pow(d2 - 0.75, 2) * 18) * 0.55 * amt;
          const c3 = Math.max(0, 1 - d3) * 0.5 * amt;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] + c1 * 245 + ring2 * 95 + c3 * 220));
          data[i + 1] = clamp255(Math.round(copy[i + 1] + c1 * 225 + ring2 * 185 + c3 * 125));
          data[i + 2] = clamp255(Math.round(copy[i + 2] + c1 * 195 + ring2 * 255 + c3 * 245));
        }
      }
      break;
    }

    case 'rainbow': {
      for (let y = 0; y < h; y++) {
        const yn = y / h;
        for (let x = 0; x < w; x++) {
          const xn = x / w;
          const diag = clamp01((xn * 0.65 + yn * 0.55 - 0.22) * 1.45);
          const [rr, rg, rb] = hslToRgb(diag * 310, 0.92, 0.56);
          const mask = Math.sin(clamp01((xn + yn) * 0.5) * Math.PI) * amt * 0.42;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * (1 - mask) + rr * mask + mask * 30));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - mask) + rg * mask + mask * 25));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - mask) + rb * mask + mask * 30));
        }
      }
      break;
    }

    case 'spotlight': {
      const cx = w * 0.5;
      const cy = h * 0.46;
      const spotR = Math.min(w, h) * 0.44;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const d = Math.hypot(x - cx, y - cy) / spotR;
          const beam = Math.exp(-d * d * 1.5);
          const mult = 1 - amt * 0.72 * (1 - beam) + beam * amt * 0.24;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] * mult));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * mult));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * mult));
        }
      }
      break;
    }

    case 'thermal': {
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2]) / 255;
        const hue = (1 - lum) * 255;
        const [tr, tg, tb] = hslToRgb(hue, 0.96, 0.35 + lum * 0.32);
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + tr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + tg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + tb * amt));
      }
      break;
    }

    case 'gradient-map': {
      for (let i = 0; i < data.length; i += 4) {
        const lum = (0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2]) / 255;
        const gr = lum < 0.5 ? 20 + (lum * 2) * 195 : 215 + ((lum - 0.5) * 2) * 40;
        const gg = lum < 0.5 ? 184 * (lum * 2) * 0.45 : 83 + ((lum - 0.5) * 2) * 145;
        const gb = lum < 0.5 ? 115 + (lum * 2) * 65 : 180 - ((lum - 0.5) * 2) * 115;
        data[i] = clamp255(Math.round(copy[i] * (1 - amt) + gr * amt));
        data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + gg * amt));
        data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + gb * amt));
      }
      break;
    }

    case 'paper': {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const hash = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const fiber = ((hash - Math.floor(hash)) - 0.5) * 28 + Math.sin(y * 0.55) * 6;
          const pr = (copy[i] * 0.95 + 16 + fiber * amt);
          const pg = (copy[i + 1] * 0.93 + 12 + fiber * amt);
          const pb = (copy[i + 2] * 0.86 + 6 + fiber * amt);
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + pr * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + pg * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + pb * amt));
        }
      }
      break;
    }

    case 'canvas': {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const weave = (Math.sin(x * 1.4) + Math.cos(y * 1.4)) * 14 * amt;
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(copy[i] + weave));
          data[i + 1] = clamp255(Math.round(copy[i + 1] + weave));
          data[i + 2] = clamp255(Math.round(copy[i + 2] + weave * 0.85));
        }
      }
      break;
    }

    case 'grunge': {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const stain = Math.sin(x * 0.08) * Math.cos(y * 0.07) * 0.28 +
            (((Math.sin(x * 19.3 + y * 43.7) * 43758.54) % 1) - 0.5) * 0.25;
          const lum = 0.299 * copy[i] + 0.587 * copy[i + 1] + 0.114 * copy[i + 2];
          const gr = (copy[i] * 0.72 + lum * 0.28) * (1 - amt * 0.35 + stain * amt);
          const gg = (copy[i + 1] * 0.7 + lum * 0.3) * (1 - amt * 0.36 + stain * amt);
          const gb = (copy[i + 2] * 0.65 + lum * 0.35) * (1 - amt * 0.4 + stain * amt);
          data[i] = clamp255(Math.round(copy[i] * (1 - amt) + gr * amt));
          data[i + 1] = clamp255(Math.round(copy[i + 1] * (1 - amt) + gg * amt));
          data[i + 2] = clamp255(Math.round(copy[i + 2] * (1 - amt) + gb * amt));
        }
      }
      break;
    }

    case 'bokeh-overlay': {
      const orbs = 18;
      for (let o = 0; o < orbs; o++) {
        const ox = (((o * 73 + 19) % 100) / 100) * w;
        const oy = (((o * 41 + 29) % 100) / 100) * h;
        const or = Math.min(w, h) * (0.06 + ((o * 17) % 11) * 0.012);
        const [cr, cg, cb] = o % 3 === 0 ? [255, 210, 140] : o % 3 === 1 ? [255, 165, 220] : [160, 230, 255];
        const x0 = Math.max(0, Math.floor(ox - or));
        const x1 = Math.min(w - 1, Math.ceil(ox + or));
        const y0 = Math.max(0, Math.floor(oy - or));
        const y1 = Math.min(h - 1, Math.ceil(oy + or));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - ox, y - oy) / or;
            if (d < 1) {
              const alpha = (0.16 + Math.pow(d, 3) * 0.28) * amt;
              const i = (y * w + x) * 4;
              data[i] = clamp255(Math.round(data[i] + cr * alpha));
              data[i + 1] = clamp255(Math.round(data[i + 1] + cg * alpha));
              data[i + 2] = clamp255(Math.round(data[i + 2] + cb * alpha));
            }
          }
        }
      }
      break;
    }

    case 'snow': {
      const flakes = Math.max(24, Math.round(amt * 120));
      for (let f = 0; f < flakes; f++) {
        const fx = (((f * 7919 + 101) % 1000) / 1000) * w;
        const fy = (((f * 6271 + 307) % 1000) / 1000) * h;
        const r = Math.max(1, Math.min(w, h) * (0.008 + (f % 4) * 0.005));
        const x0 = Math.max(0, Math.floor(fx - r));
        const x1 = Math.min(w - 1, Math.ceil(fx + r));
        const y0 = Math.max(0, Math.floor(fy - r));
        const y1 = Math.min(h - 1, Math.ceil(fy + r));
        for (let y = y0; y <= y1; y++) {
          for (let x = x0; x <= x1; x++) {
            const d = Math.hypot(x - fx, y - fy) / r;
            if (d <= 1) {
              const wFlake = (1 - d) * amt * 0.92;
              const i = (y * w + x) * 4;
              data[i] = clamp255(Math.round(data[i] * (1 - wFlake) + 255 * wFlake));
              data[i + 1] = clamp255(Math.round(data[i + 1] * (1 - wFlake) + 255 * wFlake));
              data[i + 2] = clamp255(Math.round(data[i + 2] * (1 - wFlake) + 255 * wFlake));
            }
          }
        }
      }
      break;
    }

    case 'rain': {
      const drops = Math.max(30, Math.round(amt * 130));
      const len = Math.max(5, Math.round(Math.min(w, h) * 0.1));
      for (let dIdx = 0; dIdx < drops; dIdx++) {
        const sx = Math.floor((((dIdx * 7919 + 53) % 1000) / 1000) * w);
        const sy = Math.floor((((dIdx * 4817 + 97) % 1000) / 1000) * h);
        for (let k = 0; k < len; k++) {
          const x = sx + Math.round(k * 0.25);
          const y = sy + k;
          if (x >= 0 && x < w && y >= 0 && y < h) {
            const i = (y * w + x) * 4;
            const b = amt * 115;
            data[i] = clamp255(Math.round(data[i] + b * 0.85));
            data[i + 1] = clamp255(Math.round(data[i + 1] + b * 0.92));
            data[i + 2] = clamp255(Math.round(data[i + 2] + b));
          }
        }
      }
      break;
    }

    case 'sparkle': {
      const stars = Math.max(10, Math.round(amt * 32));
      const arm = Math.max(3, Math.round(Math.min(w, h) * 0.055));
      for (let s = 0; s < stars; s++) {
        const sx = Math.floor((((s * 7919 + 211) % 1000) / 1000) * w);
        const sy = Math.floor((((s * 5413 + 389) % 1000) / 1000) * h);
        for (let d = -arm; d <= arm; d++) {
          const glow = Math.max(0, 1 - Math.abs(d) / arm) * amt * 225;
          if (sx + d >= 0 && sx + d < w) {
            const ih = (sy * w + (sx + d)) * 4;
            data[ih] = clamp255(Math.round(data[ih] + glow));
            data[ih + 1] = clamp255(Math.round(data[ih + 1] + glow * 0.96));
            data[ih + 2] = clamp255(Math.round(data[ih + 2] + glow * 0.82));
          }
          if (sy + d >= 0 && sy + d < h) {
            const iv = ((sy + d) * w + sx) * 4;
            data[iv] = clamp255(Math.round(data[iv] + glow));
            data[iv + 1] = clamp255(Math.round(data[iv + 1] + glow * 0.96));
            data[iv + 2] = clamp255(Math.round(data[iv + 2] + glow * 0.82));
          }
        }
      }
      break;
    }

    case 'smooth-skin':
    case 'remove-blemishes': {
      const rad = kind === 'remove-blemishes' ? 3 : Math.max(1, Math.round(amt * 3));
      const smooth = fastBoxBlurRgba(copy, w, h, rad);
      for (let i = 0; i < data.length; i += 4) {
        const r = copy[i], g = copy[i + 1], b = copy[i + 2];
        const isWarmTone = r > g && g > b && r - b > 14;
        const diff = (Math.abs(r - smooth[i]) + Math.abs(g - smooth[i + 1])) / 2;
        const mask = isWarmTone && diff < (kind === 'remove-blemishes' ? 42 : 28) ? amt * 0.85 : amt * 0.25;
        data[i] = clamp255(Math.round(r * (1 - mask) + smooth[i] * mask));
        data[i + 1] = clamp255(Math.round(g * (1 - mask) + smooth[i + 1] * mask));
        data[i + 2] = clamp255(Math.round(b * (1 - mask) + smooth[i + 2] * mask));
      }
      break;
    }

    case 'whiten-teeth': {
      for (let i = 0; i < data.length; i += 4) {
        const r = copy[i], g = copy[i + 1], b = copy[i + 2];
        const lum = (r + g + b) / 3;
        if (lum > 110 && r >= b) {
          const lift = amt * 28;
          const neutral = lum + lift;
          const wMix = amt * 0.52;
          data[i] = clamp255(Math.round(r * (1 - wMix) + neutral * wMix));
          data[i + 1] = clamp255(Math.round(g * (1 - wMix) + neutral * wMix));
          data[i + 2] = clamp255(Math.round(b * (1 - wMix) + Math.min(255, neutral + lift * 0.35) * wMix));
        }
      }
      break;
    }

    case 'brighten-eyes': {
      const sharp = fastBoxBlurRgba(copy, w, h, 1);
      for (let i = 0; i < data.length; i += 4) {
        const lum = (copy[i] + copy[i + 1] + copy[i + 2]) / 765;
        const detailBoost = (copy[i] - sharp[i]) * amt * 1.4;
        const bright = lum > 0.25 ? amt * 22 : amt * 8;
        data[i] = clamp255(Math.round(copy[i] + detailBoost + bright));
        data[i + 1] = clamp255(Math.round(copy[i + 1] + detailBoost + bright));
        data[i + 2] = clamp255(Math.round(copy[i + 2] + detailBoost + bright * 1.1));
      }
      break;
    }

    case 'slim-face':
    case 'body-slim':
    case 'body-reshape': {
      const cx = w * 0.5;
      const cy = h * (kind === 'slim-face' ? 0.38 : 0.54);
      const halfSpan = w * 0.42;
      const pull = amt * 0.16;
      for (let y = 0; y < h; y++) {
        const dy = Math.abs(y - cy) / (h * 0.48);
        const vWeight = Math.max(0, 1 - dy * dy);
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const nx = Math.abs(dx) / halfSpan;
          let sx = x;
          if (nx < 1 && vWeight > 0) {
            const bell = Math.sin(nx * Math.PI);
            sx = x + (dx >= 0 ? 1 : -1) * bell * vWeight * pull * halfSpan;
          }
          const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, y);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(sr));
          data[i + 1] = clamp255(Math.round(sg));
          data[i + 2] = clamp255(Math.round(sb));
        }
      }
      break;
    }

    case 'body-widen': {
      const cx = w * 0.5;
      const cy = h * 0.54;
      const halfSpan = w * 0.44;
      const push = amt * 0.16;
      for (let y = 0; y < h; y++) {
        const dy = Math.abs(y - cy) / (h * 0.48);
        const vWeight = Math.max(0, 1 - dy * dy);
        for (let x = 0; x < w; x++) {
          const dx = x - cx;
          const nx = Math.abs(dx) / halfSpan;
          let sx = x;
          if (nx < 1 && vWeight > 0) {
            const bell = Math.sin(nx * Math.PI);
            sx = x - (dx >= 0 ? 1 : -1) * bell * vWeight * push * halfSpan;
          }
          const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, y);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(sr));
          data[i + 1] = clamp255(Math.round(sg));
          data[i + 2] = clamp255(Math.round(sb));
        }
      }
      break;
    }

    case 'body-lengthen': {
      const stretch = 1 + amt * 0.14;
      const cy = h * 0.55;
      for (let y = 0; y < h; y++) {
        const sy = cy + (y - cy) / stretch;
        for (let x = 0; x < w; x++) {
          const [sr, sg, sb] = sampleBilinear(copy, w, h, x, sy);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(sr));
          data[i + 1] = clamp255(Math.round(sg));
          data[i + 2] = clamp255(Math.round(sb));
        }
      }
      break;
    }

    case 'enlarge-eyes': {
      const centers = [
        [w * 0.41, h * 0.38],
        [w * 0.59, h * 0.38],
      ];
      const maxR = Math.min(w, h) * 0.11;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let sx = x;
          let sy = y;
          for (const [ex, ey] of centers) {
            const dx = x - ex;
            const dy = y - ey;
            const d = Math.hypot(dx, dy);
            if (d < maxR && d > 0.001) {
              const rn = d / maxR;
              const nr = Math.pow(rn, 1 + amt * 0.45) * maxR;
              sx = ex + (dx / d) * nr;
              sy = ey + (dy / d) * nr;
            }
          }
          const [sr, sg, sb] = sampleBilinear(copy, w, h, sx, sy);
          const i = (y * w + x) * 4;
          data[i] = clamp255(Math.round(sr));
          data[i + 1] = clamp255(Math.round(sg));
          data[i + 2] = clamp255(Math.round(sb));
        }
      }
      break;
    }

    case 'bg-remove': {
      // Border-sampled color cutout with center saliency prior for subject preservation
      const samples: Array<[number, number, number]> = [];
      for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 24))) {
        const tIdx = x * 4;
        const bIdx = ((h - 1) * w + x) * 4;
        samples.push([copy[tIdx], copy[tIdx + 1], copy[tIdx + 2]]);
        samples.push([copy[bIdx], copy[bIdx + 1], copy[bIdx + 2]]);
      }
      for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 24))) {
        const lIdx = (y * w) * 4;
        const rIdx = (y * w + w - 1) * 4;
        samples.push([copy[lIdx], copy[lIdx + 1], copy[lIdx + 2]]);
        samples.push([copy[rIdx], copy[rIdx + 1], copy[rIdx + 2]]);
      }
      const tol = 28 + (1 - amt) * 95;
      const cx = w * 0.5;
      const cy = h * 0.48;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4;
          const r = copy[i], g = copy[i + 1], b = copy[i + 2];
          let minD = 999;
          for (let s = 0; s < samples.length; s++) {
            const d = Math.hypot(r - samples[s][0], g - samples[s][1], b - samples[s][2]);
            if (d < minD) minD = d;
          }
          const dx = (x - cx) / (w * 0.42);
          const dy = (y - cy) / (h * 0.46);
          const centerPrior = clamp01(1 - Math.hypot(dx, dy) * 0.65);
          const fgScore = clamp01((minD - tol * 0.65) / Math.max(12, tol * 0.55) + centerPrior * 0.25);
          data[i + 3] = clamp255(Math.round(copy[i + 3] * fgScore));
        }
      }
      break;
    }
  }
}

export function getHueGradientPreviewCss(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [rr, gg, bb] = hslToRgb(h, s, l);
  return `rgb(${rr}, ${gg}, ${bb})`;
}

// ---------- Live Brush Preview & Cutout Shape Helpers ----------

/**
 * Computes the exact canvas-space radius in pixels matching the cutout stroke diameter:
 * diameter = (brushSize / 420) * min(canvasW, canvasH)
 */
export function computeBrushPreviewRadiusCanvasPx(
  brushSize: number,
  canvasW: number,
  canvasH: number,
): number {
  const clampedSize = Math.max(1, Math.min(200, brushSize));
  const minDim = Math.max(1, Math.min(canvasW, canvasH));
  return Math.max(2, ((clampedSize / 420) * minDim) / 2);
}

/**
 * Computes radial gradient color-stop pairs [offset (0..1), alpha (0..1)] for the
 * white glowing brush preview disc combining Opacity (0..100) and Hardness (0..100).
 * - At hardness=100, bright solid core extends to ~94% radius with a crisp rim.
 * - At hardness=0, soft wide glow falls off gently all the way from center to rim.
 */
export function computeBrushPreviewGradientStops(
  hardness: number,
  opacity: number,
): Array<{ offset: number; alpha: number }> {
  const op = clamp01(opacity / 100);
  const h = clamp01(hardness / 100);
  const coreStop = Number((h * 0.94).toFixed(4));
  const midStop = Number((coreStop + (1 - coreStop) * 0.44).toFixed(4));

  if (coreStop <= 0.01) {
    return [
      { offset: 0, alpha: op },
      { offset: 0.35, alpha: op * 0.56 },
      { offset: 0.7, alpha: op * 0.18 },
      { offset: 1, alpha: 0 },
    ];
  }
  return [
    { offset: 0, alpha: op },
    { offset: coreStop, alpha: op * (0.88 + h * 0.12) },
    { offset: midStop, alpha: op * 0.4 },
    { offset: 1, alpha: 0 },
  ];
}

/**
 * Draws the live feathered white glowing disc preview onto an overlay preview canvas.
 */
export function renderBrushPreviewDisc(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  normX: number,
  normY: number,
  size: number,
  opacity: number,
  hardness: number,
): void {
  ctx.clearRect(0, 0, canvasW, canvasH);
  const cx = normX * canvasW;
  const cy = normY * canvasH;
  const r = computeBrushPreviewRadiusCanvasPx(size, canvasW, canvasH);
  const stops = computeBrushPreviewGradientStops(hardness, opacity);

  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  for (const s of stops) {
    grad.addColorStop(s.offset, `rgba(255, 255, 255, ${s.alpha.toFixed(4)})`);
  }

  ctx.save();
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawCutoutShapeMask(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  shape: OverlayCutoutShape,
): void {
  if (shape === 'none') {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, w, h);
    return;
  }

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#FFFFFF';
  const cx = w / 2;
  const cy = h / 2;
  const minD = Math.min(w, h);
  const r = minD * 0.46;

  ctx.beginPath();
  if (shape === 'circle') {
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
  } else if (shape === 'rounded') {
    ctx.roundRect(w * 0.04, h * 0.04, w * 0.92, h * 0.92, minD * 0.18);
  } else if (shape === 'diamond') {
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx + r, cy);
    ctx.lineTo(cx, cy + r);
    ctx.lineTo(cx - r, cy);
    ctx.closePath();
  } else if (shape === 'star') {
    const spikes = 5;
    for (let i = 0; i < spikes * 2; i++) {
      const ang = (i * Math.PI) / spikes - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.44;
      const sx = cx + Math.cos(ang) * rad;
      const sy = cy + Math.sin(ang) * rad;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.closePath();
  } else if (shape === 'heart') {
    const s = r * 0.95;
    ctx.moveTo(cx, cy + s * 0.78);
    ctx.bezierCurveTo(cx - s * 1.15, cy + s * 0.15, cx - s * 1.05, cy - s * 0.72, cx, cy - s * 0.25);
    ctx.bezierCurveTo(cx + s * 1.05, cy - s * 0.72, cx + s * 1.15, cy + s * 0.15, cx, cy + s * 0.78);
    ctx.closePath();
  }
  ctx.fill();
}

// ---------- Object-Hugging Alpha Contour Extraction & Border Renderer ----------

/**
 * Extracts closed contour polylines around opaque regions (alpha >= threshold)
 * using Marching Squares on a 1px zero-padded grid, handling erased cutouts,
 * concave limbs, BG-removed silhouettes, and interior erased holes.
 */
export function extractAlphaContours(
  alpha: Uint8Array,
  w: number,
  h: number,
  threshold = 128,
): Array<Array<{ x: number; y: number }>> {
  if (w < 2 || h < 2) return [];

  // Pad by 1px transparent border so opaque outer edges form closed loops cleanly
  const pw = w + 2;
  const ph = h + 2;
  const occ = new Uint8Array(pw * ph);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (alpha[y * w + x] >= threshold) {
        occ[(y + 1) * pw + (x + 1)] = 1;
      }
    }
  }

  // Quantize half-pixel vertex coordinates to integer grid keys (2x coordinates)
  const keyOf = (qx: number, qy: number) => `${qx},${qy}`;
  const adj = new Map<string, Array<{ sx: number; sy: number; ex: number; ey: number; used: boolean }>>();

  const addSeg = (x1: number, y1: number, x2: number, y2: number) => {
    const sx = Math.round(x1 * 2);
    const sy = Math.round(y1 * 2);
    const ex = Math.round(x2 * 2);
    const ey = Math.round(y2 * 2);
    if (sx === ex && sy === ey) return;
    const k = keyOf(sx, sy);
    let list = adj.get(k);
    if (!list) {
      list = [];
      adj.set(k, list);
    }
    list.push({ sx, sy, ex, ey, used: false });
  };

  // Marching squares cell edges (coordinates shifted back by -1 so image occupies 0..w, 0..h)
  // Edge midpoints: top(x+0.5, y), right(x+1, y+0.5), bottom(x+0.5, y+1), left(x, y+0.5)
  for (let cy = 0; cy < ph - 1; cy++) {
    for (let cx = 0; cx < pw - 1; cx++) {
      const tl = occ[cy * pw + cx];
      const tr = occ[cy * pw + cx + 1];
      const br = occ[(cy + 1) * pw + cx + 1];
      const bl = occ[(cy + 1) * pw + cx];
      const mask = (tl << 3) | (tr << 2) | (br << 1) | bl;
      if (mask === 0 || mask === 15) continue;

      const x = cx - 0.5;
      const y = cy - 0.5;
      const top: [number, number] = [x + 0.5, y];
      const right: [number, number] = [x + 1, y + 0.5];
      const bottom: [number, number] = [x + 0.5, y + 1];
      const left: [number, number] = [x, y + 0.5];

      switch (mask) {
        case 1:
          addSeg(...bottom, ...left);
          break;
        case 2:
          addSeg(...right, ...bottom);
          break;
        case 3:
          addSeg(...right, ...left);
          break;
        case 4:
          addSeg(...top, ...right);
          break;
        case 5:
          addSeg(...top, ...left);
          addSeg(...bottom, ...right);
          break;
        case 6:
          addSeg(...top, ...bottom);
          break;
        case 7:
          addSeg(...top, ...left);
          break;
        case 8:
          addSeg(...left, ...top);
          break;
        case 9:
          addSeg(...bottom, ...top);
          break;
        case 10:
          addSeg(...left, ...bottom);
          addSeg(...top, ...right);
          break;
        case 11:
          addSeg(...right, ...top);
          break;
        case 12:
          addSeg(...left, ...right);
          break;
        case 13:
          addSeg(...bottom, ...right);
          break;
        case 14:
          addSeg(...left, ...bottom);
          break;
      }
    }
  }

  const loops: Array<Array<{ x: number; y: number }>> = [];
  for (const [, list] of adj) {
    for (const startSeg of list) {
      if (startSeg.used) continue;
      const raw: Array<{ x: number; y: number }> = [];
      let cur: typeof startSeg | undefined = startSeg;
      let guard = 0;
      while (cur && !cur.used && guard < pw * ph) {
        cur.used = true;
        raw.push({ x: Math.max(0, Math.min(w, cur.sx / 2)), y: Math.max(0, Math.min(h, cur.sy / 2)) });
        const nextList = adj.get(keyOf(cur.ex, cur.ey));
        cur = nextList?.find((s) => !s.used);
        guard++;
      }
      if (raw.length >= 6) {
        loops.push(smoothClosedContour(raw));
      }
    }
  }

  return loops;
}

function smoothClosedContour(pts: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
  const n = pts.length;
  if (n <= 12) return pts;

  // Light Laplacian smoothing on interior vertices while preserving crisp corners
  const sm: Array<{ x: number; y: number }> = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    sm[i] = {
      x: curr.x * 0.5 + (prev.x + next.x) * 0.25,
      y: curr.y * 0.5 + (prev.y + next.y) * 0.25,
    };
  }

  const stride = n > 160 ? Math.max(2, Math.floor(n / 180)) : 1;
  if (stride <= 1) return sm;
  const out: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < n; i += stride) {
    out.push(sm[i]);
  }
  return out.length >= 4 ? out : sm;
}

/**
 * Composites `localCanvas` (which already includes pixel FX & erased/cutout alpha)
 * onto `fCtx` padded by `padB`, applies optional corner rounding, and strokes
 * any border width directly around the visible object's alpha contour.
 */
export function renderAlphaContourBorder(
  fCtx: CanvasRenderingContext2D,
  localCanvas: HTMLCanvasElement,
  ow: number,
  oh: number,
  padB: number,
  bw: number,
  border: OverlayBorderParams,
): void {
  const rad = border.radius > 0 ? Math.min(ow, oh) * (border.radius / 100) * 0.5 : 0;

  // 1. Draw the masked object (clipped by corner radius if set) at (padB, padB)
  fCtx.save();
  if (rad > 0) {
    fCtx.beginPath();
    fCtx.roundRect(padB, padB, ow, oh, rad);
    fCtx.clip();
  }
  fCtx.drawImage(localCanvas, padB, padB);
  fCtx.restore();

  if (bw <= 0) return;

  // 2. Extract contour from the actual composited alpha buffer (so erased edges & radius both outline cleanly)
  const w2 = ow + padB * 2;
  const h2 = oh + padB * 2;
  const imgData = fCtx.getImageData(0, 0, w2, h2);
  const alpha = new Uint8Array(w2 * h2);
  for (let i = 0, p = 3; i < alpha.length; i++, p += 4) {
    alpha[i] = imgData.data[p];
  }

  const contours = extractAlphaContours(alpha, w2, h2, 128);
  if (contours.length === 0) return;

  // 3. Stroke outline behind the opaque pixels ('destination-over') with width = bw * 2
  //    so opaque pixels cleanly cover the inner half and a crisp bw-wide outline hugs the exterior edge.
  fCtx.save();
  fCtx.globalCompositeOperation = 'destination-over';
  fCtx.strokeStyle = border.color || '#FFFFFF';
  fCtx.lineWidth = bw * 2;
  fCtx.lineJoin = 'round';
  fCtx.lineCap = 'round';
  if (border.style === 'dashed') {
    fCtx.setLineDash([bw * 2.5, bw * 1.7]);
  } else if (border.style === 'dotted') {
    fCtx.setLineDash([0.1, bw * 2.4]);
  }

  for (const loop of contours) {
    if (loop.length < 3) continue;
    fCtx.beginPath();
    const firstMidX = (loop[0].x + loop[1].x) * 0.5;
    const firstMidY = (loop[0].y + loop[1].y) * 0.5;
    fCtx.moveTo(firstMidX, firstMidY);
    for (let i = 1; i <= loop.length; i++) {
      const pCurr = loop[i % loop.length];
      const pNext = loop[(i + 1) % loop.length];
      const midX = (pCurr.x + pNext.x) * 0.5;
      const midY = (pCurr.y + pNext.y) * 0.5;
      fCtx.quadraticCurveTo(pCurr.x, pCurr.y, midX, midY);
    }
    fCtx.closePath();
    fCtx.stroke();
  }
  fCtx.restore();
}

// ---------- Live Effect Preview Thumbnail Generator ----------

const effectThumbCache = new Map<string, string>();

/**
 * Generates live square preview thumbnails (`dataUrl`) for effects using the user's actual photo
 * or overlay image so every Picsart effect tile shows a genuine visual preview before applying.
 */
export async function generateEffectThumbnails(
  sourceSrc: string,
  catalog: OverlayEffectDefinition[],
  size = 84,
  onBatchProgress?: (partial: Record<string, string>) => void,
): Promise<Record<string, string>> {
  if (typeof document === 'undefined' || !sourceSrc) return {};

  const out: Record<string, string> = {};
  const missing: OverlayEffectDefinition[] = [];
  for (const item of catalog) {
    const cacheKey = `${sourceSrc}::${size}::${item.kind}`;
    const cached = effectThumbCache.get(cacheKey);
    if (cached) out[item.kind] = cached;
    else missing.push(item);
  }
  if (missing.length === 0) return out;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = 'anonymous';
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to load thumbnail image'));
    i.src = sourceSrc;
  });

  // Center-crop square cover draw so every square tile looks crisp like IMG_4874
  const baseCanvas = document.createElement('canvas');
  baseCanvas.width = size;
  baseCanvas.height = size;
  const bCtx = baseCanvas.getContext('2d', { willReadFrequently: true });
  if (!bCtx) return out;

  const minSide = Math.min(img.naturalWidth || size, img.naturalHeight || size);
  const sx = ((img.naturalWidth || size) - minSide) / 2;
  const sy = ((img.naturalHeight || size) - minSide) / 2;
  bCtx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
  const baseImg = bCtx.getImageData(0, 0, size, size);

  const workCanvas = document.createElement('canvas');
  workCanvas.width = size;
  workCanvas.height = size;
  const wCtx = workCanvas.getContext('2d', { willReadFrequently: true });
  if (!wCtx) return out;

  const BATCH_SIZE = 8;
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const chunk = missing.slice(i, i + BATCH_SIZE);
    for (const item of chunk) {
      const buf = new Uint8ClampedArray(baseImg.data);
      applyOverlayEffectToPixels(buf, size, size, item.kind, Math.max(60, item.defaultIntensity));
      wCtx.putImageData(new ImageData(buf, size, size), 0, 0);
      const url = workCanvas.toDataURL('image/jpeg', 0.78);
      out[item.kind] = url;
      effectThumbCache.set(`${sourceSrc}::${size}::${item.kind}`, url);
    }
    if (onBatchProgress) {
      onBatchProgress({ ...out });
    }
    if (i + BATCH_SIZE < missing.length) {
      await new Promise<void>((resolve) => setTimeout(resolve, 0));
    }
  }

  return out;
}



