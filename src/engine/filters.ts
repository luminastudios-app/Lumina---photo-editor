import type { AdjustmentsParams } from '../types/editor';
import { clamp01, clamp255 } from './colorMath';
import { createDefaultAdjustments } from './stackReducer';

export type FilterCategory =
  | 'All'
  | 'Favourites'
  | 'Signature'
  | 'Film'
  | 'Cinematic'
  | 'B&W'
  | 'Vintage'
  | 'Mood'
  | 'Warm'
  | 'Cool'
  | 'Punchy'
  | 'Faded'
  | 'Custom'
  | 'Plugin';

export interface FilterPreset {
  id: string;
  name: string;
  category: Exclude<FilterCategory, 'All' | 'Favourites'>;
  adjustments: Partial<AdjustmentsParams>;
  matrix?: number[];
  shadowTint?: [number, number, number];
  highlightTint?: [number, number, number];
  bw?: boolean;
  /** Optional third-party plugin pixel callback */
  pluginPixelFn?: (r: number, g: number, b: number) => [number, number, number];
}

export const FILTER_CATEGORIES: FilterCategory[] = [
  'All',
  'Favourites',
  'Signature',
  'Film',
  'Cinematic',
  'B&W',
  'Vintage',
  'Mood',
  'Warm',
  'Cool',
  'Punchy',
  'Faded',
  'Custom',
  'Plugin',
];

