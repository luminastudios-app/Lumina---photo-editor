import type {
  AdjustmentsParams,
  HslBandKey,
  HslParams,
  ToneExtendedParams,
} from '../types/editor';

export function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) * 0.5;
  if (max === min) {
    return [0, 0, l];
  }
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return [h * 60, s, l];
}

function hue2rgb(p: number, q: number, t: number): number {
  let tt = t;
  if (tt < 0) tt += 1;
  if (tt > 1) tt -= 1;
  if (tt < 1 / 6) return p + (q - p) * 6 * tt;
  if (tt < 1 / 2) return q;
  if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
  return p;
}

export function hslToRgb(hDeg: number, s: number, l: number): [number, number, number] {
  const h = (((hDeg % 360) + 360) % 360) / 360;
  const sc = clamp01(s);
  const lc = clamp01(l);
  if (sc === 0) {
    const v = Math.round(lc * 255);
    return [v, v, v];
  }
  const q = lc < 0.5 ? lc * (1 + sc) : lc + sc - lc * sc;
  const p = 2 * lc - q;
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}

const BAND_CENTERS: Record<HslBandKey, number> = {
  red: 0,
  orange: 30,
  yellow: 60,
  green: 120,
  cyan: 180,
  blue: 240,
  purple: 280,
  magenta: 325,
};

const BAND_WIDTHS: Record<HslBandKey, number> = {
  red: 34,
  orange: 30,
  yellow: 35,
  green: 55,
  cyan: 50,
  blue: 48,
  purple: 40,
  magenta: 40,
};

export function circularHueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * White balance eyedropper solver: converts a sampled neutral pixel RGB into
 * calibrated temperature and tint adjustments (-100..100).
 */
export function solveWhiteBalanceFromSample(
  r: number,
  g: number,
  b: number,
): { temperature: number; tint: number } {
  const avg = Math.max(12, (r + g + b) / 3);
  const temp = Math.round(Math.max(-100, Math.min(100, ((b - r) / avg) * 140)));
  const tint = Math.round(Math.max(-100, Math.min(100, ((g - (r + b) * 0.5) / avg) * 140)));
  return { temperature: temp, tint };
}

export function applyHslAndSplitTonePixel(
  r: number,
  g: number,
  b: number,
  hsl: HslParams,
): [number, number, number] {
  let [h, s, l] = rgbToHsl(r, g, b);

  if (s > 0.015) {
    let dh = 0;
    let ds = 0;
    let dl = 0;
    const keys = Object.keys(BAND_CENTERS) as HslBandKey[];
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const band = hsl.bands[k];
      if (band.h === 0 && band.s === 0 && band.l === 0) continue;
      const dist = circularHueDist(h, BAND_CENTERS[k]);
      const width = BAND_WIDTHS[k];
      if (dist < width) {
        const w = 0.5 * (1 + Math.cos((Math.PI * dist) / width));
        dh += band.h * w;
        ds += (band.s / 100) * w;
        dl += (band.l / 100) * w;
      }
    }
    h = (h + dh + 360) % 360;
    s = clamp01(s * (1 + ds));
    l = clamp01(l + dl * 0.45 * (1 - Math.abs(2 * l - 1) * 0.5));
  }

  let [outR, outG, outB] = hslToRgb(h, s, l);

  const st = hsl.splitToning;
  if (st.shadowSat > 0 || st.highlightSat > 0) {
    const lum = (0.299 * outR + 0.587 * outG + 0.114 * outB) / 255;
    const pivot = clamp01(0.5 + st.balance / 220);
    const [sr, sg, sb] = hslToRgb(st.shadowHue, 0.75, 0.5);
    const [hr, hg, hb] = hslToRgb(st.highlightHue, 0.75, 0.5);

    if (st.shadowSat > 0 && lum < pivot) {
      const w = ((pivot - lum) / Math.max(0.05, pivot)) * (st.shadowSat / 100) * 0.45;
      outR = outR * (1 - w) + sr * w;
      outG = outG * (1 - w) + sg * w;
      outB = outB * (1 - w) + sb * w;
    }
    if (st.highlightSat > 0 && lum > pivot) {
      const w = ((lum - pivot) / Math.max(0.05, 1 - pivot)) * (st.highlightSat / 100) * 0.45;
      outR = outR * (1 - w) + hr * w;
      outG = outG * (1 - w) + hg * w;
      outB = outB * (1 - w) + hb * w;
    }
  }

  return [clamp255(Math.round(outR)), clamp255(Math.round(outG)), clamp255(Math.round(outB))];
}

