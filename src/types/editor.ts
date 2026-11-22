export type ToolId =
  | 'adjust'
  | 'color'
  | 'curves'
  | 'effects'
  | 'filters'
  | 'masks'
  | 'crop'
  | 'blur'
  | 'text'
  | 'overlays'
  | 'overlay';

export type AspectPreset = 'free' | '1:1' | '4:5' | '16:9' | '9:16';

export type BlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'soft-light'
  | 'hard-light'
  | 'difference'
  | 'exclusion'
  | 'color-dodge'
  | 'color-burn'
  | 'darken'
  | 'lighten'
  | 'hue'
  | 'saturation'
  | 'color'
  | 'luminosity';

export type MaskKind =
  | 'brush'
  | 'linear'
  | 'radial'
  | 'luminosity'
  | 'color-range'
  | 'magic-wand'
  | 'lasso'
  | 'polygon'
  | 'ai-subject'
  | 'ai-sky';

export interface MaskBrushStroke {
  id: string;
  tool: 'paint' | 'erase';
  size: number; // normalized 0.01..0.15
  hardness: number; // 0..100
  opacity: number; // 10..100
  points: Array<{ x: number; y: number }>;
}

export interface LayerMask {
  id: string;
  name: string;
  kind: MaskKind;
  enabled: boolean;
  inverted: boolean;
  feather: number; // 0..50
  refineEdge: number; // -50..50
  expand?: number; // -30..30 morphological dilate/erode px
  brushStrokes?: MaskBrushStroke[];
  gradient?: { x1: number; y1: number; x2: number; y2: number; radius: number };
  luminosity?: { min: number; max: number; softness: number };
  colorRange?: { hex: string; tolerance: number; softness: number };
  wand?: { seedX: number; seedY: number; tolerance: number; contiguous: boolean };
  polygonPoints?: Array<{ x: number; y: number }>;
  aiMaskDataUrl?: string;
}

export interface SavedMaskSelection {
  id: string;
  name: string;
  createdAt: number;
  mask: LayerMask;
}

export interface AdjustmentsParams {
  exposure: number; // -100..100
  contrast: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number; // -100..100
  blacks: number; // -100..100
  temperature: number; // -100..100
  tint: number; // -100..100
  saturation: number; // -100..100
  vibrance: number; // -100..100
  clarity: number; // -100..100
  dehaze: number; // -100..100
  sharpness: number; // 0..100
  grain: number; // 0..100
  vignette: number; // -100..100
  fade: number; // 0..100
  brightness?: number; // -100..100
  gamma?: number; // 0.3..2.5 (default 1)
}

export interface ColorWheelGrade {
  hue: number; // 0..360
  sat: number; // 0..100
  lum: number; // -50..50
}

export interface ToneExtendedParams {
  inputBlack: number; // 0..240
  gamma: number; // 0.25..2.5
  inputWhite: number; // 15..255
  outputBlack: number; // 0..240
  outputWhite: number; // 15..255
  brightness: number; // -100..100
  hueRotate: number; // -180..180
  selectiveColor: {
    targetHue: number; // 0..360
    range: number; // 10..90
    hueShift: number; // -180..180
    satShift: number; // -100..100
    lumShift: number; // -100..100
  };
  colorWheels: {
    shadows: ColorWheelGrade;
    midtones: ColorWheelGrade;
    highlights: ColorWheelGrade;
  };
  colorSplash?: {
    enabled: boolean;
    targetHue: number; // 0..360
    targetHex: string;
    tolerance: number; // 5..90 degrees
  };
  replaceColor?: {
    enabled: boolean;
    sourceHex: string;
    targetHex: string;
    tolerance: number; // 5..100
    softness: number; // 0..100
  };
}