export const FILTER_PRESETS: FilterPreset[] = [
  {
    id: 'clarendon',
    name: 'Clarendon',
    category: 'Signature',
    adjustments: { contrast: 24, highlights: 12, shadows: -12, vibrance: 22, temperature: -8 },
    highlightTint: [255, 250, 240],
    shadowTint: [18, 32, 52],
  },
  {
    id: 'juno',
    name: 'Juno',
    category: 'Signature',
    adjustments: { contrast: 18, vibrance: 28, saturation: 12, temperature: 12, highlights: 8 },
    shadowTint: [20, 42, 48],
  },
  {
    id: 'lark',
    name: 'Lark',
    category: 'Signature',
    adjustments: { exposure: 10, shadows: 22, highlights: -14, vibrance: 14, temperature: -6, fade: 8 },
  },
  {
    id: 'gingham',
    name: 'Gingham',
    category: 'Faded',
    adjustments: { exposure: 8, contrast: -14, highlights: -18, saturation: -18, fade: 28 },
    highlightTint: [248, 236, 224],
  },
  {
    id: 'reyes',
    name: 'Reyes',
    category: 'Faded',
    adjustments: { exposure: 14, contrast: -18, saturation: -24, temperature: 16, fade: 34 },
  },
  {
    id: 'ludwig',
    name: 'Ludwig',
    category: 'Signature',
    adjustments: { contrast: 16, saturation: -8, temperature: 6, clarity: 18 },
  },
  {
    id: 'valencia',
    name: 'Valencia',
    category: 'Vintage',
    adjustments: { exposure: 6, contrast: 8, temperature: 24, fade: 18, saturation: 10 },
    highlightTint: [255, 235, 195],
  },
  {
    id: 'xpro2',
    name: 'X-Pro II',
    category: 'Vintage',
    adjustments: { contrast: 32, saturation: 20, vignette: -35, temperature: 10 },
    shadowTint: [14, 42, 68],
    highlightTint: [255, 238, 178],
  },
  {
    id: 'sierra',
    name: 'Sierra',
    category: 'Vintage',
    adjustments: { contrast: -10, shadows: 18, fade: 22, temperature: 12, vignette: -20 },
  },
  {
    id: 'mayfair',
    name: 'Mayfair',
    category: 'Signature',
    adjustments: { exposure: 8, contrast: 12, temperature: 10, vignette: -18, vibrance: 14 },
    highlightTint: [255, 232, 238],
  },
  {
    id: 'nashville',
    name: 'Nashville',
    category: 'Vintage',
    adjustments: { exposure: 12, contrast: 16, temperature: 18, tint: 14, fade: 18 },
    shadowTint: [34, 24, 62],
  },
  {
    id: 'portra400',
    name: 'Portra 400',
    category: 'Film',
    adjustments: { exposure: 8, contrast: 8, highlights: -14, shadows: 18, temperature: 14, vibrance: 12, fade: 14, grain: 16 },
    highlightTint: [255, 242, 225],
    shadowTint: [28, 34, 30],
  },
  {
    id: 'portra800',
    name: 'Portra 800',
    category: 'Film',
    adjustments: { exposure: 6, contrast: 14, temperature: 18, vibrance: 20, fade: 10, grain: 22 },
    highlightTint: [255, 236, 210],
  },
  {
    id: 'kodachrome64',
    name: 'Kodachrome 64',
    category: 'Film',
    adjustments: { contrast: 22, saturation: 18, clarity: 16, temperature: 10, blacks: -12, grain: 14 },
    matrix: [
      1.08, -0.04, -0.02,
      -0.02, 1.02, 0.0,
      -0.04, 0.02, 0.96,
    ],
  },
  {
    id: 'cinestill800t',
    name: 'Cinestill 800T',
    category: 'Film',
    adjustments: { contrast: 18, temperature: -24, tint: -8, highlights: 14, shadows: 10, grain: 22 },
    shadowTint: [12, 46, 62],
    highlightTint: [255, 215, 185],
  },
  {
    id: 'velvia50',
    name: 'Fuji Velvia 50',
    category: 'Film',
    adjustments: { contrast: 26, saturation: 34, vibrance: 24, blacks: -14, clarity: 14 },
  },
  {
    id: 'superia400',
    name: 'Fuji Superia',
    category: 'Film',
    adjustments: { contrast: 12, tint: -10, vibrance: 18, shadows: 14, grain: 18 },
    shadowTint: [18, 42, 34],
  },
  {
    id: 'polaroid600',
    name: 'Polaroid 600',
    category: 'Film',
    adjustments: { contrast: -8, fade: 32, temperature: 12, tint: 10, saturation: -10, grain: 18 },
    shadowTint: [24, 38, 34],
  },
  {
    id: 'gold200',
    name: 'Kodak Gold 200',
    category: 'Film',
    adjustments: { exposure: 8, temperature: 24, saturation: 16, contrast: 10, fade: 8, grain: 14 },
    highlightTint: [255, 232, 182],
  },
  {
    id: 'tealorange',
    name: 'Teal & Orange',
    category: 'Cinematic',
    adjustments: { contrast: 22, clarity: 18, vibrance: 18 },
    shadowTint: [10, 68, 86],
    highlightTint: [255, 196, 128],
  },
  {
    id: 'bleachbypass',
    name: 'Bleach Bypass',
    category: 'Cinematic',
    adjustments: { contrast: 42, saturation: -48, clarity: 28, highlights: 12, blacks: -14 },
  },
  {
    id: 'cyberdusk',
    name: 'Cyber Dusk',
    category: 'Cinematic',
    adjustments: { contrast: 20, temperature: -18, tint: 24, vibrance: 28, shadows: 10 },
    shadowTint: [34, 14, 68],
    highlightTint: [185, 245, 255],
  },
  {
    id: 'anamorphic',
    name: 'Anamorphic',
    category: 'Cinematic',
    adjustments: { contrast: 16, blacks: -10, fade: 14, temperature: -12, vignette: -26 },
    shadowTint: [16, 36, 48],
  },
  {
    id: 'blockbuster',
    name: 'Blockbuster',
    category: 'Cinematic',
    adjustments: { contrast: 28, highlights: -10, blacks: -12, clarity: 22, vibrance: 18 },
    shadowTint: [12, 48, 62],
    highlightTint: [255, 214, 165],
  },
  {
    id: 'moon',
    name: 'Moon',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: 18, exposure: 6, shadows: 14, fade: 12 },
  },
  {
    id: 'willow',
    name: 'Willow',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: -6, exposure: 10, fade: 26, temperature: 12 },
    highlightTint: [246, 238, 244],
  },
  {
    id: 'ilfordhp5',
    name: 'Ilford HP5',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: 28, clarity: 20, blacks: -10, grain: 26 },
  },
  {
    id: 'trix400',
    name: 'Tri-X 400',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: 40, blacks: -18, whites: 16, clarity: 24, grain: 30 },
  },
  {
    id: 'noir',
    name: 'Silver Noir',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: 46, shadows: -20, highlights: 18, vignette: -38 },
  },
  {
    id: 'carbonmono',
    name: 'Carbon Matte',
    category: 'B&W',
    bw: true,
    adjustments: { contrast: 16, fade: 30, clarity: 14, grain: 16 },
  },
  {
    id: 'goldenhour',
    name: 'Golden Hour',
    category: 'Warm',
    adjustments: { exposure: 8, temperature: 32, contrast: 10, vibrance: 22, fade: 8 },
    highlightTint: [255, 218, 152],
  },
  {
    id: 'terracotta',
    name: 'Terracotta Sun',
    category: 'Warm',
    adjustments: { temperature: 28, tint: 8, contrast: 16, highlights: -10, vibrance: 18 },
    shadowTint: [48, 22, 16],
  },
  {
    id: 'honeydust',
    name: 'Honey Dust',
    category: 'Warm',
    adjustments: { exposure: 10, temperature: 22, fade: 22, saturation: -6 },
    highlightTint: [255, 232, 178],
  },
  {
    id: 'arctic',
    name: 'Arctic',
    category: 'Cool',
    adjustments: { exposure: 10, temperature: -28, contrast: 12, highlights: 10, saturation: -14 },
    shadowTint: [22, 46, 78],
  },
  {
    id: 'nordicmist',
    name: 'Nordic Mist',
    category: 'Cool',
    adjustments: { temperature: -22, contrast: -8, fade: 24, saturation: -20, clarity: 12 },
    shadowTint: [24, 42, 56],
  },
  {
    id: 'cobaltice',
    name: 'Cobalt Night',
    category: 'Cool',
    adjustments: { exposure: -6, contrast: 22, temperature: -32, tint: 6, clarity: 18 },
    shadowTint: [14, 28, 68],
  },
  {
    id: 'hyperpop',
    name: 'Hyper Pop',
    category: 'Punchy',
    adjustments: { contrast: 32, vibrance: 42, saturation: 24, clarity: 24, blacks: -12 },
  },
  {
    id: 'neonvivid',
    name: 'Neon Vivid',
    category: 'Punchy',
    adjustments: { contrast: 28, saturation: 34, vibrance: 36, highlights: 14, shadows: 12 },
  },
  {
    id: 'editorialcrisp',
    name: 'Editorial Crisp',
    category: 'Punchy',
    adjustments: { contrast: 24, clarity: 28, sharpness: 24, vibrance: 16, blacks: -10 },
  },
  {
    id: 'espresso',
    name: 'Espresso',
    category: 'Mood',
    adjustments: { contrast: 20, blacks: -14, temperature: 18, saturation: -20, fade: 16, vignette: -24 },
    shadowTint: [44, 26, 18],
  },
  {
    id: 'mattepastel',
    name: 'Matte Pastel',
    category: 'Faded',
    adjustments: { exposure: 12, contrast: -16, highlights: -20, shadows: 24, fade: 34, saturation: -16 },
  },
  {
    id: 'velvetfade',
    name: 'Velvet Fade',
    category: 'Faded',
    adjustments: { contrast: -12, fade: 38, blacks: 14, saturation: -12, temperature: 8 },
    shadowTint: [34, 28, 42],
  },
  {
    id: 'emerald',
    name: 'Emerald Forest',
    category: 'Mood',
    adjustments: { contrast: 18, temperature: -10, tint: -16, clarity: 16, vignette: -20 },
    shadowTint: [12, 42, 34],
  },
  {
    id: 'obsidian',
    name: 'Obsidian Moody',
    category: 'Mood',
    adjustments: { exposure: -10, contrast: 28, blacks: -22, saturation: -22, clarity: 22, vignette: -32 },
  },
];

