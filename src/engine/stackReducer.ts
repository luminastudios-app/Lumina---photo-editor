import type {
  AdjustmentsParams,
  BlurParams,
  CropParams,
  CurvesParams,
  DetailEffectsParams,
  EditLayer,
  FrameParams,
  HistoryStepEntry,
  HslBandKey,
  HslParams,
  LayerBaseProps,
  LayerMask,
  MaskKind,
  ShapeKind,
  ShapeParams,
  TextParams,
  ToneExtendedParams,
} from '../types/editor';

export function createDefaultAdjustments(): AdjustmentsParams {
  return {
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    whites: 0,
    blacks: 0,
    temperature: 0,
    tint: 0,
    saturation: 0,
    vibrance: 0,
    clarity: 0,
    dehaze: 0,
    sharpness: 0,
    grain: 0,
    vignette: 0,
    fade: 0,
    brightness: 0,
    gamma: 1,
  };
}

export function createDefaultToneExtended(): ToneExtendedParams {
  return {
    inputBlack: 0,
    gamma: 1,
    inputWhite: 255,
    outputBlack: 0,
    outputWhite: 255,
    brightness: 0,
    hueRotate: 0,
    selectiveColor: {
      targetHue: 0,
      range: 35,
      hueShift: 0,
      satShift: 0,
      lumShift: 0,
    },
    colorWheels: {
      shadows: { hue: 215, sat: 0, lum: 0 },
      midtones: { hue: 35, sat: 0, lum: 0 },
      highlights: { hue: 45, sat: 0, lum: 0 },
    },
    colorSplash: {
      enabled: false,
      targetHue: 10,
      targetHex: '#EF4444',
      tolerance: 28,
    },
    replaceColor: {
      enabled: false,
      sourceHex: '#3B82F6',
      targetHex: '#F59E0B',
      tolerance: 35,
      softness: 30,
    },
  };
}

export function createDefaultDetailEffects(): DetailEffectsParams {
  return {
    unsharpAmount: 0,
    unsharpRadius: 2,
    unsharpThreshold: 4,
    noiseLuma: 0,
    noiseChroma: 0,
    texture: 0,
    bloomAmount: 0,
    bloomRadius: 10,
    chromaticAberration: 0,
    halation: 0,
    lightLeak: 0,
    lightLeakStyle: 'amber-left',
    dustScratches: 0,
    lensDistortion: 0,
    perspectiveX: 0,
    perspectiveY: 0,
    picsartFx: [],
  };
}

export const HSL_BANDS: HslBandKey[] = [
  'red',
  'orange',
  'yellow',
  'green',
  'cyan',
  'blue',
  'purple',
  'magenta',
];

export function createDefaultHsl(): HslParams {
  return {
    bands: {
      red: { h: 0, s: 0, l: 0 },
      orange: { h: 0, s: 0, l: 0 },
      yellow: { h: 0, s: 0, l: 0 },
      green: { h: 0, s: 0, l: 0 },
      cyan: { h: 0, s: 0, l: 0 },
      blue: { h: 0, s: 0, l: 0 },
      purple: { h: 0, s: 0, l: 0 },
      magenta: { h: 0, s: 0, l: 0 },
    },
    splitToning: {
      shadowHue: 215,
      shadowSat: 0,
      highlightHue: 40,
      highlightSat: 0,
      balance: 0,
    },
  };
}

export function createDefaultCurves(): CurvesParams {
  return {
    rgb: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    r: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    g: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
    b: [
      { x: 0, y: 0 },
      { x: 255, y: 255 },
    ],
  };
}

export function createDefaultCrop(): CropParams {
  return {
    aspectPreset: 'free',
    cropRect: { x: 0, y: 0, w: 1, h: 1 },
    straighten: 0,
    rotate90: 0,
    flipH: false,
    flipV: false,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  };
}

export function createDefaultBlur(): BlurParams {
  return {
    mode: 'radial',
    amount: 0,
    feather: 45,
    centerX: 0.5,
    centerY: 0.5,
    radius: 0.32,
    angle: 0,
    bokehShape: 'circle',
  };
}

