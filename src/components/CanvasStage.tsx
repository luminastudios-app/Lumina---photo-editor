import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Maximize, Maximize2, RotateCw, X, ZoomIn, ZoomOut } from 'lucide-react';
import type {
  BlurParams,
  DrawStroke,
  EditLayer,
  HistogramData,
  MaskBrushStroke,
  OverlayEraseStroke,
  ToolId,
} from '../types/editor';
import type { BrushConfig } from './panels/OverlaysPanel';
import type { MaskBrushState } from './panels/MasksPanel';
import type { OverlayBrushState } from './panels/OverlayPanel';
import { HistogramView } from './HistogramView';
import {
  canvasPointToOverlayLocal,
  computeBrushPreviewRadiusCanvasPx,
  computeOverlaySnap,
  getOverlayBoxDimensions,
  renderBrushPreviewDisc,
} from '../engine/overlayEffects';

export type CompareViewMode = 'off' | 'hold' | 'split' | 'side-by-side';

interface CanvasStageProps {
  renderedCanvas: HTMLCanvasElement | null;
  compareCanvas: HTMLCanvasElement | null;
  compareLabel: string;
  compareMode: CompareViewMode;
  onChangeCompareMode: (mode: CompareViewMode) => void;
  histogram: HistogramData | null;
  showCanvasHistogramOverlay: boolean;
  sourceWidth: number;
  sourceHeight: number;
  layers: EditLayer[];
  activeTool: ToolId;
  selectedLayerId: string | null;
  showOriginal: boolean;
  isProxy: boolean;
  brush: BrushConfig;
  maskBrush: MaskBrushState;
  overlayBrush: OverlayBrushState;
  brushSliderDragging: boolean;
  autoSnapEnabled: boolean;
  wbPickerActive: boolean;
  splashPickActive?: boolean;
  replacePickActive?: boolean;
  onAddDrawStroke: (stroke: DrawStroke) => void;
  onAddMaskBrushStroke: (stroke: MaskBrushStroke) => void;
  onPaintOverlayEraseStroke: (layerId: string, stroke: OverlayEraseStroke) => void;
  onPickCanvasRgb: (r: number, g: number, b: number) => void;
  onUpdateMaskWandSeed?: (xNorm: number, yNorm: number) => void;
  onUpdateMaskPolygonPoints?: (points: Array<{ x: number; y: number }>, commit: boolean) => void;
  onMoveOverlayLayer: (layerId: string, x: number, y: number, commit: boolean) => void;
  onTransformOverlayLayer: (
    layerId: string,
    patch: { size?: number; fontSize?: number; scale?: number; rotation?: number },
    commit: boolean,
  ) => void;
  onDeleteOverlayLayer: (layerId: string) => void;
  onMoveBlurCenter: (cx: number, cy: number, commit: boolean) => void;
  onSelectLayerId: (id: string) => void;
  isOverlayStudioOpen?: boolean;
}