export interface DetailEffectsParams {
  unsharpAmount: number; // 0..200
  unsharpRadius: number; // 1..5
  unsharpThreshold: number; // 0..64
  noiseLuma: number; // 0..100
  noiseChroma: number; // 0..100
  texture: number; // -100..100
  bloomAmount: number; // 0..100
  bloomRadius: number; // 2..30
  chromaticAberration: number; // -100..100
  halation: number; // 0..100
  lightLeak: number; // 0..100
  lightLeakStyle: 'amber-left' | 'sunset-corner' | 'prism-edge';
  dustScratches: number; // 0..100
  lensDistortion: number; // -100..100
  perspectiveX: number; // -45..45
  perspectiveY: number; // -45..45
  picsartFx?: OverlayEffectItem[];
}

export type HslBandKey =
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'cyan'
  | 'blue'
  | 'purple'
  | 'magenta';

export interface HslBandValue {
  h: number; // -45..45 degrees
  s: number; // -100..100
  l: number; // -100..100
}

export interface SplitToningParams {
  shadowHue: number; // 0..360
  shadowSat: number; // 0..100
  highlightHue: number; // 0..360
  highlightSat: number; // 0..100
  balance: number; // -100..100
}

export interface HslParams {
  bands: Record<HslBandKey, HslBandValue>;
  splitToning: SplitToningParams;
}

export interface CurvePoint {
  x: number; // 0..255
  y: number; // 0..255
}

export type CurveChannel = 'rgb' | 'r' | 'g' | 'b';

export interface CurvesParams {
  rgb: CurvePoint[];
  r: CurvePoint[];
  g: CurvePoint[];
  b: CurvePoint[];
}

export interface FilterParams {
  presetId: string;
  presetName: string;
  intensity: number; // 0..100
}

export interface CropParams {
  aspectPreset: AspectPreset;
  cropRect: { x: number; y: number; w: number; h: number }; // normalized 0..1
  straighten: number; // -45..45 degrees
  rotate90: 0 | 90 | 180 | 270;
  flipH: boolean;
  flipV: boolean;
  scale: number; // 0.5..3
  offsetX: number; // -0.5..0.5
  offsetY: number; // -0.5..0.5
}

export type BokehShape = 'circle' | 'hexagon' | 'octagon' | 'anamorphic';

export interface BlurParams {
  mode: 'radial' | 'linear' | 'tiltshift' | 'background';
  amount: number; // 0..100
  feather: number; // 0..100
  centerX: number; // 0..1
  centerY: number; // 0..1
  radius: number; // 0.05..0.8
  angle: number; // -90..90
  bokehShape?: BokehShape;
}

export interface FrameParams {
  style: 'none' | 'solid' | 'polaroid' | 'film' | 'rounded' | 'double' | 'torn-paper' | 'grunge';
  width: number; // 0..80 px relative to 1080
  color: string;
  innerRadius: number; // 0..120
}

export interface DrawStroke {
  id: string;
  tool: 'brush' | 'eraser';
  color: string;
  size: number; // normalized fraction of min(w,h), e.g. 0.01..0.08
  opacity: number; // 0.05..1
  neon?: boolean;
  points: Array<{ x: number; y: number }>; // normalized 0..1
}

export interface DrawParams {
  strokes: DrawStroke[];
}

export type TextAnimationKind = 'none' | 'fade' | 'slide-up' | 'pop' | 'typewriter' | 'pulse';

export interface TextParams {
  text: string;
  fontFamily: string;
  fontSize: number; // relative to 1080px canvas height, 18..140
  fontWeight: number;
  letterSpacing?: number; // -4..20 px
  lineHeight?: number; // 0.8..2.2
  textAlign?: 'left' | 'center' | 'right';
  color: string;
  gradientEnabled?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientAngle?: number; // 0..360
  strokeColor: string;
  strokeWidth: number; // 0..12
  shadowBlur: number; // 0..30
  shadowColor: string;
  glowBlur?: number; // 0..40
  glowColor?: string;
  bgEnabled: boolean;
  bgColor: string;
  curveAmount?: number; // -100..100
  pathStyle?: 'arc' | 'wave' | 'circle';
  animation?: TextAnimationKind;
  rotation: number; // -180..180
  x: number; // normalized 0..1
  y: number; // normalized 0..1
}

export type ShapeKind =
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'star'
  | 'heart'
  | 'arrow'
  | 'ring'
  | 'badge';