/**
 * Applies exposure, brightness, gamma, contrast, highlights, shadows, whites, blacks,
 * temperature, tint, saturation, vibrance, dehaze, and fade to a single pixel.
 */
export function applyToneAndColorPixel(
  r: number,
  g: number,
  b: number,
  adj: AdjustmentsParams,
): [number, number, number] {
  let rn = r / 255;
  let gn = g / 255;
  let bn = b / 255;

  if (adj.exposure !== 0) {
    const mult = Math.pow(2, adj.exposure / 50);
    rn *= mult;
    gn *= mult;
    bn *= mult;
  }

  if (adj.brightness && adj.brightness !== 0) {
    const shift = (adj.brightness / 100) * 0.35;
    rn += shift;
    gn += shift;
    bn += shift;
  }

  if (adj.gamma && Math.abs(adj.gamma - 1) > 0.01) {
    const invG = 1 / Math.max(0.2, adj.gamma);
    rn = Math.pow(clamp01(rn), invG);
    gn = Math.pow(clamp01(gn), invG);
    bn = Math.pow(clamp01(bn), invG);
  }

  if (adj.temperature !== 0 || adj.tint !== 0) {
    const temp = adj.temperature / 100;
    const tint = adj.tint / 100;
    rn *= 1 + temp * 0.22 + tint * 0.08;
    gn *= 1 - tint * 0.14;
    bn *= 1 - temp * 0.22 + tint * 0.08;
  }

  if (adj.dehaze !== 0) {
    const dh = adj.dehaze / 100;
    if (dh > 0) {
      const blackLift = dh * 0.12;
      const scale = 1 / (1 - blackLift);
      rn = (rn - blackLift) * scale;
      gn = (gn - blackLift) * scale;
      bn = (bn - blackLift) * scale;
    } else {
      const haze = -dh * 0.22;
      rn = rn * (1 - haze) + haze * 0.92;
      gn = gn * (1 - haze) + haze * 0.94;
      bn = bn * (1 - haze) + haze * 0.98;
    }
  }

  const lum = clamp01(0.299 * rn + 0.587 * gn + 0.114 * bn);
  let delta = 0;

  if (adj.shadows !== 0) {
    const sMask = Math.pow(1 - lum, 2.2);
    delta += (adj.shadows / 100) * 0.35 * sMask;
  }
  if (adj.highlights !== 0) {
    const hMask = Math.pow(lum, 2.0);
    delta += (adj.highlights / 100) * 0.32 * hMask;
  }
  if (adj.blacks !== 0) {
    const bMask = Math.pow(1 - lum, 4.0);
    delta += (adj.blacks / 100) * 0.22 * bMask;
  }
  if (adj.whites !== 0) {
    const wMask = Math.pow(lum, 3.6);
    delta += (adj.whites / 100) * 0.22 * wMask;
  }

  if (delta !== 0) {
    rn += delta;
    gn += delta;
    bn += delta;
  }

  if (adj.contrast !== 0) {
    const c = adj.contrast / 100;
    const factor = c >= 0 ? 1 + c * 1.15 : 1 + c * 0.65;
    rn = (rn - 0.5) * factor + 0.5;
    gn = (gn - 0.5) * factor + 0.5;
    bn = (bn - 0.5) * factor + 0.5;
  }

  if (adj.saturation !== 0 || adj.vibrance !== 0) {
    const gray = 0.299 * rn + 0.587 * gn + 0.114 * bn;
    const maxC = Math.max(rn, gn, bn);
    const minC = Math.min(rn, gn, bn);
    const curSat = maxC - minC;

    let satBoost = adj.saturation / 100;
    if (adj.vibrance !== 0) {
      const skinProtect = rn > gn && gn > bn ? 0.55 : 1.0;
      satBoost += (adj.vibrance / 100) * (1 - clamp01(curSat)) * 0.85 * skinProtect;
    }

    const mult = Math.max(0, 1 + satBoost);
    rn = gray + (rn - gray) * mult;
    gn = gray + (gn - gray) * mult;
    bn = gray + (bn - gray) * mult;
  }

  if (adj.fade > 0) {
    const f = (adj.fade / 100) * 0.24;
    rn = f + rn * (1 - f * 0.85);
    gn = f + gn * (1 - f * 0.85);
    bn = f * 1.05 + bn * (1 - f * 0.85);
  }

  return [
    clamp255(Math.round(rn * 255)),
    clamp255(Math.round(gn * 255)),
    clamp255(Math.round(bn * 255)),
  ];
}