export const CanvasStage: React.FC<CanvasStageProps> = ({
  renderedCanvas,
  compareCanvas,
  compareLabel,
  compareMode,
  onChangeCompareMode,
  histogram,
  showCanvasHistogramOverlay,
  sourceWidth,
  sourceHeight,
  layers,
  activeTool,
  selectedLayerId,
  showOriginal,
  isProxy,
  brush,
  maskBrush,
  overlayBrush,
  brushSliderDragging,
  autoSnapEnabled,
  wbPickerActive,
  splashPickActive = false,
  replacePickActive = false,
  onAddDrawStroke,
  onAddMaskBrushStroke,
  onPaintOverlayEraseStroke,
  onPickCanvasRgb,
  onUpdateMaskWandSeed,
  onUpdateMaskPolygonPoints,
  onMoveOverlayLayer,
  onTransformOverlayLayer,
  onDeleteOverlayLayer,
  onMoveBlurCenter,
  onSelectLayerId,
  isOverlayStudioOpen = false,
}) => {
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const brushPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const compareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sideCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);

  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [splitPos, setSplitPos] = useState<number>(0.5);
  const [draggingSplit, setDraggingSplit] = useState(false);
  const [activeStroke, setActiveStroke] = useState<Array<{ x: number; y: number }>>([]);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [snapGuides, setSnapGuides] = useState<{
    x: number | null;
    y: number | null;
    angle: number | null;
  }>({ x: null, y: null, angle: null });
  const [draggingTarget, setDraggingTarget] = useState<
    | { kind: 'overlay'; id: string; offsetX: number; offsetY: number }
    | { kind: 'transform'; id: string; startY: number; startX: number }
    | {
        kind: 'image-scale';
        id: string;
        cx: number;
        cy: number;
        startDist: number;
        startScale: number;
      }
    | {
        kind: 'image-rotate';
        id: string;
        cx: number;
        cy: number;
        startAngle: number;
        startRotation: number;
      }
    | { kind: 'blur' }
    | null
  >(null);

  // Unified multi-pointer pinch/pan tracking so pinch/pan/wheel never paint
  const activePointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const multiTouchGestureRef = useRef<{
    active: boolean;
    startDist: number;
    startMidX: number;
    startMidY: number;
    baseZoom: number;
    basePanX: number;
    basePanY: number;
  }>({
    active: false,
    startDist: 100,
    startMidX: 0,
    startMidY: 0,
    baseZoom: 1,
    basePanX: 0,
    basePanY: 0,
  });

  // Live Brush Preview refs (60fps rAF rendering decoupled from React tree)
  const lastBrushPtRef = useRef<{ x: number; y: number }>({ x: 0.5, y: 0.5 });
  const hasTouchedCanvasRef = useRef<boolean>(false);
  const previewVisibleRef = useRef<boolean>(true);
  const lingerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafPreviewRef = useRef<number | null>(null);
  const activeStrokeRef = useRef<Array<{ x: number; y: number }>>([]);

  useEffect(() => {
    const target = displayCanvasRef.current;
    if (!target || !renderedCanvas) return;
    target.width = renderedCanvas.width;
    target.height = renderedCanvas.height;
    const ctx = target.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;
    ctx.clearRect(0, 0, target.width, target.height);
    ctx.drawImage(renderedCanvas, 0, 0);
  }, [renderedCanvas, compareMode]);

  useEffect(() => {
    if (!compareCanvas) return;
    for (const ref of [compareCanvasRef, sideCanvasRef]) {
      const target = ref.current;
      if (!target) continue;
      target.width = compareCanvas.width;
      target.height = compareCanvas.height;
      const ctx = target.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, target.width, target.height);
        ctx.drawImage(compareCanvas, 0, 0);
      }
    }
  }, [compareCanvas, compareMode]);

  const outW = Math.max(1, renderedCanvas?.width ?? sourceWidth);
  const outH = Math.max(1, renderedCanvas?.height ?? sourceHeight);

  const selectedImageOverlay =
    layers.find(
      (l): l is Extract<EditLayer, { type: 'image' }> =>
        l.id === selectedLayerId && l.type === 'image' && l.enabled,
    ) ?? null;

  const isCutoutSessionActive =
    activeTool === 'overlay' &&
    overlayBrush.active &&
    Boolean(selectedImageOverlay && !selectedImageOverlay.locked);

  // Brush paints when Cutout Studio is active and Erase / Restore (or non-shape paint) tool is chosen
  const isOverlayErasePainting =
    isCutoutSessionActive && overlayBrush.tool !== 'shape';

  const activeCutoutPreset = overlayBrush[overlayBrush.lastPaintTool];

  const activeMaskLayer =
    activeTool === 'masks'
      ? layers.find(
          (l) =>
            l.id === selectedLayerId &&
            l.mask &&
            l.type !== 'crop' &&
            l.type !== 'group' &&
            l.type !== 'frame',
        ) ??
        [...layers]
          .reverse()
          .find(
            (l) => l.mask && l.type !== 'crop' && l.type !== 'group' && l.type !== 'frame',
          ) ??
        null
      : null;
  const activeMaskKind = activeMaskLayer?.mask?.kind ?? null;
  const isMagicWandMode =
    activeTool === 'masks' &&
    !maskBrush.active &&
    !maskBrush.colorPickActive &&
    activeMaskKind === 'magic-wand';
  const isLassoMode =
    activeTool === 'masks' &&
    !maskBrush.active &&
    !maskBrush.colorPickActive &&
    activeMaskKind === 'lasso';
  const isPolygonMode =
    activeTool === 'masks' &&
    !maskBrush.active &&
    !maskBrush.colorPickActive &&
    activeMaskKind === 'polygon';

  const isEyedropperMode =
    wbPickerActive ||
    splashPickActive ||
    replacePickActive ||
    (activeTool === 'masks' && maskBrush.colorPickActive);
  const isPaintMode =
    !isEyedropperMode &&
    ((activeTool === 'overlays' && brush.active) ||
      (activeTool === 'masks' && maskBrush.active && activeMaskKind === 'brush') ||
      isOverlayErasePainting);

  // Reset parked brush position to center when entering Cutout Studio
  useEffect(() => {
    if (isCutoutSessionActive) {
      lastBrushPtRef.current = { x: 0.5, y: 0.5 };
      hasTouchedCanvasRef.current = false;
      previewVisibleRef.current = true;
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
    } else {
      hasTouchedCanvasRef.current = false;
      setPan({ x: 0, y: 0 });
      setZoom('fit');
    }
  }, [isCutoutSessionActive]);

  // Ref snapshot of latest brush preview state so rAF loop always reads fresh numbers
  const previewParamsRef = useRef({
    enabled: false,
    outW: 1,
    outH: 1,
    size: 84,
    opacity: 100,
    hardness: 70,
    tool: 'erase' as 'erase' | 'restore',
    sliderDragging: false,
  });
  previewParamsRef.current = {
    enabled: isOverlayErasePainting,
    outW,
    outH,
    size: activeCutoutPreset.size,
    opacity: activeCutoutPreset.opacity,
    hardness: activeCutoutPreset.hardness,
    tool: overlayBrush.lastPaintTool,
    sliderDragging: brushSliderDragging,
  };

  const drawBrushPreviewNow = useCallback(() => {
    const canvas = brushPreviewCanvasRef.current;
    if (!canvas) return;
    const cfg = previewParamsRef.current;
    if (canvas.width !== cfg.outW || canvas.height !== cfg.outH) {
      canvas.width = cfg.outW;
      canvas.height = cfg.outH;
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (!cfg.enabled || (!previewVisibleRef.current && !cfg.sliderDragging)) {
      ctx.clearRect(0, 0, cfg.outW, cfg.outH);
      return;
    }

    const pt = lastBrushPtRef.current;
    renderBrushPreviewDisc(
      ctx,
      cfg.outW,
      cfg.outH,
      pt.x,
      pt.y,
      cfg.size,
      cfg.opacity,
      cfg.hardness,
    );

    // Optional live stroke path overlay during active 1-finger stroke
    const pts = activeStrokeRef.current;
    if (pts.length > 0) {
      const diam = computeBrushPreviewRadiusCanvasPx(cfg.size, cfg.outW, cfg.outH) * 2;
      ctx.save();
      ctx.strokeStyle =
        cfg.tool === 'erase' ? 'rgba(255, 255, 255, 0.36)' : 'rgba(110, 231, 183, 0.36)';
      ctx.lineWidth = diam;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalAlpha = Math.max(0.15, (cfg.opacity / 100) * 0.5);
      ctx.beginPath();
      ctx.moveTo(pts[0].x * cfg.outW, pts[0].y * cfg.outH);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * cfg.outW, pts[i].y * cfg.outH);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, []);

  const scheduleBrushPreview = useCallback(() => {
    if (rafPreviewRef.current !== null) return;
    rafPreviewRef.current = window.requestAnimationFrame(() => {
      rafPreviewRef.current = null;
      drawBrushPreviewNow();
    });
  }, [drawBrushPreviewNow]);

  // Trigger live 60fps redraw whenever Size, Opacity, Hardness, Tool, or slider-drag state updates
  useEffect(() => {
    if (isOverlayErasePainting) {
      previewVisibleRef.current = true;
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      // Keep visible indefinitely before first canvas touch; linger after slider click post-touch
      if (hasTouchedCanvasRef.current && !brushSliderDragging && activePointersRef.current.size === 0) {
        lingerTimerRef.current = setTimeout(() => {
          previewVisibleRef.current = false;
          scheduleBrushPreview();
        }, 1200);
      }
    }
    scheduleBrushPreview();
  }, [
    isOverlayErasePainting,
    activeCutoutPreset.size,
    activeCutoutPreset.opacity,
    activeCutoutPreset.hardness,
    overlayBrush.lastPaintTool,
    brushSliderDragging,
    outW,
    outH,
    scheduleBrushPreview,
  ]);

  useEffect(() => {
    return () => {
      if (rafPreviewRef.current !== null) cancelAnimationFrame(rafPreviewRef.current);
      if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
    };
  }, []);

  // Keyboard precision nudging & rotation for selected image overlay in Overlay tab
  useEffect(() => {
    if (
      activeTool !== 'overlay' ||
      isCutoutSessionActive ||
      !selectedImageOverlay ||
      selectedImageOverlay.locked
    ) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const step = e.shiftKey ? 0.03 : 0.008;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onMoveOverlayLayer(
          selectedImageOverlay.id,
          Math.max(0.02, selectedImageOverlay.params.x - step),
          selectedImageOverlay.params.y,
          true,
        );
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        onMoveOverlayLayer(
          selectedImageOverlay.id,
          Math.min(0.98, selectedImageOverlay.params.x + step),
          selectedImageOverlay.params.y,
          true,
        );
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        onMoveOverlayLayer(
          selectedImageOverlay.id,
          selectedImageOverlay.params.x,
          Math.max(0.02, selectedImageOverlay.params.y - step),
          true,
        );
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        onMoveOverlayLayer(
          selectedImageOverlay.id,
          selectedImageOverlay.params.x,
          Math.min(0.98, selectedImageOverlay.params.y + step),
          true,
        );
      } else if (e.key === '[' || e.key === ']') {
        e.preventDefault();
        const deg = (e.shiftKey ? 15 : 3) * (e.key === '[' ? -1 : 1);
        onTransformOverlayLayer(
          selectedImageOverlay.id,
          { rotation: selectedImageOverlay.params.rotation + deg },
          true,
        );
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        onDeleteOverlayLayer(selectedImageOverlay.id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    activeTool,
    isCutoutSessionActive,
    onDeleteOverlayLayer,
    onMoveOverlayLayer,
    onTransformOverlayLayer,
    selectedImageOverlay,
  ]);

  const getNormalizedPoint = (clientX: number, clientY: number) => {
    const el = displayCanvasRef.current;
    if (!el) return { x: 0.5, y: 0.5 };
    const rect = el.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / Math.max(1, rect.width))),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / Math.max(1, rect.height))),
    };
  };

  const getOverlayScreenCenter = (px: number, py: number) => {
    const el = displayCanvasRef.current;
    if (!el) return { cx: 0, cy: 0 };
    const rect = el.getBoundingClientRect();
    return {
      cx: rect.left + px * rect.width,
      cy: rect.top + py * rect.height,
    };
  };

  const cancelInProgressPaint = () => {
    activeStrokeRef.current = [];
    setActiveStroke([]);
    setDraggingTarget(null);
    scheduleBrushPreview();
  };

  const beginTwoFingerGesture = () => {
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return;
    const dx = pts[0].x - pts[1].x;
    const dy = pts[0].y - pts[1].y;
    multiTouchGestureRef.current = {
      active: true,
      startDist: Math.max(12, Math.hypot(dx, dy)),
      startMidX: (pts[0].x + pts[1].x) / 2,
      startMidY: (pts[0].y + pts[1].y) / 2,
      baseZoom: zoom === 'fit' ? 1 : zoom,
      basePanX: pan.x,
      basePanY: pan.y,
    };
    cancelInProgressPaint();
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!displayCanvasRef.current) return;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // Multi-touch guard: if 2+ pointers touch down (even mid-stroke), cancel stroke & switch to pinch/pan
    if (activePointersRef.current.size >= 2) {
      beginTwoFingerGesture();
      return;
    }

    const pt = getNormalizedPoint(e.clientX, e.clientY);

    if (isOverlayErasePainting) {
      hasTouchedCanvasRef.current = true;
      lastBrushPtRef.current = pt;
      previewVisibleRef.current = true;
      if (lingerTimerRef.current) {
        clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = null;
      }
      scheduleBrushPreview();
    }

    if (isEyedropperMode) {
      const c = displayCanvasRef.current;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        const px = Math.max(0, Math.min(c.width - 1, Math.round(pt.x * c.width)));
        const py = Math.max(0, Math.min(c.height - 1, Math.round(pt.y * c.height)));
        const data = ctx.getImageData(px, py, 1, 1).data;
        onPickCanvasRgb(data[0], data[1], data[2]);
      }
      return;
    }

    if (isMagicWandMode) {
      onUpdateMaskWandSeed?.(pt.x, pt.y);
      return;
    }

    if (isPolygonMode) {
      const existing = activeMaskLayer?.mask?.polygonPoints ?? [];
      onUpdateMaskPolygonPoints?.([...existing, pt], true);
      return;
    }

    if (isLassoMode) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      activeStrokeRef.current = [pt];
      setActiveStroke([pt]);
      return;
    }

    if (isPaintMode) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // ignore synthetic test pointer errors
      }
      activeStrokeRef.current = [pt];
      setActiveStroke([pt]);
      scheduleBrushPreview();
      return;
    }

    if (activeTool === 'blur') {
      const blurLayer = layers.find((l) => l.type === 'blur' && l.enabled);
      if (blurLayer) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // ignore
        }
        setDraggingTarget({ kind: 'blur' });
        onMoveBlurCenter(pt.x, pt.y, false);
        return;
      }
    }

    if (isCutoutSessionActive) return;

    const overlays = [...layers]
      .reverse()
      .filter(
        (l): l is Extract<EditLayer, { type: 'text' | 'sticker' | 'shape' | 'image' }> =>
          l.enabled &&
          !l.locked &&
          (l.type === 'text' || l.type === 'sticker' || l.type === 'shape' || l.type === 'image'),
      );

    for (const ov of overlays) {
      if (ov.type === 'image') {
        const local = canvasPointToOverlayLocal(pt.x, pt.y, outW, outH, ov.params);
        if (local.x >= -0.05 && local.x <= 1.05 && local.y >= -0.05 && local.y <= 1.05) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          onSelectLayerId(ov.id);
          setDraggingTarget({
            kind: 'overlay',
            id: ov.id,
            offsetX: pt.x - ov.params.x,
            offsetY: pt.y - ov.params.y,
          });
          return;
        }
      } else {
        const p = ov.params as { x: number; y: number };
        if (Math.hypot(pt.x - p.x, pt.y - p.y) < 0.14) {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // ignore
          }
          onSelectLayerId(ov.id);
          setDraggingTarget({
            kind: 'overlay',
            id: ov.id,
            offsetX: pt.x - p.x,
            offsetY: pt.y - p.y,
          });
          return;
        }
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointersRef.current.has(e.pointerId)) {
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Pinch-to-zoom / two-finger pan blocks any stroke movement
    if (activePointersRef.current.size >= 2 || multiTouchGestureRef.current.active) {
      if (activePointersRef.current.size >= 2) {
        const pts = Array.from(activePointersRef.current.values());
        const g = multiTouchGestureRef.current;
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const midX = (pts[0].x + pts[1].x) / 2;
        const midY = (pts[0].y + pts[1].y) / 2;
        const nextZoom = Math.max(
          0.35,
          Math.min(4, Number((g.baseZoom * (dist / Math.max(12, g.startDist))).toFixed(2))),
        );
        setZoom(nextZoom);
        setPan({
          x: Math.round(g.basePanX + (midX - g.startMidX)),
          y: Math.round(g.basePanY + (midY - g.startMidY)),
        });
      }
      return;
    }

    if (isPaintMode) {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      setHoverPt(pt);
      if (isOverlayErasePainting) {
        lastBrushPtRef.current = pt;
        previewVisibleRef.current = true;
        if (lingerTimerRef.current) {
          clearTimeout(lingerTimerRef.current);
          lingerTimerRef.current = null;
        }
        scheduleBrushPreview();
      }
    } else if (hoverPt) {
      setHoverPt(null);
    }

    if (draggingSplit) {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      setSplitPos(Math.max(0.05, Math.min(0.95, pt.x)));
      return;
    }

    if (isLassoMode && activeStrokeRef.current.length > 0) {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      const prevPt = activeStrokeRef.current[activeStrokeRef.current.length - 1];
      if (!prevPt || Math.hypot(pt.x - prevPt.x, pt.y - prevPt.y) > 0.006) {
        activeStrokeRef.current = [...activeStrokeRef.current, pt];
        setActiveStroke(activeStrokeRef.current);
      }
      return;
    }

    if (isPaintMode && activeStrokeRef.current.length > 0) {
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      activeStrokeRef.current = [...activeStrokeRef.current, pt];
      setActiveStroke(activeStrokeRef.current);
      if (isOverlayErasePainting) scheduleBrushPreview();
      return;
    }

    if (draggingTarget) {
      if (draggingTarget.kind === 'overlay') {
        const pt = getNormalizedPoint(e.clientX, e.clientY);
        const target = layers.find((l) => l.id === draggingTarget.id);
        const curRot = target && target.type === 'image' ? target.params.rotation : 0;
        const snapped = computeOverlaySnap(
          pt.x - draggingTarget.offsetX,
          pt.y - draggingTarget.offsetY,
          curRot,
          autoSnapEnabled,
        );
        setSnapGuides({ x: snapped.snapX, y: snapped.snapY, angle: null });
        onMoveOverlayLayer(draggingTarget.id, snapped.x, snapped.y, false);
      } else if (draggingTarget.kind === 'image-scale') {
        const curDist = Math.max(
          12,
          Math.hypot(e.clientX - draggingTarget.cx, e.clientY - draggingTarget.cy),
        );
        const ratio = curDist / Math.max(12, draggingTarget.startDist);
        const nextScale = Math.max(
          0.1,
          Math.min(2.5, Number((draggingTarget.startScale * ratio).toFixed(2))),
        );
        onTransformOverlayLayer(draggingTarget.id, { scale: nextScale }, false);
      } else if (draggingTarget.kind === 'image-rotate') {
        const angle = Math.atan2(e.clientY - draggingTarget.cy, e.clientX - draggingTarget.cx);
        const deltaDeg = ((angle - draggingTarget.startAngle) * 180) / Math.PI;
        const rawRot = draggingTarget.startRotation + deltaDeg;
        const target = layers.find((l) => l.id === draggingTarget.id);
        const px = target && target.type === 'image' ? target.params.x : 0.5;
        const py = target && target.type === 'image' ? target.params.y : 0.5;
        const snapped = computeOverlaySnap(px, py, rawRot, autoSnapEnabled);
        setSnapGuides({ x: null, y: null, angle: snapped.snapAngle });
        onTransformOverlayLayer(draggingTarget.id, { rotation: snapped.rotation }, false);
      } else if (draggingTarget.kind === 'transform') {
        const dy = draggingTarget.startY - e.clientY;
        const dx = e.clientX - draggingTarget.startX;
        const sel = layers.find((l) => l.id === draggingTarget.id);
        if (sel?.type === 'text') {
          onTransformOverlayLayer(
            sel.id,
            {
              fontSize: Math.max(18, Math.min(140, Math.round(52 + dy * 0.45))),
              rotation: Math.max(-180, Math.min(180, Math.round(dx * 0.8))),
            },
            false,
          );
        } else if (sel?.type === 'sticker' || sel?.type === 'shape') {
          onTransformOverlayLayer(
            sel.id,
            {
              size: Math.max(0.05, Math.min(0.6, Number((0.2 + dy * 0.002).toFixed(3)))),
              rotation: Math.max(-180, Math.min(180, Math.round(dx * 0.8))),
            },
            false,
          );
        }
      } else if (draggingTarget.kind === 'blur') {
        const pt = getNormalizedPoint(e.clientX, e.clientY);
        onMoveBlurCenter(pt.x, pt.y, false);
      }
    }
  };

  const handlePointerUpOrCancel = (e: React.PointerEvent<HTMLDivElement>, cancelled = false) => {
    setDraggingSplit(false);
    activePointersRef.current.delete(e.pointerId);

    if (multiTouchGestureRef.current.active) {
      cancelInProgressPaint();
      if (activePointersRef.current.size === 0) {
        multiTouchGestureRef.current.active = false;
      }
      return;
    }

    const strokePts = activeStrokeRef.current;
    if (isLassoMode && strokePts.length > 0) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      activeStrokeRef.current = [];
      setActiveStroke([]);
      if (!cancelled && strokePts.length >= 3) {
        onUpdateMaskPolygonPoints?.(strokePts, true);
      }
      return;
    }

    if (isPaintMode && strokePts.length > 0) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      activeStrokeRef.current = [];
      setActiveStroke([]);

      if (!cancelled) {
        if (isOverlayErasePainting && selectedImageOverlay) {
          const diamPx = (activeCutoutPreset.size / 420) * Math.min(outW, outH);
          const { dw, dh } = getOverlayBoxDimensions(outW, outH, selectedImageOverlay.params);
          const minLocal = Math.max(20, Math.min(dw, dh));
          const localPoints = strokePts.map((pt) =>
            canvasPointToOverlayLocal(pt.x, pt.y, outW, outH, selectedImageOverlay.params),
          );
          onPaintOverlayEraseStroke(selectedImageOverlay.id, {
            id: `ove_${Date.now()}`,
            tool: overlayBrush.lastPaintTool,
            size: Math.max(0.01, Math.min(1.5, diamPx / minLocal)),
            hardness: activeCutoutPreset.hardness,
            opacity: activeCutoutPreset.opacity,
            points: localPoints,
          });
        } else if (activeTool === 'masks' && maskBrush.active) {
          onAddMaskBrushStroke({
            id: `mb_${Date.now()}`,
            tool: maskBrush.tool,
            size: maskBrush.size / 720,
            hardness: maskBrush.hardness,
            opacity: maskBrush.opacity,
            points: strokePts,
          });
        } else if (activeTool === 'overlays' && brush.active) {
          onAddDrawStroke({
            id: `st_${Date.now()}`,
            tool: brush.tool,
            neon: brush.tool === 'brush' ? Boolean(brush.neon) : false,
            color: brush.color,
            size: brush.size / 720,
            opacity: brush.opacity / 100,
            points: strokePts,
          });
        }
      }

      if (isOverlayErasePainting) {
        previewVisibleRef.current = true;
        scheduleBrushPreview();
        if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
        lingerTimerRef.current = setTimeout(() => {
          if (!brushSliderDragging) {
            previewVisibleRef.current = false;
            scheduleBrushPreview();
          }
        }, 700);
      }
      return;
    }

    if (draggingTarget) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      const pt = getNormalizedPoint(e.clientX, e.clientY);
      if (draggingTarget.kind === 'overlay') {
        const target = layers.find((l) => l.id === draggingTarget.id);
        const curRot = target && target.type === 'image' ? target.params.rotation : 0;
        const snapped = computeOverlaySnap(
          pt.x - draggingTarget.offsetX,
          pt.y - draggingTarget.offsetY,
          curRot,
          autoSnapEnabled,
        );
        onMoveOverlayLayer(draggingTarget.id, snapped.x, snapped.y, true);
      } else if (draggingTarget.kind === 'blur') {
        onMoveBlurCenter(pt.x, pt.y, true);
      } else if (
        draggingTarget.kind === 'transform' ||
        draggingTarget.kind === 'image-scale' ||
        draggingTarget.kind === 'image-rotate'
      ) {
        onTransformOverlayLayer(draggingTarget.id, {}, true);
      }
      setSnapGuides({ x: null, y: null, angle: null });
      setDraggingTarget(null);
    }
  };

  // Extra touch-event guard: if a browser fires touchstart(2) before pointerdown, cancel immediately
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length >= 2) {
      cancelInProgressPaint();
      multiTouchGestureRef.current.active = true;
    }
  };

  // Attach non-passive wheel listener so zoom never triggers passive preventDefault console warnings
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!isOverlayErasePainting && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const factor = Math.exp(-e.deltaY * 0.0018);
      setZoom((z) => {
        const cur = z === 'fit' ? 1 : z;
        return Math.max(0.35, Math.min(4, Number((cur * factor).toFixed(2))));
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [isOverlayErasePainting]);

  const blurLayer = layers.find((l) => l.type === 'blur' && l.enabled) as
    | Extract<EditLayer, { type: 'blur' }>
    | undefined;
  const blurParams: BlurParams | null = blurLayer ? blurLayer.params : null;

  const draggableOverlays = layers.filter(
    (l): l is Extract<EditLayer, { type: 'text' | 'sticker' | 'shape' }> =>
      l.enabled && (l.type === 'text' || l.type === 'sticker' || l.type === 'shape'),
  );

  const imageOverlays = layers.filter(
    (l): l is Extract<EditLayer, { type: 'image' }> => l.enabled && l.type === 'image',
  );

  const canvasStyle: React.CSSProperties =
    zoom === 'fit'
      ? { maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }
      : {
          width: `${Math.round(outW * zoom)}px`,
          height: `${Math.round(outH * zoom)}px`,
        };

  return (
    <div
      ref={stageRef}
      onTouchStart={handleTouchStart}
      className={`relative flex-1 h-full w-full flex items-center justify-center gap-3 overflow-auto select-none touch-none ${
        isCutoutSessionActive
          ? 'bg-black p-0'
          : isOverlayStudioOpen
          ? 'bg-black pt-14 pb-36 px-3 sm:px-6'
          : 'bg-[#07080A] px-4 pt-4 pb-16 md:px-8 md:pt-6 md:pb-16'
      }`}
    >
      {/* Optional Side-by-Side Comparison View */}
      {compareMode === 'side-by-side' && compareCanvas && !isCutoutSessionActive && !isOverlayStudioOpen && (
        <div className="relative inline-flex flex-col items-center justify-center shadow-2xl border border-white/[0.08] max-w-[46%] max-h-full">
          <canvas
            ref={sideCanvasRef}
            style={{ maxWidth: '100%', maxHeight: '72vh', width: 'auto', height: 'auto' }}
            className="block"
          />
          <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 border border-white/15 text-[10px] font-medium text-white">
            {compareLabel}
          </span>
        </div>
      )}

      {/* Primary Canvas Container */}
        <div
        className={`relative inline-flex items-center justify-center shadow-2xl shadow-black/70 alpha-checkerboard ${
          isCutoutSessionActive || isOverlayStudioOpen ? 'border-0' : 'border border-white/[0.08]'
        } ${compareMode === 'side-by-side' && !isCutoutSessionActive && !isOverlayStudioOpen ? 'max-w-[46%]' : ''} ${
          isOverlayErasePainting
            ? 'cursor-none'
            : isPaintMode || isEyedropperMode || isMagicWandMode || isLassoMode || isPolygonMode
            ? 'cursor-crosshair'
            : 'cursor-default'
        }`}
        style={{
          ...(zoom === 'fit' ? { maxWidth: '100%', maxHeight: '100%' } : {}),
          transform:
            pan.x !== 0 || pan.y !== 0 ? `translate(${pan.x}px, ${pan.y}px)` : undefined,
        }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={(e) => handlePointerUpOrCancel(e, false)}
        onPointerCancel={(e) => handlePointerUpOrCancel(e, true)}
        onPointerLeave={() => {
          setHoverPt(null);
          if (isOverlayErasePainting && !brushSliderDragging && activePointersRef.current.size === 0) {
            if (lingerTimerRef.current) clearTimeout(lingerTimerRef.current);
            lingerTimerRef.current = setTimeout(() => {
              if (!brushSliderDragging) {
                previewVisibleRef.current = false;
                scheduleBrushPreview();
              }
            }, 700);
          }
        }}
      >
        <canvas
          ref={displayCanvasRef}
          data-testid="editor-canvas"
          style={canvasStyle}
          className="block touch-none"
        />

        {/* Dedicated Live Feathered Glow Brush Preview Canvas (never baked into the edit) */}
        <canvas
          ref={brushPreviewCanvasRef}
          data-testid="brush-preview-canvas"
          width={outW}
          height={outH}
          style={canvasStyle}
          className="absolute inset-0 w-full h-full pointer-events-none block z-20"
        />

        {/* Split-Screen Wipe Layer */}
        {compareMode === 'split' && compareCanvas && !isCutoutSessionActive && (
          <>
            <canvas
              ref={compareCanvasRef}
              style={{
                ...canvasStyle,
                clipPath: `inset(0 ${(1 - splitPos) * 100}% 0 0)`,
              }}
              className="absolute inset-0 w-full h-full pointer-events-none block"
            />
            <div
              role="slider"
              aria-label="Before and after split comparison position"
              aria-valuemin={5}
              aria-valuemax={95}
              aria-valuenow={Math.round(splitPos * 100)}
              tabIndex={0}
              onPointerDown={(e) => {
                e.stopPropagation();
                setDraggingSplit(true);
              }}
              style={{ left: `${splitPos * 100}%` }}
              className="absolute top-0 bottom-0 w-0.5 bg-amber-400 cursor-ew-resize z-20"
            >
              <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-amber-400 text-zinc-950 font-bold text-[10px] flex items-center justify-center shadow-lg">
                ↔
              </div>
            </div>
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded bg-black/75 text-[10px] text-white pointer-events-none">
              {compareLabel}
            </span>
            <span className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded bg-amber-500/90 text-[10px] font-semibold text-zinc-950 pointer-events-none">
              Edited
            </span>
          </>
        )}

        {/* Overlay SVG for non-cutout brush strokes, blur reticle, and snap guides */}
        <svg
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          className="absolute inset-0 w-full h-full pointer-events-none"
        >
          {snapGuides.x !== null && (
            <line
              x1={snapGuides.x * 1000}
              y1="0"
              x2={snapGuides.x * 1000}
              y2="1000"
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray="8 6"
            />
          )}
          {snapGuides.y !== null && (
            <line
              x1="0"
              y1={snapGuides.y * 1000}
              x2="1000"
              y2={snapGuides.y * 1000}
              stroke="#38BDF8"
              strokeWidth="2"
              strokeDasharray="8 6"
            />
          )}

          {!isOverlayErasePainting && !isLassoMode && activeStroke.length > 0 && (
            <>
              {activeTool === 'overlays' && brush.neon && brush.tool === 'brush' && (
                <polyline
                  fill="none"
                  stroke={brush.color}
                  strokeWidth={Math.max(10, (brush.size / 720) * 1000 * 2.1)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeOpacity={0.55}
                  points={activeStroke.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
                />
              )}
              <polyline
                fill="none"
                stroke={
                  activeTool === 'masks' && maskBrush.active
                    ? maskBrush.tool === 'erase'
                      ? 'rgba(255, 255, 255, 0.5)'
                      : 'rgba(244, 63, 94, 0.65)'
                    : brush.tool === 'eraser'
                    ? 'rgba(255,255,255,0.5)'
                    : brush.neon
                    ? '#FFFFFF'
                    : brush.color
                }
                strokeWidth={
                  activeTool === 'masks' && maskBrush.active
                    ? Math.max(6, (maskBrush.size / 720) * 1000)
                    : Math.max(4, (brush.size / 720) * 1000)
                }
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={brush.opacity / 100}
                points={activeStroke.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
              />
            </>
          )}

          {isLassoMode && activeStroke.length > 1 && (
            <polygon
              fill="rgba(245, 158, 11, 0.14)"
              stroke="#F59E0B"
              strokeWidth="2.5"
              strokeDasharray="7 5"
              points={activeStroke.map((p) => `${p.x * 1000},${p.y * 1000}`).join(' ')}
            />
          )}

          {(isLassoMode || isPolygonMode) &&
            activeMaskLayer?.mask?.polygonPoints &&
            activeMaskLayer.mask.polygonPoints.length > 0 && (
              <g>
                {activeMaskLayer.mask.polygonPoints.length >= 3 ? (
                  <polygon
                    fill="rgba(56, 189, 248, 0.12)"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeDasharray="8 5"
                    points={activeMaskLayer.mask.polygonPoints
                      .map((p) => `${p.x * 1000},${p.y * 1000}`)
                      .join(' ')}
                  />
                ) : (
                  <polyline
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeDasharray="8 5"
                    points={activeMaskLayer.mask.polygonPoints
                      .map((p) => `${p.x * 1000},${p.y * 1000}`)
                      .join(' ')}
                  />
                )}
                {isPolygonMode &&
                  activeMaskLayer.mask.polygonPoints.map((p, idx) => (
                    <circle
                      key={idx}
                      cx={p.x * 1000}
                      cy={p.y * 1000}
                      r="6"
                      fill="#F59E0B"
                      stroke="#0B0C0F"
                      strokeWidth="2"
                    />
                  ))}
              </g>
            )}

          {isMagicWandMode && activeMaskLayer?.mask?.wand && (
            <g>
              <circle
                cx={activeMaskLayer.mask.wand.seedX * 1000}
                cy={activeMaskLayer.mask.wand.seedY * 1000}
                r="11"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="2.5"
              />
              <circle
                cx={activeMaskLayer.mask.wand.seedX * 1000}
                cy={activeMaskLayer.mask.wand.seedY * 1000}
                r="3.5"
                fill="#FFFFFF"
              />
            </g>
          )}

          {!isOverlayErasePainting && isPaintMode && hoverPt && (
            <ellipse
              cx={hoverPt.x * 1000}
              cy={hoverPt.y * 1000}
              rx={
                ((activeTool === 'masks' && maskBrush.active ? maskBrush.size : brush.size) / 720) *
                500 *
                (Math.min(outW, outH) / Math.max(1, outW))
              }
              ry={
                ((activeTool === 'masks' && maskBrush.active ? maskBrush.size : brush.size) / 720) *
                500 *
                (Math.min(outW, outH) / Math.max(1, outH))
              }
              fill="rgba(255, 255, 255, 0.14)"
              stroke="rgba(255, 255, 255, 0.9)"
              strokeWidth="2"
            />
          )}

          {activeTool === 'blur' && blurParams && blurParams.amount > 0 && (
            <g>
              <circle
                cx={blurParams.centerX * 1000}
                cy={blurParams.centerY * 1000}
                r={blurParams.radius * 750}
                fill="none"
                stroke="rgba(245, 158, 11, 0.75)"
                strokeWidth="2"
                strokeDasharray="8 6"
              />
              <circle
                cx={blurParams.centerX * 1000}
                cy={blurParams.centerY * 1000}
                r="10"
                fill="#F59E0B"
                stroke="#0B0C0F"
                strokeWidth="3"
              />
            </g>
          )}
        </svg>

        {/* Image Overlay Transform Bounding Box & Handles */}
        {(activeTool === 'overlay' || imageOverlays.some((o) => o.id === selectedLayerId)) &&
          !isCutoutSessionActive &&
          imageOverlays.map((ov) => {
            if (selectedLayerId !== ov.id) return null;
            const { dw, dh } = getOverlayBoxDimensions(outW, outH, ov.params);
            const widthPct = (dw / Math.max(1, outW)) * 100;
            const heightPct = (dh / Math.max(1, outH)) * 100;

            return (
              <div
                key={ov.id}
                data-testid="overlay-bounding-box"
                onPointerDown={(e) => {
                  if (ov.locked) return;
                  e.stopPropagation();
                  const pt = getNormalizedPoint(e.clientX, e.clientY);
                  (e.currentTarget as Element).setPointerCapture(e.pointerId);
                  setDraggingTarget({
                    kind: 'overlay',
                    id: ov.id,
                    offsetX: pt.x - ov.params.x,
                    offsetY: pt.y - ov.params.y,
                  });
                }}
                style={{
                  left: `${ov.params.x * 100}%`,
                  top: `${ov.params.y * 100}%`,
                  width: `${widthPct}%`,
                  height: `${heightPct}%`,
                  transform: `translate(-50%, -50%) rotate(${ov.params.rotation}deg)`,
                }}
                className={`absolute border-[1.5px] border-white/95 shadow-[0_0_0_1px_rgba(0,0,0,0.35)] z-10 ${
                  ov.locked ? 'cursor-not-allowed' : 'cursor-move'
                }`}
              >
                {(['top', 'right', 'bottom', 'left'] as const).map((edge) => {
                  const posClass =
                    edge === 'top'
                      ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize'
                      : edge === 'right'
                      ? 'top-1/2 right-0 translate-x-1/2 -translate-y-1/2 cursor-ew-resize'
                      : edge === 'bottom'
                      ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 cursor-ns-resize'
                      : 'top-1/2 left-0 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize';
                  return (
                    <button
                      key={edge}
                      type="button"
                      disabled={Boolean(ov.locked)}
                      aria-label={`Resize overlay ${edge} edge`}
                      onPointerDown={(e) => {
                        if (ov.locked) return;
                        e.stopPropagation();
                        const { cx, cy } = getOverlayScreenCenter(ov.params.x, ov.params.y);
                        const startDist = Math.max(12, Math.hypot(e.clientX - cx, e.clientY - cy));
                        (e.currentTarget as Element).setPointerCapture(e.pointerId);
                        setDraggingTarget({
                          kind: 'image-scale',
                          id: ov.id,
                          cx,
                          cy,
                          startDist,
                          startScale: ov.params.scale,
                        });
                      }}
                      className={`absolute ${posClass} w-3 h-3 rounded-full bg-white border border-black/25 shadow-md disabled:opacity-40`}
                    />
                  );
                })}

                <button
                  type="button"
                  disabled={Boolean(ov.locked)}
                  aria-label="Delete selected overlay"
                  title="Remove overlay"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDeleteOverlayLayer(ov.id);
                  }}
                  className="absolute -left-7 -top-7 w-6 h-6 rounded-full bg-white text-zinc-900 shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:opacity-40"
                >
                  <X className="w-3.5 h-3.5 stroke-[2.25]" />
                </button>

                <button
                  type="button"
                  disabled={Boolean(ov.locked)}
                  aria-label="Rotate selected overlay"
                  title="Drag to rotate overlay"
                  onPointerDown={(e) => {
                    if (ov.locked) return;
                    e.stopPropagation();
                    const { cx, cy } = getOverlayScreenCenter(ov.params.x, ov.params.y);
                    const startAngle = Math.atan2(e.clientY - cy, e.clientX - cx);
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    setDraggingTarget({
                      kind: 'image-rotate',
                      id: ov.id,
                      cx,
                      cy,
                      startAngle,
                      startRotation: ov.params.rotation,
                    });
                  }}
                  className="absolute -right-7 -top-7 w-6 h-6 rounded-full bg-white text-zinc-900 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:scale-105 transition-transform disabled:opacity-40"
                >
                  <RotateCw className="w-3.5 h-3.5 stroke-[2.15]" />
                </button>

                <button
                  type="button"
                  disabled={Boolean(ov.locked)}
                  aria-label="Scale selected overlay"
                  title="Drag to resize overlay"
                  onPointerDown={(e) => {
                    if (ov.locked) return;
                    e.stopPropagation();
                    const { cx, cy } = getOverlayScreenCenter(ov.params.x, ov.params.y);
                    const startDist = Math.max(12, Math.hypot(e.clientX - cx, e.clientY - cy));
                    (e.currentTarget as Element).setPointerCapture(e.pointerId);
                    setDraggingTarget({
                      kind: 'image-scale',
                      id: ov.id,
                      cx,
                      cy,
                      startDist,
                      startScale: ov.params.scale,
                    });
                  }}
                  className="absolute -right-7 -bottom-7 w-6 h-6 rounded-full bg-white text-zinc-900 shadow-lg flex items-center justify-center cursor-nwse-resize hover:scale-105 transition-transform disabled:opacity-40"
                >
                  <Maximize2 className="w-3.5 h-3.5 stroke-[2.15]" />
                </button>
              </div>
            );
          })}

        {snapGuides.angle !== null && !isCutoutSessionActive && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-sky-500 text-zinc-950 font-mono-num text-[11px] font-semibold pointer-events-none shadow-lg z-20">
            Snap {snapGuides.angle}°
          </div>
        )}

        {/* Selection + Scale/Rotate Handle for text, sticker & shape overlays */}
        {(activeTool === 'text' || activeTool === 'overlays') &&
          draggableOverlays.map((ov) => {
            const p = ov.params as { x: number; y: number };
            if (selectedLayerId !== ov.id) return null;
            return (
              <div
                key={ov.id}
                className="absolute -ml-4 -mt-4 flex items-center gap-1"
                style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
              >
                <div
                  aria-hidden="true"
                  className="pointer-events-none w-8 h-8 rounded-full border-2 border-amber-400 bg-amber-500/20"
                />
                <button
                  type="button"
                  aria-label="Drag to scale and rotate overlay"
                  title="Drag up/down to scale, left/right to rotate"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    (e.target as Element).setPointerCapture(e.pointerId);
                    setDraggingTarget({
                      kind: 'transform',
                      id: ov.id,
                      startX: e.clientX,
                      startY: e.clientY,
                    });
                  }}
                  className="w-6 h-6 rounded-full bg-amber-500 text-zinc-950 flex items-center justify-center shadow cursor-grab active:cursor-grabbing"
                >
                  <RotateCw className="w-3 h-3" />
                </button>
              </div>
            );
          })}

        {showOriginal && !isCutoutSessionActive && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/75 border border-white/15 text-[11px] font-medium text-white pointer-events-none">
            Before (Original)
          </div>
        )}

        {isEyedropperMode && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500 text-zinc-950 text-[11px] font-semibold pointer-events-none">
            Tap any pixel to sample colour
          </div>
        )}
      </div>

      {/* Floating Canvas Live Histogram Overlay */}
      {showCanvasHistogramOverlay && histogram && !isCutoutSessionActive && (
        <div className="hidden sm:block absolute top-3 right-3 w-52 p-2 rounded-lg bg-[#101216]/90 border border-white/15 backdrop-blur-md shadow-xl z-20">
          <HistogramView histogram={histogram} compact />
        </div>
      )}

      {/* Bottom Zoom, Compare Mode & Dimensions Bar */}
      {!isCutoutSessionActive && !isOverlayStudioOpen && (
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1 rounded-lg bg-[#14161B]/95 border border-white/[0.08] text-xs text-zinc-300 shadow-lg backdrop-blur-sm z-20">
          <span className="font-mono-num text-[11px] text-zinc-400 px-1.5 hidden sm:inline">
            {sourceWidth} × {sourceHeight}
            {isProxy ? ' · Proxy' : ''}
          </span>
          <span className="h-3.5 w-px bg-white/10 hidden sm:inline" />
          <button
            type="button"
            onClick={() => onChangeCompareMode(compareMode === 'split' ? 'off' : 'split')}
            aria-pressed={compareMode === 'split'}
            className={`px-2 py-0.5 rounded text-[11px] font-medium ${
              compareMode === 'split'
                ? 'bg-amber-500 text-zinc-950'
                : 'hover:bg-white/10 text-zinc-300'
            }`}
          >
            Split
          </button>
          <button
            type="button"
            onClick={() =>
              onChangeCompareMode(compareMode === 'side-by-side' ? 'off' : 'side-by-side')
            }
            aria-pressed={compareMode === 'side-by-side'}
            className={`px-2 py-0.5 rounded text-[11px] font-medium hidden sm:inline ${
              compareMode === 'side-by-side'
                ? 'bg-amber-500 text-zinc-950'
                : 'hover:bg-white/10 text-zinc-300'
            }`}
          >
            Side-by-Side
          </button>
          <span className="h-3.5 w-px bg-white/10" />
          <button
            type="button"
            onClick={() =>
              setZoom((z) => (z === 'fit' ? 0.75 : Math.max(0.25, Number((z - 0.25).toFixed(2)))))
            }
            aria-label="Zoom out"
            className="p-1 rounded hover:bg-white/10 text-zinc-300"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom('fit');
              setPan({ x: 0, y: 0 });
            }}
            aria-label="Fit image to screen"
            className="px-1.5 py-0.5 rounded hover:bg-white/10 font-mono-num text-[11px] text-zinc-200 flex items-center gap-1"
          >
            <Maximize className="w-3 h-3" />
            <span>{zoom === 'fit' ? 'Fit' : `${Math.round(zoom * 100)}%`}</span>
          </button>
          <button
            type="button"
            onClick={() =>
              setZoom((z) => (z === 'fit' ? 1 : Math.min(3, Number((z + 0.25).toFixed(2)))))
            }
            aria-label="Zoom in"
            className="p-1 rounded hover:bg-white/10 text-zinc-300"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
};
