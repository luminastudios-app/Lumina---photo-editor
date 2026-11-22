import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Blend,
  Check,
  CircleDashed,
  CopyPlus,
  Droplets,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Layers,
  Lock,
  Magnet,
  Maximize2,
  Move,
  Plus,
  Redo2,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Unlock,
  UserCheck,
  Wand2,
  X,
} from 'lucide-react';
import type {
  BlendMode,
  EditLayer,
  ImageLayerParams,
  OverlayEffectKind,
} from '../types/editor';
import {
  createDefaultOverlayBorder,
  createOverlayEffectItem,
} from '../engine/overlayEffects';
import { EffectPreviewGrid } from './EffectPreviewGrid';

type ActiveSubSheet = null | 'opacity' | 'effects' | 'border' | 'blend' | 'transform';

const OVERLAY_BLEND_MODES: BlendMode[] = [
  'normal',
  'multiply',
  'screen',
  'overlay',
  'soft-light',
  'hard-light',
  'difference',
  'exclusion',
  'color-dodge',
  'color-burn',
  'darken',
  'lighten',
  'hue',
  'saturation',
  'color',
  'luminosity',
];

const BORDER_COLOR_SWATCHES = [
  '#FFFFFF',
  '#0B0C0F',
  '#F59E0B',
  '#EC269D',
  '#38BDF8',
  '#34D399',
  '#A78BFA',
  '#FB7185',
];

