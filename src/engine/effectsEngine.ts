import type { DetailEffectsParams } from '../types/editor';
import { clamp01, clamp255 } from './colorMath';

function fastBoxBlur(
  src: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
): Uint8ClampedArray {
  const rad = Math.max(1, Math.min(12, Math.round(radius)));
  const temp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const win = rad * 2 + 1;

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let kx = -rad; kx <= rad; kx++) {
      const xx = Math.max(0, Math.min(w - 1, kx));
      const idx = (y * w + xx) * 4;
      sr += src[idx];
      sg += src[idx + 1];
      sb += src[idx + 2];
    }
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      temp[idx] = Math.round(sr / win);
      temp[idx + 1] = Math.round(sg / win);
      temp[idx + 2] = Math.round(sb / win);
      temp[idx + 3] = src[idx + 3];

      const xOut = Math.max(0, x - rad);
      const xIn = Math.min(w - 1, x + rad + 1);
      const outIdx = (y * w + xOut) * 4;
      const inIdx = (y * w + xIn) * 4;
      sr += src[inIdx] - src[outIdx];
      sg += src[inIdx + 1] - src[outIdx + 1];
      sb += src[inIdx + 2] - src[outIdx + 2];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    let sr = 0;
    let sg = 0;
    let sb = 0;
    for (let ky = -rad; ky <= rad; ky++) {
      const yy = Math.max(0, Math.min(h - 1, ky));
      const idx = (yy * w + x) * 4;
      sr += temp[idx];
      sg += temp[idx + 1];
      sb += temp[idx + 2];
    }
    for (let y = 0; y < h; y++) {
      const idx = (y * w + x) * 4;
      out[idx] = Math.round(sr / win);
      out[idx + 1] = Math.round(sg / win);
      out[idx + 2] = Math.round(sb / win);
      out[idx + 3] = temp[idx + 3];

      const yOut = Math.max(0, y - rad);
      const yIn = Math.min(h - 1, y + rad + 1);
      const outIdx = (yOut * w + x) * 4;
      const inIdx = (yIn * w + x) * 4;
      sr += temp[inIdx] - temp[outIdx];
      sg += temp[inIdx + 1] - temp[outIdx + 1];
      sb += temp[inIdx + 2] - temp[outIdx + 2];
    }
  }

  return out;
}

/**
 * Pure pixel-buffer processor for Detail & Optical Effects:
 * - Lens distortion + Keystone perspective warp
 * - Luminance & Chroma Noise Reduction
 * - Texture (micro-contrast) & Unsharp Mask (amount, radius, threshold)
 * - Chromatic aberration, Bloom/Glow, Film Halation, Light Leaks, Dust & Scratches
 */