export function createDefaultFrame(): FrameParams {
  return {
    style: 'none',
    width: 28,
    color: '#FFFFFF',
    innerRadius: 0,
  };
}

export function createDefaultText(text = 'Golden Hour'): TextParams {
  return {
    text,
    fontFamily: 'Plus Jakarta Sans',
    fontSize: 52,
    fontWeight: 700,
    letterSpacing: 0,
    lineHeight: 1.22,
    textAlign: 'center',
    color: '#FFFFFF',
    gradientEnabled: false,
    gradientColor1: '#F59E0B',
    gradientColor2: '#EC4899',
    gradientAngle: 45,
    strokeColor: '#000000',
    strokeWidth: 0,
    shadowBlur: 12,
    shadowColor: 'rgba(0,0,0,0.65)',
    glowBlur: 0,
    glowColor: '#F59E0B',
    bgEnabled: false,
    bgColor: '#0B0C0F',
    curveAmount: 0,
    pathStyle: 'arc',
    animation: 'none',
    rotation: 0,
    x: 0.5,
    y: 0.5,
  };
}

export function createDefaultShape(kind: ShapeKind = 'rect'): ShapeParams {
  return {
    kind,
    fillColor: '#F59E0B',
    strokeColor: '#FFFFFF',
    strokeWidth: 0,
    cornerRadius: 16,
    size: 0.24,
    rotation: 0,
    opacity: 0.92,
    x: 0.5,
    y: 0.5,
  };
}

export function createDefaultLayerMask(kind: MaskKind = 'radial'): LayerMask {
  return {
    id: uid('mask'),
    name: `${kind} mask`,
    kind,
    enabled: true,
    inverted: false,
    feather: 22,
    refineEdge: 0,
    expand: 0,
    brushStrokes: [],
    gradient: { x1: 0.5, y1: 0.2, x2: 0.5, y2: 0.85, radius: 0.36 },
    luminosity: { min: 100, max: 255, softness: 40 },
    colorRange: { hex: '#3B82F6', tolerance: 35, softness: 20 },
    wand: { seedX: 0.5, seedY: 0.5, tolerance: 32, contiguous: true },
    polygonPoints: [],
  };
}

export function uid(prefix = 'layer'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export interface StackHistoryState {
  past: EditLayer[][];
  present: EditLayer[];
  future: EditLayer[][];
  entries: HistoryStepEntry[];
  cursor: number;
}

export function createInitialHistory(
  initial: EditLayer[] = [],
  label = 'Original Image',
): StackHistoryState {
  return {
    past: [],
    present: initial,
    future: [],
    entries: [{ label, timestamp: Date.now(), layers: initial }],
    cursor: 0,
  };
}

const MAX_HISTORY = 60;

export function commitLayers(
  state: StackHistoryState,
  next: EditLayer[],
  recordHistory = true,
  label = 'Edit Step',
): StackHistoryState {
  if (!recordHistory) {
    const entries = state.entries ? [...state.entries] : [{ label: 'Original', timestamp: Date.now(), layers: next }];
    if (entries[state.cursor ?? 0]) {
      entries[state.cursor ?? 0] = { ...entries[state.cursor ?? 0], layers: next };
    }
    return { ...state, present: next, entries };
  }
  const past = [...state.past, state.present].slice(-MAX_HISTORY);
  const head = (state.entries ?? []).slice(0, (state.cursor ?? 0) + 1);
  const entries = [...head, { label, timestamp: Date.now(), layers: next }].slice(-MAX_HISTORY - 1);
  return {
    past,
    present: next,
    future: [],
    entries,
    cursor: entries.length - 1,
  };
}

export function undoStack(state: StackHistoryState): StackHistoryState {
  if (state.past.length === 0) return state;
  const previous = state.past[state.past.length - 1];
  const nextCursor = Math.max(0, (state.cursor ?? state.past.length) - 1);
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future].slice(0, MAX_HISTORY),
    entries: state.entries ?? [],
    cursor: nextCursor,
  };
}