interface OverlayStudioOverlayProps {
  allLayers: EditLayer[];
  selectedLayer: Extract<EditLayer, { type: 'image' }>;
  autoSnapEnabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onCancel: () => void;
  onApply: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onOpenEraser: () => void;
  onAddOverlayFile: (file: File) => void;
  onReplaceOverlayFile: (id: string, file: File) => void;
  onDuplicateOverlay: (id: string) => void;
  onToggleBgRemove: (id: string) => void;
  onToggleAutoSnap: (enabled: boolean) => void;
  onSelectOverlay: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDeleteOverlay: (id: string) => void;
  onMoveOverlayOrder: (fromIndex: number, toIndex: number) => void;
  onUpdateBase: (id: string, opacity: number, blendMode: BlendMode, commit: boolean) => void;
  onUpdateParams: (
    id: string,
    updater: (prev: ImageLayerParams) => ImageLayerParams,
    commit: boolean,
  ) => void;
  onResetOverlay: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const OverlayStudioOverlay: React.FC<OverlayStudioOverlayProps> = ({
  allLayers,
  selectedLayer,
  autoSnapEnabled,
  canUndo,
  canRedo,
  onCancel,
  onApply,
  onUndo,
  onRedo,
  onOpenEraser,
  onAddOverlayFile,
  onReplaceOverlayFile,
  onDuplicateOverlay,
  onToggleBgRemove,
  onToggleAutoSnap,
  onSelectOverlay,
  onToggleVisibility,
  onToggleLock,
  onDeleteOverlay,
  onMoveOverlayOrder,
  onUpdateBase,
  onUpdateParams,
  onResetOverlay,
  onDragStart,
  onDragEnd,
}) => {
  const addInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const [activeSheet, setActiveSheet] = useState<ActiveSubSheet>(null);
  const [layersOpen, setLayersOpen] = useState(false);

  const isLocked = Boolean(selectedLayer.locked);
  const border = selectedLayer.params.border ?? createDefaultOverlayBorder();
  const effects = selectedLayer.params.effects ?? [];
  const bgRemoved = effects.some((fx) => fx.kind === 'bg-remove' && fx.enabled);

  const overlayEntries = allLayers
    .map((layer, index) => ({ layer, index }))
    .filter(
      (entry): entry is { layer: Extract<EditLayer, { type: 'image' }>; index: number } =>
        entry.layer.type === 'image',
    );

  const toggleSheet = (sheet: Exclude<ActiveSubSheet, null>) => {
    setLayersOpen(false);
    setActiveSheet((cur) => (cur === sheet ? null : sheet));
  };

  const handleAddEffect = (kind: OverlayEffectKind) => {
    if (isLocked) return;
    const item = createOverlayEffectItem(kind);
    onUpdateParams(
      selectedLayer.id,
      (prev) => ({ ...prev, effects: [...(prev.effects ?? []), item] }),
      true,
    );
  };

  const sliderBackground = (value: number, min: number, max: number) => {
    const pct = Math.max(0, Math.min(100, ((value - min) / Math.max(1, max - min)) * 100));
    return `linear-gradient(to right, rgba(255,255,255,0.92) 0%, rgba(255,255,255,0.92) ${pct}%, rgba(255,255,255,0.28) ${pct}%, rgba(255,255,255,0.28) 100%)`;
  };

  return (
    <div
      data-testid="overlay-studio-ui"
      className="pointer-events-none fixed inset-0 z-30 flex flex-col justify-between"
    >
      <input
        ref={addInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddOverlayFile(f);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onReplaceOverlayFile(selectedLayer.id, f);
          e.target.value = '';
        }}
      />

      {/* Top Bar matching IMG_4873: Cancel | Undo Redo Eraser | Apply */}
      <div className="pointer-events-auto flex items-center justify-between px-3 sm:px-5 pt-[max(0.4rem,env(safe-area-inset-top))] pb-2 bg-[#090A0D]/92 backdrop-blur-md border-b border-white/[0.06]">
        <button
          type="button"
          onClick={onCancel}
          className="min-h-[44px] px-2.5 flex items-center justify-center text-[15px] font-medium text-white hover:text-zinc-300 active:opacity-75 transition-colors"
        >
          Cancel
        </button>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo overlay edit"
            title="Undo"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
          >
            <Undo2 className="w-5 h-5 stroke-[1.9]" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo overlay edit"
            title="Redo"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/10 disabled:opacity-35 transition-colors"
          >
            <Redo2 className="w-5 h-5 stroke-[1.9]" />
          </button>
          <button
            type="button"
            disabled={isLocked}
            onClick={onOpenEraser}
            aria-label="Erase or restore cutout"
            title="Erase & Cutout Studio"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
          >
            <Eraser className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        <button
          type="button"
          onClick={onApply}
          className="min-h-[44px] px-2.5 flex items-center justify-center text-[15px] font-semibold text-white hover:text-amber-300 active:opacity-75 transition-colors"
        >
          Apply
        </button>
      </div>

      {/* Floating Top-Right Overlay Stack (Layers) Button & Popover */}
      <div className="pointer-events-auto absolute top-14 sm:top-16 right-3 z-40 flex flex-col items-end gap-2">
        <button
          type="button"
          onClick={() => setLayersOpen((v) => !v)}
          aria-expanded={layersOpen}
          aria-label="Overlay layers stack"
          title="Stacked Overlays"
          className={`relative w-11 h-11 rounded-xl border backdrop-blur-md shadow-xl flex items-center justify-center transition-colors ${
            layersOpen
              ? 'bg-amber-500 text-zinc-950 border-amber-400'
              : 'bg-[#14161B]/90 text-white border-white/15 hover:bg-[#1E2129]'
          }`}
        >
          <Layers className="w-5 h-5" />
          {overlayEntries.length > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-fuchsia-500 text-[10px] font-bold text-white flex items-center justify-center shadow">
              {overlayEntries.length}
            </span>
          )}
        </button>