export interface ShapeParams {
  kind: ShapeKind;
  fillColor: string;
  strokeColor: string;
  strokeWidth: number; // 0..20
  cornerRadius: number; // 0..50
  size: number; // normalized 0.05..0.6
  rotation: number; // -180..180
  opacity: number; // 0.1..1
  x: number;
  y: number;
}

export interface StickerParams {
  kind: 'emoji' | 'shape' | 'image';
  value: string; // emoji char, shape id, or label for custom image
  src?: string; // custom uploaded sticker dataUrl
  color: string;
  size: number; // normalized 0.04..0.5 of min(w,h)
  rotation: number;
  opacity: number; // 0.1..1
  x: number;
  y: number;
}

export type OverlayEffectCategory =
  | 'blur'
  | 'artistic'
  | 'retro'
  | 'distort'
  | 'light'
  | 'color'
  | 'texture'
  | 'face'
  | 'body'
  | 'cutout';

export type OverlayEffectKind =
  // Blur
  | 'blur'
  | 'motion-blur'
  | 'radial-blur'
  | 'zoom-blur'
  | 'tilt-shift'
  | 'bokeh'
  // Artistic
  | 'oil-paint'
  | 'watercolor'
  | 'sketch'
  | 'pencil'
  | 'cartoon'
  | 'comic'
  | 'pop-art'
  | 'pointillism'
  | 'mosaic'
  | 'stained-glass'
  | 'sharpen'
  // Retro
  | 'film-grain'
  | 'light-leak'
  | 'dust'
  | 'halftone'
  | 'vhs'
  | 'lomo'
  | 'vintage-fade'
  // Distort
  | 'fisheye'
  | 'mirror'
  | 'kaleidoscope'
  | 'twirl'
  | 'bulge'
  | 'pinch'
  | 'ripple'
  | 'glitch'
  | 'pixelate'
  | 'rgb-split'
  | 'scanlines'
  // Light
  | 'glow'
  | 'bloom'
  | 'neon'
  | 'neon-outline'
  | 'sun-flare'
  | 'lens-flare'
  | 'rainbow'
  | 'spotlight'
  | 'drop-shadow'
  | 'inner-shadow'
  | 'vignette'
  // Colour
  | 'duotone'
  | 'posterize'
  | 'solarize'
  | 'thermal'
  | 'gradient-map'
  | 'invert'
  // Texture
  | 'paper'
  | 'canvas'
  | 'grunge'
  | 'bokeh-overlay'
  | 'snow'
  | 'rain'
  | 'sparkle'
  // Face
  | 'smooth-skin'
  | 'whiten-teeth'
  | 'brighten-eyes'
  | 'slim-face'
  | 'enlarge-eyes'
  | 'remove-blemishes'
  // Body
  | 'body-reshape'
  | 'body-slim'
  | 'body-widen'
  | 'body-lengthen'
  // BG Removal
  | 'bg-remove';

export interface OverlayEffectItem {
  id: string;
  kind: OverlayEffectKind;
  label: string;
  category: OverlayEffectCategory;
  intensity: number; // 0..100
  enabled: boolean;
}

export interface OverlayEraseStroke {
  id: string;
  tool: 'erase' | 'restore';
  size: number; // normalized 0.01..0.25 of overlay min dim
  hardness: number; // 0..100
  opacity: number; // 10..100
  points: Array<{ x: number; y: number }>; // normalized 0..1 within overlay bounds
}

export interface OverlayBorderParams {
  width: number; // 0..40
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  radius: number; // 0..50 (%)
}

export type OverlayCutoutShape = 'none' | 'circle' | 'rounded' | 'heart' | 'star' | 'diamond';

export interface ImageLayerParams {
  src: string;
  x: number; // 0..1
  y: number; // 0..1
  scale: number; // 0.08..3
  rotation: number; // -180..180
  aspectRatio?: number; // naturalWidth / naturalHeight
  flipH?: boolean;
  flipV?: boolean;
  border?: OverlayBorderParams;
  eraseStrokes?: OverlayEraseStroke[];
  cutoutShape?: OverlayCutoutShape;
  cutoutInverted?: boolean;
  effects?: OverlayEffectItem[];
}