/**
 * Extended Tone & Color pixel evaluation:
 * Levels (input black/white/gamma, output black/white), brightness,
 * global hue rotation, selective color hue targeting, and 3-way color grading wheels.
 */
export function applyToneExtendedPixel(
  r: number,
  g: number,
  b: number,
  t: ToneExtendedParams,
): [number, number, number] {
  const inRange = Math.max(1, t.inputWhite - t.inputBlack);
  const outMin = t.outputBlack / 255;
  const outMax = t.outputWhite / 255;
  const invGamma = 1 / Math.max(0.2, t.gamma);
  const brightShift = (t.brightness / 100) * 0.35;

  const mapLevel = (v: number) => {
    const norm = clamp01((v - t.inputBlack) / inRange);
    const gamm = Math.pow(norm, invGamma);
    return clamp01(outMin + gamm * (outMax - outMin) + brightShift);
  };

  let rn = mapLevel(r);
  let gn = mapLevel(g);
  let bn = mapLevel(b);

  // Hue rotation & selective hue targeting
  const sel = t.selectiveColor;
  const hasSelective = sel.hueShift !== 0 || sel.satShift !== 0 || sel.lumShift !== 0;
  if (t.hueRotate !== 0 || hasSelective) {
    let [h, s, l] = rgbToHsl(rn * 255, gn * 255, bn * 255);
    if (hasSelective && s > 0.04) {
      const dist = circularHueDist(h, sel.targetHue);
      if (dist < sel.range) {
        const w = 0.5 * (1 + Math.cos((Math.PI * dist) / sel.range));
        h = (h + sel.hueShift * w + 360) % 360;
        s = clamp01(s * (1 + (sel.satShift / 100) * w));
        l = clamp01(l + (sel.lumShift / 100) * 0.45 * w);
      }
    }
    if (t.hueRotate !== 0) {
      h = (h + t.hueRotate + 360) % 360;
    }
    const [hr, hg, hb] = hslToRgb(h, s, l);
    rn = hr / 255;
    gn = hg / 255;
    bn = hb / 255;
  }

  // 3-way color grading wheels (Shadows, Midtones, Highlights)
  const cw = t.colorWheels;
  const hasWheels =
    cw.shadows.sat > 0 ||
    cw.shadows.lum !== 0 ||
    cw.midtones.sat > 0 ||
    cw.midtones.lum !== 0 ||
    cw.highlights.sat > 0 ||
    cw.highlights.lum !== 0;

  if (hasWheels) {
    const lum = clamp01(0.299 * rn + 0.587 * gn + 0.114 * bn);
    const wShad = Math.pow(1 - lum, 2.2);
    const wHigh = Math.pow(lum, 2.2);
    const wMid = Math.max(0, 1 - Math.abs(lum - 0.5) * 2);

    const applyWheel = (
      wheel: { hue: number; sat: number; lum: number },
      zoneWeight: number,
    ) => {
      if (wheel.sat > 0) {
        const [tr, tg, tb] = hslToRgb(wheel.hue, 0.85, 0.5);
        const mix = (wheel.sat / 100) * 0.35 * zoneWeight;
        rn = rn * (1 - mix) + (tr / 255) * mix;
        gn = gn * (1 - mix) + (tg / 255) * mix;
        bn = bn * (1 - mix) + (tb / 255) * mix;
      }
      if (wheel.lum !== 0) {
        const lShift = (wheel.lum / 50) * 0.16 * zoneWeight;
        rn += lShift;
        gn += lShift;
        bn += lShift;
      }
    };

    applyWheel(cw.shadows, wShad);
    applyWheel(cw.midtones, wMid);
    applyWheel(cw.highlights, wHigh);
  }

  let outR = clamp255(Math.round(rn * 255));
  let outG = clamp255(Math.round(gn * 255));
  let outB = clamp255(Math.round(bn * 255));

  if (t.replaceColor?.enabled) {
    [outR, outG, outB] = applyReplaceColorPixel(
      outR,
      outG,
      outB,
      t.replaceColor.sourceHex,
      t.replaceColor.targetHex,
      t.replaceColor.tolerance,
      t.replaceColor.softness,
    );
  }

  if (t.colorSplash?.enabled) {
    [outR, outG, outB] = applyColorSplashPixel(
      outR,
      outG,
      outB,
      t.colorSplash.targetHue,
      t.colorSplash.tolerance,
    );
  }

  return [outR, outG, outB];
}