        {layersOpen && (
          <div
            aria-label="Overlay stack popover"
            className="w-72 max-w-[85vw] rounded-2xl bg-[#111318]/95 border border-white/15 backdrop-blur-xl shadow-2xl p-2.5 space-y-2"
          >
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-white">
                Overlay Stack ({overlayEntries.length})
              </span>
              <button
                type="button"
                onClick={() => setLayersOpen(false)}
                aria-label="Close overlay layers popover"
                className="p-1 rounded-lg text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ul className="space-y-1 max-h-56 overflow-y-auto studio-scroll">
              {[...overlayEntries].reverse().map(({ layer, index }) => {
                const isSel = selectedLayer.id === layer.id;
                return (
                  <li
                    key={layer.id}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border text-xs transition-colors ${
                      isSel
                        ? 'bg-fuchsia-500/15 border-fuchsia-400/60 text-white'
                        : 'bg-[#181A20] border-white/[0.06] text-zinc-300'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onSelectOverlay(layer.id);
                        setLayersOpen(false);
                      }}
                      className="flex items-center gap-2 min-w-0 flex-1 text-left"
                    >
                      <img
                        src={layer.params.src}
                        alt={layer.name}
                        className="w-7 h-7 rounded-md object-cover border border-white/10 shrink-0"
                      />
                      <span className="truncate text-[11px] font-medium">{layer.name}</span>
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        disabled={index >= allLayers.length - 1}
                        onClick={() => onMoveOverlayOrder(index, index + 1)}
                        aria-label={`Move ${layer.name} forward`}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-25"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index <= 0}
                        onClick={() => onMoveOverlayOrder(index, index - 1)}
                        aria-label={`Move ${layer.name} backward`}
                        className="p-1 text-zinc-400 hover:text-white disabled:opacity-25"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLock(layer.id)}
                        aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                        className={`p-1 ${layer.locked ? 'text-amber-400' : 'text-zinc-400 hover:text-white'}`}
                      >
                        {layer.locked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleVisibility(layer.id)}
                        aria-label={`${layer.enabled ? 'Hide' : 'Show'} ${layer.name}`}
                        className="p-1 text-zinc-400 hover:text-white"
                      >
                        {layer.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(layer.locked)}
                        onClick={() => onDeleteOverlay(layer.id)}
                        aria-label={`Delete ${layer.name}`}
                        className="p-1 text-zinc-400 hover:text-rose-400 disabled:opacity-25"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>

      {/* Bottom Area: Contextual Sub-sheet + Centered Remove Background Pill + Horizontal Icon Toolbar */}
      <div className="pointer-events-auto flex flex-col items-center w-full">
        {/* Contextual Floating Sub-Sheet right above Remove Background pill */}
        {activeSheet && (
          <div
            data-testid={`overlay-sheet-${activeSheet}`}
            className="w-[calc(100%-1.25rem)] max-w-lg mx-auto mb-2.5 rounded-2xl bg-[#0D0F14]/92 backdrop-blur-xl border border-white/15 px-3.5 py-3 shadow-2xl space-y-2.5"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-white capitalize">
                {activeSheet === 'border'
                  ? 'Object Contour Border'
                  : activeSheet === 'effects'
                  ? 'Overlay Effects'
                  : activeSheet}
              </span>
              <button
                type="button"
                onClick={() => setActiveSheet(null)}
                aria-label="Close tool tray"
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>

            {activeSheet === 'opacity' && (
              <div className="flex items-center gap-3 py-1">
                <span className="w-16 text-xs text-white/90 shrink-0">Opacity</span>
                <input
                  type="range"
                  aria-label="Overlay opacity slider"
                  min={0}
                  max={100}
                  value={selectedLayer.opacity ?? 100}
                  disabled={isLocked}
                  onPointerDown={onDragStart}
                  onPointerUp={onDragEnd}
                  onPointerCancel={onDragEnd}
                  onBlur={onDragEnd}
                  onChange={(e) =>
                    onUpdateBase(
                      selectedLayer.id,
                      Number(e.target.value),
                      selectedLayer.blendMode ?? 'normal',
                      false,
                    )
                  }
                  style={{ background: sliderBackground(selectedLayer.opacity ?? 100, 0, 100) }}
                  className="cutout-slider flex-1"
                />
                <span className="w-10 text-right font-mono-num text-xs text-white tabular-nums">
                  {selectedLayer.opacity ?? 100}%
                </span>
              </div>
            )}

            {activeSheet === 'blend' && (
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                {OVERLAY_BLEND_MODES.map((m) => {
                  const active = (selectedLayer.blendMode ?? 'normal') === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      disabled={isLocked}
                      aria-pressed={active}
                      onClick={() =>
                        onUpdateBase(selectedLayer.id, selectedLayer.opacity ?? 100, m, true)
                      }
                      className={`min-h-[38px] px-3 rounded-xl text-xs font-medium capitalize whitespace-nowrap shrink-0 border transition-colors ${
                        active
                          ? 'bg-white text-zinc-950 border-white font-semibold'
                          : 'bg-white/[0.07] border-white/10 text-zinc-200 hover:bg-white/15'
                      }`}
                    >
                      {m.replace('-', ' ')}
                    </button>
                  );
                })}
              </div>
            )}

            {activeSheet === 'border' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <span className="w-14 text-xs text-white/90 shrink-0">Size</span>
                  <input
                    type="range"
                    aria-label="Overlay border width"
                    min={0}
                    max={40}
                    value={border.width}
                    disabled={isLocked}
                    onPointerDown={onDragStart}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                    onBlur={onDragEnd}
                    onChange={(e) => {
                      const width = Number(e.target.value);
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({
                          ...prev,
                          border: { ...(prev.border ?? createDefaultOverlayBorder()), width },
                        }),
                        false,
                      );
                    }}
                    style={{ background: sliderBackground(border.width, 0, 40) }}
                    className="cutout-slider flex-1"
                  />
                  <span className="w-10 text-right font-mono-num text-xs text-white tabular-nums">
                    {border.width}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-14 text-xs text-white/90 shrink-0">Radius</span>
                  <input
                    type="range"
                    aria-label="Overlay corner radius"
                    min={0}
                    max={50}
                    value={border.radius}
                    disabled={isLocked}
                    onPointerDown={onDragStart}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                    onBlur={onDragEnd}
                    onChange={(e) => {
                      const radius = Number(e.target.value);
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({
                          ...prev,
                          border: { ...(prev.border ?? createDefaultOverlayBorder()), radius },
                        }),
                        false,
                      );
                    }}
                    style={{ background: sliderBackground(border.radius, 0, 50) }}
                    className="cutout-slider flex-1"
                  />
                  <span className="w-10 text-right font-mono-num text-xs text-white tabular-nums">
                    {border.radius}%
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div className="flex items-center gap-1">
                    {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                      <button
                        key={style}
                        type="button"
                        disabled={isLocked}
                        aria-pressed={border.style === style}
                        onClick={() =>
                          onUpdateParams(
                            selectedLayer.id,
                            (prev) => ({
                              ...prev,
                              border: { ...(prev.border ?? createDefaultOverlayBorder()), style },
                            }),
                            true,
                          )
                        }
                        className={`min-h-[36px] px-2.5 rounded-lg text-[11px] capitalize border transition-colors ${
                          border.style === style
                            ? 'bg-white text-zinc-950 border-white font-semibold'
                            : 'bg-white/[0.07] border-white/10 text-zinc-200 hover:bg-white/15'
                        }`}
                      >
                        {style}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                    {BORDER_COLOR_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        disabled={isLocked}
                        aria-label={`Set border color ${hex}`}
                        onClick={() =>
                          onUpdateParams(
                            selectedLayer.id,
                            (prev) => ({
                              ...prev,
                              border: {
                                ...(prev.border ?? createDefaultOverlayBorder()),
                                color: hex,
                              },
                            }),
                            true,
                          )
                        }
                        style={{ backgroundColor: hex }}
                        className={`w-6 h-6 rounded-full border shrink-0 transition-transform ${
                          border.color.toUpperCase() === hex
                            ? 'border-amber-400 scale-110 ring-2 ring-white/50'
                            : 'border-white/30'
                        }`}
                      />
                    ))}
                    <input
                      type="color"
                      aria-label="Custom border color"
                      disabled={isLocked}
                      value={border.color}
                      onChange={(e) =>
                        onUpdateParams(
                          selectedLayer.id,
                          (prev) => ({
                            ...prev,
                            border: {
                              ...(prev.border ?? createDefaultOverlayBorder()),
                              color: e.target.value,
                            },
                          }),
                          true,
                        )
                      }
                      className="w-7 h-7 rounded bg-transparent cursor-pointer shrink-0"
                    />
                  </div>
                </div>
              </div>
            )}

            {activeSheet === 'transform' && (
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  <button
                    type="button"
                    disabled={isLocked}
                    aria-pressed={Boolean(selectedLayer.params.flipH)}
                    onClick={() =>
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, flipH: !prev.flipH }),
                        true,
                      )
                    }
                    className={`min-h-[38px] px-2.5 rounded-lg text-xs flex items-center gap-1 shrink-0 border ${
                      selectedLayer.params.flipH
                        ? 'bg-white text-zinc-950 border-white font-semibold'
                        : 'bg-white/[0.07] border-white/10 text-zinc-200'
                    }`}
                  >
                    <FlipHorizontal2 className="w-3.5 h-3.5" />
                    <span>Flip H</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    aria-pressed={Boolean(selectedLayer.params.flipV)}
                    onClick={() =>
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, flipV: !prev.flipV }),
                        true,
                      )
                    }
                    className={`min-h-[38px] px-2.5 rounded-lg text-xs flex items-center gap-1 shrink-0 border ${
                      selectedLayer.params.flipV
                        ? 'bg-white text-zinc-950 border-white font-semibold'
                        : 'bg-white/[0.07] border-white/10 text-zinc-200'
                    }`}
                  >
                    <FlipVertical2 className="w-3.5 h-3.5" />
                    <span>Flip V</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, rotation: ((prev.rotation + 90 + 180) % 360) - 180 }),
                        true,
                      )
                    }
                    className="min-h-[38px] px-2.5 rounded-lg text-xs flex items-center gap-1 shrink-0 bg-white/[0.07] border border-white/10 text-zinc-200 hover:bg-white/15"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Rotate 90°</span>
                  </button>
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, x: 0.5, y: 0.5 }),
                        true,
                      )
                    }
                    className="min-h-[38px] px-2.5 rounded-lg text-xs flex items-center gap-1 shrink-0 bg-white/[0.07] border border-white/10 text-zinc-200 hover:bg-white/15"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Center</span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={autoSnapEnabled}
                    onClick={() => onToggleAutoSnap(!autoSnapEnabled)}
                    className={`min-h-[38px] px-2.5 rounded-lg text-xs flex items-center gap-1 shrink-0 border ${
                      autoSnapEnabled
                        ? 'bg-amber-500/20 border-amber-400/60 text-amber-200'
                        : 'bg-white/[0.07] border-white/10 text-zinc-300'
                    }`}
                  >
                    <Magnet className="w-3.5 h-3.5" />
                    <span>Snap</span>
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 text-xs text-white/90 shrink-0">Scale</span>
                  <input
                    type="range"
                    aria-label="Overlay scale slider"
                    min={10}
                    max={250}
                    value={Math.round(selectedLayer.params.scale * 100)}
                    disabled={isLocked}
                    onPointerDown={onDragStart}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                    onBlur={onDragEnd}
                    onChange={(e) => {
                      const scale = Number((Number(e.target.value) / 100).toFixed(2));
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, scale }),
                        false,
                      );
                    }}
                    style={{
                      background: sliderBackground(
                        Math.round(selectedLayer.params.scale * 100),
                        10,
                        250,
                      ),
                    }}
                    className="cutout-slider flex-1"
                  />
                  <span className="w-11 text-right font-mono-num text-xs text-white tabular-nums">
                    {Math.round(selectedLayer.params.scale * 100)}%
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="w-16 text-xs text-white/90 shrink-0">Rotate</span>
                  <input
                    type="range"
                    aria-label="Overlay rotation slider"
                    min={-180}
                    max={180}
                    value={selectedLayer.params.rotation}
                    disabled={isLocked}
                    onPointerDown={onDragStart}
                    onPointerUp={onDragEnd}
                    onPointerCancel={onDragEnd}
                    onBlur={onDragEnd}
                    onChange={(e) => {
                      const rotation = Number(e.target.value);
                      onUpdateParams(
                        selectedLayer.id,
                        (prev) => ({ ...prev, rotation }),
                        false,
                      );
                    }}
                    style={{
                      background: sliderBackground(selectedLayer.params.rotation, -180, 180),
                    }}
                    className="cutout-slider flex-1"
                  />
                  <span className="w-11 text-right font-mono-num text-xs text-white tabular-nums">
                    {selectedLayer.params.rotation}°
                  </span>
                </div>
              </div>
            )}

            {activeSheet === 'effects' && (
              <div className="space-y-2">
                {effects.length > 0 && (
                  <div className="space-y-1.5 max-h-28 overflow-y-auto studio-scroll pr-1">
                    {effects.map((fx, idx) => (
                      <div
                        key={fx.id}
                        className="flex items-center gap-2 bg-white/[0.06] rounded-xl px-2.5 py-1.5"
                      >
                        <span className="text-[11px] font-medium text-white w-24 truncate shrink-0">
                          {fx.label}
                        </span>
                        <input
                          type="range"
                          aria-label={`${fx.label} intensity`}
                          min={0}
                          max={100}
                          value={fx.intensity}
                          disabled={isLocked}
                          onPointerDown={onDragStart}
                          onPointerUp={onDragEnd}
                          onPointerCancel={onDragEnd}
                          onBlur={onDragEnd}
                          onChange={(e) => {
                            const intensity = Number(e.target.value);
                            onUpdateParams(
                              selectedLayer.id,
                              (prev) => ({
                                ...prev,
                                effects: (prev.effects ?? []).map((item) =>
                                  item.id === fx.id ? { ...item, intensity } : item,
                                ),
                              }),
                              false,
                            );
                          }}
                          style={{ background: sliderBackground(fx.intensity, 0, 100) }}
                          className="cutout-slider flex-1"
                        />
                        <button
                          type="button"
                          disabled={isLocked || idx === 0}
                          aria-label={`Move ${fx.label} up`}
                          onClick={() =>
                            onUpdateParams(
                              selectedLayer.id,
                              (prev) => {
                                const list = [...(prev.effects ?? [])];
                                const [moved] = list.splice(idx, 1);
                                list.splice(idx - 1, 0, moved);
                                return { ...prev, effects: list };
                              },
                              true,
                            )
                          }
                          className="p-1 text-zinc-400 hover:text-white disabled:opacity-25"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          aria-label={`Remove ${fx.label}`}
                          onClick={() =>
                            onUpdateParams(
                              selectedLayer.id,
                              (prev) => ({
                                ...prev,
                                effects: (prev.effects ?? []).filter((item) => item.id !== fx.id),
                              }),
                              true,
                            )
                          }
                          className="p-1 text-zinc-400 hover:text-rose-400"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <EffectPreviewGrid
                  sourceSrc={selectedLayer.params.src}
                  activeKinds={effects.filter((e) => e.enabled).map((e) => e.kind)}
                  disabled={isLocked}
                  layout="strip"
                  darkSurface
                  onPickEffect={handleAddEffect}
                />
              </div>
            )}
          </div>
        )}

        {/* Centered Remove Background Pill matching IMG_4873 */}
        <div className="pb-2.5 pt-1 flex items-center justify-center">
          <button
            type="button"
            disabled={isLocked}
            onClick={() => onToggleBgRemove(selectedLayer.id)}
            aria-pressed={bgRemoved}
            className={`min-h-[44px] px-5 py-2.5 rounded-full font-semibold text-sm text-white flex items-center gap-2 shadow-xl transition-all active:scale-95 disabled:opacity-45 ${
              bgRemoved
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 ring-2 ring-white/50 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-[#EC269D] via-[#E11D9A] to-[#D946EF] hover:brightness-110 shadow-fuchsia-500/30'
            }`}
          >
            <UserCheck className="w-4 h-4 stroke-[2.2]" />
            <span>{bgRemoved ? 'Background Removed' : 'Remove Background'}</span>
          </button>
        </div>

        {/* Horizontal Bottom Tool Bar matching IMG_4873 */}
        <div className="w-full bg-[#090A0D]/95 border-t border-white/[0.08] px-2 pt-1.5 pb-[max(0.55rem,env(safe-area-inset-bottom))] backdrop-blur-md">
          <div className="flex items-center justify-start sm:justify-center gap-1.5 overflow-x-auto no-scrollbar max-w-4xl mx-auto">
            <button
              type="button"
              onClick={() => addInputRef.current?.click()}
              aria-label="Add another image overlay"
              className="min-w-[56px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 text-white hover:bg-white/10 shrink-0 transition-colors"
            >
              <Plus className="w-6 h-6 stroke-[1.9]" />
              <span className="text-[11px] font-medium whitespace-nowrap text-zinc-300">Add</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => replaceInputRef.current?.click()}
              className="min-w-[60px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-200 hover:text-white hover:bg-white/10 shrink-0 disabled:opacity-35 transition-colors"
            >
              <RefreshCw className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Replace</span>
            </button>

            <button
              type="button"
              onClick={() => onDuplicateOverlay(selectedLayer.id)}
              className="min-w-[64px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-200 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
            >
              <CopyPlus className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Duplicate</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSheet('opacity')}
              aria-pressed={activeSheet === 'opacity'}
              className={`min-w-[60px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-colors ${
                activeSheet === 'opacity'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Droplets className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Opacity</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => onToggleBgRemove(selectedLayer.id)}
              aria-pressed={bgRemoved}
              className={`min-w-[70px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 disabled:opacity-35 transition-colors ${
                bgRemoved
                  ? 'bg-fuchsia-500/20 text-fuchsia-300'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Wand2 className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Remove BG</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSheet('effects')}
              aria-pressed={activeSheet === 'effects'}
              className={`min-w-[60px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-colors ${
                activeSheet === 'effects'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Sparkles className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Effects</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSheet('border')}
              aria-pressed={activeSheet === 'border'}
              className={`min-w-[60px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-colors ${
                activeSheet === 'border'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              {border.style === 'dashed' || border.style === 'dotted' ? (
                <CircleDashed className="w-5 h-5 stroke-[1.8]" />
              ) : (
                <Square className="w-5 h-5 stroke-[1.8]" />
              )}
              <span className="text-[11px] font-medium whitespace-nowrap">Border</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSheet('blend')}
              aria-pressed={activeSheet === 'blend'}
              className={`min-w-[60px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-colors ${
                activeSheet === 'blend'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Blend className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Blend</span>
            </button>

            <button
              type="button"
              onClick={() => toggleSheet('transform')}
              aria-pressed={activeSheet === 'transform'}
              className={`min-w-[66px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 shrink-0 transition-colors ${
                activeSheet === 'transform'
                  ? 'bg-white/15 text-white'
                  : 'text-zinc-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <Maximize2 className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Transform</span>
            </button>

            <button
              type="button"
              disabled={isLocked}
              onClick={() => onResetOverlay(selectedLayer.id)}
              className="min-w-[58px] min-h-[54px] px-2 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-200 hover:text-amber-300 hover:bg-white/10 shrink-0 disabled:opacity-35 transition-colors"
            >
              <RotateCcw className="w-5 h-5 stroke-[1.8]" />
              <span className="text-[11px] font-medium whitespace-nowrap">Reset</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