export interface AiBackgroundParams {
  mode: 'transparent' | 'solid' | 'blur' | 'gradient';
  color: string;
  gradientPreset: string;
  blurAmount: number; // 0..100
  threshold: number; // 0..100
  feather: number; // 0..50
  bokehShape?: BokehShape;
  maskDataUrl?: string;
}

export interface AiUpscaleParams {
  scale: 2 | 4;
  denoise: number; // 0..100
  sharpen: number; // 0..100
  resultDataUrl?: string;
}

export type AiStyleKind = 'oil' | 'anime' | 'comic' | 'watercolor' | '3d';

export interface AiStyleParams {
  style: AiStyleKind;
  strength: number; // 0..100
  resultDataUrl?: string;
}

export interface AiEraserStroke {
  id: string;
  size: number; // normalized 0.01..0.1
  points: Array<{ x: number; y: number }>;
}

export interface AiEraserParams {
  strokes: AiEraserStroke[];
  resultDataUrl?: string;
}

export interface AiRetouchParams {
  skinSmooth: number; // 0..100
  teethWhiten: number; // 0..100
  eyeBrighten: number; // 0..100
  blemishRemove: number; // 0..100
}

export interface AiOutpaintParams {
  expandTop: number; // 0..40 %
  expandRight: number;
  expandBottom: number;
  expandLeft: number;
  resultDataUrl?: string;
}

export interface AiRelightParams {
  angle: number; // 0..360
  elevation: number; // 10..90
  warmth: number; // -100..100
  intensity: number; // 0..100
}

export type AiSkyPreset = 'sunset' | 'dusk' | 'azure' | 'night' | 'pastel';

export interface AiSkyParams {
  skyPreset: AiSkyPreset;
  blend: number; // 0..100
  horizonMatch: number; // 0..100
  maskDataUrl?: string;
}

export interface AiFaceReshapeParams {
  slim: number; // -50..50
  jawline: number; // -50..50
  faceWidth: number; // -50..50
  strength: number; // 0..100
}

export interface AiDenoiseParams {
  strength: number; // 0..100
  detailPreserve: number; // 0..100
}

export interface AiColorizeParams {
  strength: number; // 0..100
  warmth: number; // -50..50
}

export interface AiFaceRestoreParams {
  strength: number; // 0..100
  clarity: number; // 0..100
}

export type AiInstagramEffectKind =
  | 'flashlight'
  | 'disposable-flash'
  | 'golden-hour'
  | 'neon-gel'
  | 'dreamy-aura'
  | 'prism';

export interface AiInstagramEffectParams {
  effect: AiInstagramEffectKind;
  intensity: number; // 0..100
  beamSize: number; // 15..95 (%)
  centerX: number; // 0..1
  centerY: number; // 0..1
  warmth: number; // -50..50
  ambientDarkness: number; // 0..100
}

export interface LayerBaseProps {
  id: string;
  name: string;
  enabled: boolean;
  opacity?: number; // 0..100 (default 100)
  blendMode?: BlendMode;
  locked?: boolean;
  groupId?: string;
  clipToBelow?: boolean;
  mask?: LayerMask;
}