export function hexToRgbTuple(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    return [
      parseInt(clean[0] + clean[0], 16) || 0,
      parseInt(clean[1] + clean[1], 16) || 0,
      parseInt(clean[2] + clean[2], 16) || 0,
    ];
  }
  return [
    parseInt(clean.slice(0, 2), 16) || 0,
    parseInt(clean.slice(2, 4), 16) || 0,
    parseInt(clean.slice(4, 6), 16) || 0,
  ];
}

export function rgbToHexString(r: number, g: number, b: number): string {
  return (
    '#' +
    [clamp255(Math.round(r)), clamp255(Math.round(g)), clamp255(Math.round(b))]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

/**
 * Colour Splash: preserves the chosen target hue within tolerance and smoothly
 * desaturates all other colours into monochrome luminance.
 */
export function applyColorSplashPixel(
  r: number,
  g: number,
  b: number,
  targetHue: number,
  tolerance: number,
): [number, number, number] {
  const [h, s] = rgbToHsl(r, g, b);
  const gray = 0.299 * r + 0.587 * g + 0.114 * b;
  if (s < 0.06) {
    const gVal = clamp255(Math.round(gray));
    return [gVal, gVal, gVal];
  }
  const tol = Math.max(4, tolerance);
  const dist = circularHueDist(h, targetHue);
  const softEdge = Math.max(8, tol * 0.45);
  const keep = clamp01(1 - (dist - tol) / softEdge);
  return [
    clamp255(Math.round(gray + (r - gray) * keep)),
    clamp255(Math.round(gray + (g - gray) * keep)),
    clamp255(Math.round(gray + (b - gray) * keep)),
  ];
}

/**
 * Replace Colour: swaps pixels close to sourceHex toward targetHex hue/saturation
 * while preserving the underlying pixel lightness so highlights & shadows stay natural.
 */
export function applyReplaceColorPixel(
  r: number,
  g: number,
  b: number,
  sourceHex: string,
  targetHex: string,
  tolerance: number,
  softness = 30,
): [number, number, number] {
  const [sr, sg, sb] = hexToRgbTuple(sourceHex);
  const [tr, tg, tb] = hexToRgbTuple(targetHex);
  const dist = Math.hypot(r - sr, g - sg, b - sb);
  const maxD = (tolerance / 100) * 230 + 10;
  const soft = Math.max(8, (softness / 100) * 140);
  const weight = clamp01(1 - (dist - maxD) / soft);
  if (weight <= 0.002) return [r, g, b];

  const [origH, origS, origL] = rgbToHsl(r, g, b);
  const [targH, targS] = rgbToHsl(tr, tg, tb);

  // Shortest hue blend + adapt saturation smoothly
  let dh = targH - origH;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const newH = (origH + dh * weight + 360) % 360;
  const newS = clamp01(origS * (1 - weight) + Math.max(origS * 0.55, targS) * weight);
  const [nr, ng, nb] = hslToRgb(newH, newS, origL);
  return [nr, ng, nb];
}