export function applyDetailEffectsBuffer(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  p: DetailEffectsParams,
): void {
  // 1. Geometric warp: lens distortion & keystone perspective
  if (p.lensDistortion !== 0 || p.perspectiveX !== 0 || p.perspectiveY !== 0) {
    const src = new Uint8ClampedArray(data);
    const k = -(p.lensDistortion / 100) * 0.42;
    const pxTilt = (p.perspectiveX / 45) * 0.28;
    const pyTilt = (p.perspectiveY / 45) * 0.28;
    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxR = Math.hypot(cx, cy);

    for (let y = 0; y < h; y++) {
      const ny = (y - cy) / cy;
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / cx;
        // Perspective keystone scaling
        const perspScaleX = 1 + ny * pyTilt;
        const perspScaleY = 1 + nx * pxTilt;
        let sxn = nx * perspScaleX;
        let syn = ny * perspScaleY;

        if (k !== 0) {
          const r2 = ((sxn * cx) ** 2 + (syn * cy) ** 2) / (maxR * maxR);
          const factor = 1 + k * r2;
          sxn *= factor;
          syn *= factor;
        }

        const sx = Math.round(cx + sxn * cx);
        const sy = Math.round(cy + syn * cy);
        const dstIdx = (y * w + x) * 4;
        if (sx >= 0 && sx < w && sy >= 0 && sy < h) {
          const sIdx = (sy * w + sx) * 4;
          data[dstIdx] = src[sIdx];
          data[dstIdx + 1] = src[sIdx + 1];
          data[dstIdx + 2] = src[sIdx + 2];
          data[dstIdx + 3] = src[sIdx + 3];
        } else {
          data[dstIdx] = 8;
          data[dstIdx + 1] = 9;
          data[dstIdx + 2] = 12;
          data[dstIdx + 3] = 255;
        }
      }
    }
  }

  // 2. Noise reduction: separate luminance & color (chroma) smoothing
  if (p.noiseLuma > 0 || p.noiseChroma > 0) {
    const blurred = fastBoxBlur(data, w, h, p.noiseChroma > 40 ? 2 : 1);
    const lumaAmt = clamp01(p.noiseLuma / 100) * 0.72;
    const chromaAmt = clamp01(p.noiseChroma / 100) * 0.88;

    for (let i = 0; i < data.length; i += 4) {
      const r0 = data[i];
      const g0 = data[i + 1];
      const b0 = data[i + 2];
      const rb = blurred[i];
      const gb = blurred[i + 1];
      const bb = blurred[i + 2];

      const y0 = 0.299 * r0 + 0.587 * g0 + 0.114 * b0;
      const cb0 = -0.168736 * r0 - 0.331264 * g0 + 0.5 * b0;
      const cr0 = 0.5 * r0 - 0.418688 * g0 - 0.081312 * b0;

      const yb = 0.299 * rb + 0.587 * gb + 0.114 * bb;
      const cbb = -0.168736 * rb - 0.331264 * gb + 0.5 * bb;
      const crb = 0.5 * rb - 0.418688 * gb - 0.081312 * bb;

      // Edge-preserving luminance blend
      const edgeFade = Math.max(0, 1 - Math.abs(y0 - yb) / 36);
      const yOut = y0 + (yb - y0) * lumaAmt * edgeFade;
      const cbOut = cb0 + (cbb - cb0) * chromaAmt;
      const crOut = cr0 + (crb - cr0) * chromaAmt;

      data[i] = clamp255(Math.round(yOut + 1.402 * crOut));
      data[i + 1] = clamp255(Math.round(yOut - 0.344136 * cbOut - 0.714136 * crOut));
      data[i + 2] = clamp255(Math.round(yOut + 1.772 * cbOut));
    }
  }

  // 3. Texture (micro-detail) & Unsharp Mask (radius + threshold)
  if (p.texture !== 0 || p.unsharpAmount > 0) {
    const texBlur = p.texture !== 0 ? fastBoxBlur(data, w, h, 1) : null;
    const usBlur = p.unsharpAmount > 0 ? fastBoxBlur(data, w, h, p.unsharpRadius) : null;
    const texAmt = (p.texture / 100) * 0.9;
    const usAmt = (p.unsharpAmount / 100) * 1.15;

    for (let i = 0; i < data.length; i += 4) {
      for (let ch = 0; ch < 3; ch++) {
        let v = data[i + ch];
        if (texBlur) {
          const detail = v - texBlur[i + ch];
          if (Math.abs(detail) < 38) {
            v += detail * texAmt;
          }
        }
        if (usBlur) {
          const diff = v - usBlur[i + ch];
          if (Math.abs(diff) >= p.unsharpThreshold) {
            v += diff * usAmt;
          }
        }
        data[i + ch] = clamp255(Math.round(v));
      }
    }
  }

  // 4. Chromatic aberration (radial R/B edge fringe)
  if (p.chromaticAberration !== 0) {
    const copy = new Uint8ClampedArray(data);
    const maxShift = (p.chromaticAberration / 100) * Math.max(2, Math.min(w, h) * 0.012);
    const cx = w * 0.5;
    const cy = h * 0.5;
    for (let y = 0; y < h; y++) {
      const dy = (y - cy) / Math.max(1, cy);
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / Math.max(1, cx);
        const rx = Math.max(0, Math.min(w - 1, Math.round(x - dx * maxShift)));
        const ry = Math.max(0, Math.min(h - 1, Math.round(y - dy * maxShift)));
        const bx = Math.max(0, Math.min(w - 1, Math.round(x + dx * maxShift)));
        const by = Math.max(0, Math.min(h - 1, Math.round(y + dy * maxShift)));
        const idx = (y * w + x) * 4;
        data[idx] = copy[(ry * w + rx) * 4];
        data[idx + 2] = copy[(by * w + bx) * 4 + 2];
      }
    }
  }

  // 5. Bloom / Glow & Film Halation
  if (p.bloomAmount > 0 || p.halation > 0) {
    const glowSrc = new Uint8ClampedArray(data.length);
    for (let i = 0; i < data.length; i += 4) {
      const lum = (0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]) / 255;
      const mask = clamp01((lum - 0.58) / 0.42);
      glowSrc[i] = Math.round(data[i] * mask);
      glowSrc[i + 1] = Math.round(data[i + 1] * mask);
      glowSrc[i + 2] = Math.round(data[i + 2] * mask);
      glowSrc[i + 3] = 255;
    }
    const blurredGlow = fastBoxBlur(glowSrc, w, h, Math.max(2, p.bloomRadius * 0.45));
    const bloomW = (p.bloomAmount / 100) * 0.9;
    const halW = (p.halation / 100) * 1.05;

    for (let i = 0; i < data.length; i += 4) {
      const br = blurredGlow[i];
      const bg = blurredGlow[i + 1];
      const bb = blurredGlow[i + 2];
      let r = data[i] + br * bloomW + (br * 1.15) * halW;
      let g = data[i + 1] + bg * bloomW + (br * 0.28) * halW;
      let b = data[i + 2] + bb * bloomW + (br * 0.06) * halW;
      data[i] = clamp255(Math.round(r));
      data[i + 1] = clamp255(Math.round(g));
      data[i + 2] = clamp255(Math.round(b));
    }
  }

  // 6. Film Light Leaks & Dust/Scratches
  if (p.lightLeak > 0 || p.dustScratches > 0) {
    const leakStrength = clamp01(p.lightLeak / 100) * 0.65;
    const dustThresh = 1 - clamp01(p.dustScratches / 100) * 0.008;

    for (let y = 0; y < h; y++) {
      const yn = y / Math.max(1, h);
      for (let x = 0; x < w; x++) {
        const xn = x / Math.max(1, w);
        const idx = (y * w + x) * 4;
        let r = data[idx];
        let g = data[idx + 1];
        let b = data[idx + 2];

        if (leakStrength > 0) {
          let lw = 0;
          let lr = 255;
          let lg = 128;
          let lb = 42;
          if (p.lightLeakStyle === 'amber-left') {
            lw = Math.pow(clamp01(1 - xn * 1.9), 1.8);
          } else if (p.lightLeakStyle === 'sunset-corner') {
            const d = Math.hypot(xn - 0.95, yn - 0.05);
            lw = Math.pow(clamp01(1 - d * 1.35), 2);
            lr = 255;
            lg = 92;
            lb = 68;
          } else {
            lw = Math.pow(clamp01(1 - Math.abs(xn - 0.85) * 3.2), 2);
            lr = 240;
            lg = 168;
            lb = 255;
          }
          const k = lw * leakStrength;
          r = r + (255 - r) * k * (lr / 255);
          g = g + (255 - g) * k * (lg / 255);
          b = b + (255 - b) * k * (lb / 255);
        }

        if (p.dustScratches > 0) {
          // Deterministic analog hairlines and white/dark dust specks
          let h1 = (x * 374761393 + y * 668265263) ^ 0x5bf03635;
          h1 = (h1 ^ (h1 >> 13)) * 1274126177;
          const rand = ((h1 ^ (h1 >> 16)) >>> 0) / 4294967295;
          const scratchLine =
            ((x * 131 + 17) % 197 === 0) && ((y + x) % 5 < 3) && rand > 0.72;
          if (rand > dustThresh || scratchLine) {
            const speck = rand > 0.997 ? 235 : 205;
            r = r * 0.3 + speck * 0.7;
            g = g * 0.3 + speck * 0.7;
            b = b * 0.3 + speck * 0.7;
          }
        }

        data[idx] = clamp255(Math.round(r));
        data[idx + 1] = clamp255(Math.round(g));
        data[idx + 2] = clamp255(Math.round(b));
      }
    }
  }
}