export type EditLayer =
  | (LayerBaseProps & { type: 'adjustments'; params: AdjustmentsParams })
  | (LayerBaseProps & { type: 'tone-extended'; params: ToneExtendedParams })
  | (LayerBaseProps & { type: 'detail-effects'; params: DetailEffectsParams })
  | (LayerBaseProps & { type: 'hsl'; params: HslParams })
  | (LayerBaseProps & { type: 'curves'; params: CurvesParams })
  | (LayerBaseProps & { type: 'filter'; params: FilterParams })
  | (LayerBaseProps & { type: 'crop'; params: CropParams })
  | (LayerBaseProps & { type: 'blur'; params: BlurParams })
  | (LayerBaseProps & { type: 'frame'; params: FrameParams })
  | (LayerBaseProps & { type: 'draw'; params: DrawParams })
  | (LayerBaseProps & { type: 'text'; params: TextParams })
  | (LayerBaseProps & { type: 'shape'; params: ShapeParams })
  | (LayerBaseProps & { type: 'sticker'; params: StickerParams })
  | (LayerBaseProps & { type: 'image'; params: ImageLayerParams })
  | (LayerBaseProps & { type: 'group'; collapsed: boolean })
  | (LayerBaseProps & { type: 'ai-background'; params: AiBackgroundParams })
  | (LayerBaseProps & { type: 'ai-upscale'; params: AiUpscaleParams })
  | (LayerBaseProps & { type: 'ai-style'; params: AiStyleParams })
  | (LayerBaseProps & { type: 'ai-eraser'; params: AiEraserParams })
  | (LayerBaseProps & { type: 'ai-retouch'; params: AiRetouchParams })
  | (LayerBaseProps & { type: 'ai-outpaint'; params: AiOutpaintParams })
  | (LayerBaseProps & { type: 'ai-relight'; params: AiRelightParams })
  | (LayerBaseProps & { type: 'ai-sky'; params: AiSkyParams })
  | (LayerBaseProps & { type: 'ai-face-reshape'; params: AiFaceReshapeParams })
  | (LayerBaseProps & { type: 'ai-denoise'; params: AiDenoiseParams })
  | (LayerBaseProps & { type: 'ai-colorize'; params: AiColorizeParams })
  | (LayerBaseProps & { type: 'ai-face-restore'; params: AiFaceRestoreParams })
  | (LayerBaseProps & { type: 'ai-ig-effect'; params: AiInstagramEffectParams });

export interface SavedProject {
  id: string;
  name: string;
  updatedAt: number;
  sourceDataUrl: string;
  thumbnailDataUrl: string;
  width: number;
  height: number;
  layers: EditLayer[];
}

export interface CustomPreset {
  id: string;
  name: string;
  category: 'Custom';
  createdAt: number;
  layers: EditLayer[];
}

export interface SnapshotCheckpoint {
  id: string;
  name: string;
  createdAt: number;
  layers: EditLayer[];
}

export interface HistoryStepEntry {
  label: string;
  timestamp: number;
  layers: EditLayer[];
}

export type ShortcutActionId =
  | 'undo'
  | 'redo'
  | 'save'
  | 'compare'
  | 'commandPalette'
  | 'toggleTheme'
  | 'export';

export type ShortcutMap = Record<ShortcutActionId, string>;

export interface WorkspaceLayout {
  id: string;
  name: string;
  showLeftRail: boolean;
  showRightPanel: boolean;
  showHistogram: boolean;
  showCanvasHistogramOverlay: boolean;
}

export interface CollageCell {
  id: string;
  src: string | null;
  x: number; // 0..1 (for freeform / grid position)
  y: number;
  w: number;
  h: number;
  aspectRatio?: string; // 'auto' | '1:1' | '4:5' | '16:9'
  borderWidth: number; // 0..24
  offsetX: number;
  offsetY: number;
  scale: number;
}

export interface HistogramData {
  r: number[];
  g: number[];
  b: number[];
  luma: number[];
  maxCount: number;
}

export interface AiCaptionResult {
  caption: string;
  hashtags: string[];
  mood: string;
  dominantColors: string[];
}

export interface AiProgressState {
  active: boolean;
  label: string;
  progress: number; // 0..100
  engine: 'webgpu' | 'wasm' | 'on-device-cv';
}

export interface VideoOverlayKeyframe {
  id: string;
  kind: 'text' | 'sticker';
  text: string;
  color: string;
  fontSize: number;
  x: number; // 0..1
  y: number; // 0..1
  startTime: number; // seconds
  endTime: number; // seconds
  animation: TextAnimationKind | 'bounce' | 'spin';
}

export interface VideoAudioConfig {
  name: string;
  url: string;
  volume: number; // 0..1
  fadeInSec: number; // 0..5
  fadeOutSec: number; // 0..5
}