export function redoStack(state: StackHistoryState): StackHistoryState {
  if (state.future.length === 0) return state;
  const next = state.future[0];
  const nextCursor = Math.min((state.entries?.length ?? 1) - 1, (state.cursor ?? 0) + 1);
  return {
    past: [...state.past, state.present].slice(-MAX_HISTORY),
    present: next,
    future: state.future.slice(1),
    entries: state.entries ?? [],
    cursor: nextCursor,
  };
}

export function jumpToHistoryIndex(
  state: StackHistoryState,
  targetIndex: number,
): StackHistoryState {
  const entries = state.entries ?? [];
  if (targetIndex < 0 || targetIndex >= entries.length) return state;
  const past = entries.slice(0, targetIndex).map((e) => e.layers);
  const present = entries[targetIndex].layers;
  const future = entries.slice(targetIndex + 1).map((e) => e.layers);
  return {
    past,
    present,
    future,
    entries,
    cursor: targetIndex,
  };
}

export function reorderLayer(
  layers: EditLayer[],
  fromIndex: number,
  toIndex: number,
): EditLayer[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= layers.length ||
    toIndex >= layers.length ||
    fromIndex === toIndex
  ) {
    return layers;
  }
  const copy = [...layers];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function toggleLayer(layers: EditLayer[], id: string): EditLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, enabled: !l.enabled } : l));
}

export function toggleLayerLock(layers: EditLayer[], id: string): EditLayer[] {
  return layers.map((l) => (l.id === id ? { ...l, locked: !l.locked } : l));
}

export function removeLayer(layers: EditLayer[], id: string): EditLayer[] {
  const target = layers.find((l) => l.id === id);
  if (target?.locked) return layers;
  if (target?.type === 'group') {
    // Ungroup children rather than deleting them
    return layers
      .filter((l) => l.id !== id)
      .map((l) => (l.groupId === id ? { ...l, groupId: undefined } : l));
  }
  return layers.filter((l) => l.id !== id);
}

export function duplicateLayer(layers: EditLayer[], id: string): EditLayer[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx === -1) return layers;
  const orig = layers[idx];
  const clone = JSON.parse(JSON.stringify(orig)) as EditLayer;
  clone.id = uid(orig.type);
  clone.name = `${orig.name} Copy`;
  clone.locked = false;
  const copy = [...layers];
  copy.splice(idx + 1, 0, clone);
  return copy;
}

export function groupLayerWithBelow(layers: EditLayer[], id: string): EditLayer[] {
  const idx = layers.findIndex((l) => l.id === id);
  if (idx <= 0) return layers;
  const top = layers[idx];
  const below = layers[idx - 1];
  const grpId = uid('grp');
  const groupLayer: EditLayer = {
    id: grpId,
    type: 'group',
    name: `Group (${below.name})`,
    enabled: true,
    collapsed: false,
  };
  const updated = layers.map((l) =>
    l.id === top.id || l.id === below.id ? { ...l, groupId: grpId } : l,
  );
  updated.splice(idx + 1, 0, groupLayer);
  return updated;
}

export function updateLayerBase(
  layers: EditLayer[],
  id: string,
  patch: Partial<LayerBaseProps>,
): EditLayer[] {
  return layers.map((l) => (l.id === id ? ({ ...l, ...patch } as EditLayer) : l));
}

export function upsertSingletonLayer<T extends EditLayer['type']>(
  layers: EditLayer[],
  type: T,
  factory: () => Extract<EditLayer, { type: T }>,
  updater: (existing: Extract<EditLayer, { type: T }>) => Extract<EditLayer, { type: T }>,
): EditLayer[] {
  const idx = layers.findIndex((l) => l.type === type);
  if (idx === -1) {
    return [...layers, updater(factory())];
  }
  const existing = layers[idx];
  if (existing.locked) return layers;
  const copy = [...layers];
  copy[idx] = updater(existing as Extract<EditLayer, { type: T }>);
  return copy;
}