// Plugin registry for third-party / user-imported custom filter modules
const pluginPresets: FilterPreset[] = [];

export function registerFilterPlugin(preset: Omit<FilterPreset, 'category'> & { category?: FilterPreset['category'] }): FilterPreset {
  const normalized: FilterPreset = {
    ...preset,
    category: preset.category ?? 'Plugin',
  };
  const existingIdx = pluginPresets.findIndex((p) => p.id === normalized.id);
  if (existingIdx >= 0) pluginPresets[existingIdx] = normalized;
  else pluginPresets.push(normalized);
  return normalized;
}

export function unregisterFilterPlugin(id: string): void {
  const idx = pluginPresets.findIndex((p) => p.id === id);
  if (idx >= 0) pluginPresets.splice(idx, 1);
}

export function getAllFilterPresets(extraCustom: FilterPreset[] = []): FilterPreset[] {
  return [...FILTER_PRESETS, ...pluginPresets, ...extraCustom];
}

export function attachLuminaPluginGlobal(): void {
  if (typeof window === 'undefined') return;
  const w = window as unknown as {
    LuminaStudio?: {
      registerFilter: typeof registerFilterPlugin;
      unregisterFilter: typeof unregisterFilterPlugin;
      getPresets: () => FilterPreset[];
    };
  };
  w.LuminaStudio = {
    registerFilter: registerFilterPlugin,
    unregisterFilter: unregisterFilterPlugin,
    getPresets: () => getAllFilterPresets(),
  };
}

