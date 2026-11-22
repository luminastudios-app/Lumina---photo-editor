import type { CurvePoint, CurvesParams } from '../types/editor';

/**
 * Builds a 256-entry lookup table using Fritsch-Carlson monotonic cubic Hermite
 * interpolation so tone curves stay smooth and never overshoot into artifacts.
 */
export function buildCurveLUT(rawPoints: CurvePoint[]): Uint8Array {
  const lut = new Uint8Array(256);
  if (!rawPoints || rawPoints.length === 0) {
    for (let i = 0; i < 256; i++) lut[i] = i;
    return lut;
  }

  const sorted = [...rawPoints]
    .map((p) => ({
      x: Math.max(0, Math.min(255, p.x)),
      y: Math.max(0, Math.min(255, p.y)),
    }))
    .sort((a, b) => a.x - b.x);

  // Deduplicate identical x values keeping last
  const pts: CurvePoint[] = [];
  for (const p of sorted) {
    if (pts.length > 0 && Math.abs(pts[pts.length - 1].x - p.x) < 0.5) {
      pts[pts.length - 1] = p;
    } else {
      pts.push(p);
    }
  }

  if (pts.length === 1) {
    const val = Math.round(pts[0].y);
    lut.fill(val);
    return lut;
  }

  const n = pts.length;
  const dx: number[] = new Array(n - 1);
  const dy: number[] = new Array(n - 1);
  const m: number[] = new Array(n);

  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x || 1;
    dy[i] = pts[i + 1].y - pts[i].y;
  }

  const slopes = dx.map((d, i) => dy[i] / d);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];

  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) * 0.5;
    }
  }

  // Ensure monotonicity
  for (let i = 0; i < n - 1; i++) {
    if (Math.abs(slopes[i]) < 1e-6) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / slopes[i];
      const b = m[i + 1] / slopes[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * slopes[i];
        m[i + 1] = tau * b * slopes[i];
      }
    }
  }

  for (let x = 0; x < 256; x++) {
    if (x <= pts[0].x) {
      lut[x] = Math.round(pts[0].y);
      continue;
    }
    if (x >= pts[n - 1].x) {
      lut[x] = Math.round(pts[n - 1].y);
      continue;
    }

    let seg = 0;
    for (let i = 0; i < n - 1; i++) {
      if (x >= pts[i].x && x <= pts[i + 1].x) {
        seg = i;
        break;
      }
    }

    const h = dx[seg];
    const t = (x - pts[seg].x) / h;
    const t2 = t * t;
    const t3 = t2 * t;

    const h00 = 2 * t3 - 3 * t2 + 1;
    const h10 = t3 - 2 * t2 + t;
    const h01 = -2 * t3 + 3 * t2;
    const h11 = t3 - t2;

    const y =
      h00 * pts[seg].y +
      h10 * h * m[seg] +
      h01 * pts[seg + 1].y +
      h11 * h * m[seg + 1];

    lut[x] = Math.max(0, Math.min(255, Math.round(y)));
  }

  return lut;
}

export function buildCompositeCurveLUTs(curves: CurvesParams): {
  r: Uint8Array;
  g: Uint8Array;
  b: Uint8Array;
} {
  const rgbLut = buildCurveLUT(curves.rgb);
  const rLut = buildCurveLUT(curves.r);
  const gLut = buildCurveLUT(curves.g);
  const bLut = buildCurveLUT(curves.b);

  const r = new Uint8Array(256);
  const g = new Uint8Array(256);
  const b = new Uint8Array(256);

  for (let i = 0; i < 256; i++) {
    r[i] = rLut[rgbLut[i]];
    g[i] = gLut[rgbLut[i]];
    b[i] = bLut[rgbLut[i]];
  }

  return { r, g, b };
}