export function applyFilterPresetPixel(
  r: number,
  g: number,
  b: number,
  preset: FilterPreset,
  intensity: number,
): [number, number, number] {
  const t = clamp01(intensity / 100);
  if (t <= 0) return [r, g, b];

  if (preset.pluginPixelFn) {
    const [pr, pg, pb] = preset.pluginPixelFn(r, g, b);
    return [
      clamp255(Math.round(r + (pr - r) * t)),
      clamp255(Math.round(g + (pg - g) * t)),
      clamp255(Math.round(b + (pb - b) * t)),
    ];
  }

  let outR = r;
  let outG = g;
  let outB = b;

  if (preset.bw) {
    const l = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
    outR = l;
    outG = l;
    outB = l;
  }

  if (preset.matrix) {
    const m = preset.matrix;
    const mr = outR * m[0] + outG * m[1] + outB * m[2];
    const mg = outR * m[3] + outG * m[4] + outB * m[5];
    const mb = outR * m[6] + outG * m[7] + outB * m[8];
    outR = mr;
    outG = mg;
    outB = mb;
  }

  const adj = { ...createDefaultAdjustments(), ...preset.adjustments };
  let rn = outR / 255;
  let gn = outG / 255;
  let bn = outB / 255;

  if (adj.exposure !== 0) {
    const mult = Math.pow(2, adj.exposure / 55);
    rn *= mult;
    gn *= mult;
    bn *= mult;
  }
  if (adj.temperature !== 0 || adj.tint !== 0) {
    const temp = adj.temperature / 100;
    const tint = adj.tint / 100;
    rn *= 1 + temp * 0.2 + tint * 0.08;
    gn *= 1 - tint * 0.12;
    bn *= 1 - temp * 0.2 + tint * 0.08;
  }

  const lum = clamp01(0.299 * rn + 0.587 * gn + 0.114 * bn);
  let delta = 0;
  if (adj.shadows !== 0) delta += (adj.shadows / 100) * 0.3 * Math.pow(1 - lum, 2.1);
  if (adj.highlights !== 0) delta += (adj.highlights / 100) * 0.28 * Math.pow(lum, 2.0);
  if (adj.blacks !== 0) delta += (adj.blacks / 100) * 0.2 * Math.pow(1 - lum, 3.8);
  if (adj.whites !== 0) delta += (adj.whites / 100) * 0.2 * Math.pow(lum, 3.5);
  rn += delta;
  gn += delta;
  bn += delta;

  if (adj.contrast !== 0) {
    const c = adj.contrast / 100;
    const factor = c >= 0 ? 1 + c * 1.1 : 1 + c * 0.6;
    rn = (rn - 0.5) * factor + 0.5;
    gn = (gn - 0.5) * factor + 0.5;
    bn = (bn - 0.5) * factor + 0.5;
  }

  if (adj.saturation !== 0 || adj.vibrance !== 0) {
    const gray = 0.299 * rn + 0.587 * gn + 0.114 * bn;
    const sat = Math.max(rn, gn, bn) - Math.min(rn, gn, bn);
    const boost = adj.saturation / 100 + (adj.vibrance / 100) * (1 - clamp01(sat)) * 0.75;
    const mult = Math.max(0, 1 + boost);
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

  outR = rn * 255;
  outG = gn * 255;
  outB = bn * 255;

  if (preset.shadowTint) {
    const sw = Math.pow(1 - lum, 2) * 0.26;
    outR = outR * (1 - sw) + preset.shadowTint[0] * sw;
    outG = outG * (1 - sw) + preset.shadowTint[1] * sw;
    outB = outB * (1 - sw) + preset.shadowTint[2] * sw;
  }
  if (preset.highlightTint) {
    const hw = Math.pow(lum, 2) * 0.22;
    outR = outR * (1 - hw) + preset.highlightTint[0] * hw;
    outG = outG * (1 - hw) + preset.highlightTint[1] * hw;
    outB = outB * (1 - hw) + preset.highlightTint[2] * hw;
  }

  return [
    clamp255(Math.round(r + (outR - r) * t)),
    clamp255(Math.round(g + (outG - g) * t)),
    clamp255(Math.round(b + (outB - b) * t)),
  ];
}
