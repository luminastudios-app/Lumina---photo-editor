import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CopyPlus,
  Eraser,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  ImagePlus,
  Lock,
  Magnet,
  Paintbrush,
  Redo2,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import type {
  BlendMode,
  EditLayer,
  ImageLayerParams,
  OverlayEffectKind,
} from '../../types/editor';
import {
  createDefaultOverlayBorder,
  createOverlayEffectItem,
} from '../../engine/overlayEffects';
import { EffectPreviewGrid } from '../EffectPreviewGrid';
import { StudioSlider } from '../StudioSlider';

export type CutoutToolId = 'select' | 'restore' | 'erase' | 'shape' | 'invert';

export interface SingleBrushSettings {
  size: number;
  opacity: number;
  hardness: number;
}

export interface OverlayBrushState {
  active: boolean;
  mode: 'assisted' | 'manual';
  tool: CutoutToolId;
  lastPaintTool: 'erase' | 'restore';
  erase: SingleBrushSettings;
  restore: SingleBrushSettings;
}

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

interface OverlayPanelProps {
  allLayers: EditLayer[];
  selectedLayerId: string | null;
  overlayBrush: OverlayBrushState;
  autoSnapEnabled: boolean;
  canUndoOverlay: (id: string) => boolean;
  canRedoOverlay: (id: string) => boolean;
  onOpenOverlayStudio: () => void;
  onOpenCutoutStudio: (tool: 'erase' | 'restore') => void;
  onToggleAutoSnap: (enabled: boolean) => void;
  onAddImageOverlay: (file: File) => void;
  onSelectOverlay: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicateOverlay: (id: string) => void;
  onDeleteOverlay: (id: string) => void;
  onMoveOverlayOrder: (fromIndex: number, toIndex: number) => void;
  onUpdateOverlayBase: (id: string, opacity: number, blendMode: BlendMode, commit: boolean) => void;
  onUpdateOverlayParams: (
    id: string,
    updater: (prev: ImageLayerParams) => ImageLayerParams,
    commit: boolean,
  ) => void;
  onUndoOverlay: (id: string) => void;
  onRedoOverlay: (id: string) => void;
  onResetOverlay: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const OverlayPanel: React.FC<OverlayPanelProps> = ({
  allLayers,
  selectedLayerId,
  overlayBrush,
  autoSnapEnabled,
  canUndoOverlay,
  canRedoOverlay,
  onOpenOverlayStudio,
  onOpenCutoutStudio,
  onToggleAutoSnap,
  onAddImageOverlay,
  onSelectOverlay,
  onToggleVisibility,
  onToggleLock,
  onDuplicateOverlay,
  onDeleteOverlay,
  onMoveOverlayOrder,
  onUpdateOverlayBase,
  onUpdateOverlayParams,
  onUndoOverlay,
  onRedoOverlay,
  onResetOverlay,
  onDragStart,
  onDragEnd,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const overlayEntries = allLayers
    .map((layer, index) => ({ layer, index }))
    .filter(
      (entry): entry is { layer: Extract<EditLayer, { type: 'image' }>; index: number } =>
        entry.layer.type === 'image',
    );

  const selectedEntry =
    overlayEntries.find((e) => e.layer.id === selectedLayerId) ??
    overlayEntries[overlayEntries.length - 1] ??
    null;
  const selected = selectedEntry?.layer ?? null;
  const isLocked = Boolean(selected?.locked);

  const border = selected?.params.border ?? createDefaultOverlayBorder();
  const effects = selected?.params.effects ?? [];
  const eraseStrokes = selected?.params.eraseStrokes ?? [];

  const handleAddEffect = (kind: OverlayEffectKind) => {
    if (!selected || isLocked) return;
    const item = createOverlayEffectItem(kind);
    onUpdateOverlayParams(
      selected.id,
      (prev) => ({ ...prev, effects: [...(prev.effects ?? []), item] }),
      true,
    );
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onAddImageOverlay(f);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Image Overlays</h2>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <ImagePlus className="w-3.5 h-3.5" />
          <span>Add Overlay</span>
        </button>
      </div>

      {/* Drag-and-drop / File Picker / Clipboard Paste Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setDragOver(false);
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/'),
          );
          for (const f of files) {
            onAddImageOverlay(f);
          }
        }}
        className={`rounded-xl border border-dashed p-3 text-center transition-colors ${
          dragOver
            ? 'border-amber-400 bg-amber-500/10'
            : 'border-white/15 bg-[#0B0C0F]/70 hover:border-white/25'
        }`}
      >
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="w-full flex flex-col items-center gap-1 text-zinc-300"
        >
          <Upload className="w-4 h-4 text-amber-400" />
          <span className="text-[11px] font-medium">
            Drop an image, choose a file, or press Ctrl+V
          </span>
          <span className="text-[10px] text-zinc-500">
            Stack multiple independent non-destructive overlays
          </span>
        </button>
      </div>

      {/* Overlay Stack List */}
      <section className="space-y-1.5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">
            Added Overlays ({overlayEntries.length})
          </h3>
          {overlayEntries.length > 1 && (
            <span className="text-[10px] text-zinc-500">Top to bottom</span>
          )}
        </div>

        {overlayEntries.length === 0 ? (
          <div className="rounded-lg bg-[#0B0C0F] border border-white/[0.06] px-3 py-3 text-[11px] text-zinc-500 text-center">
            No image overlays yet. Add one above to blend, erase cutouts, or stack effects.
          </div>
        ) : (
          <ul className="space-y-1 max-h-40 overflow-y-auto studio-scroll" aria-label="Added overlays list">
            {[...overlayEntries].reverse().map(({ layer, index }) => {
              const isSel = selected?.id === layer.id;
              const fxCount = layer.params.effects?.filter((e) => e.enabled).length ?? 0;
              const strokeCount = layer.params.eraseStrokes?.length ?? 0;

              return (
                <li
                  key={layer.id}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                    isSel
                      ? 'bg-amber-500/12 border-amber-500/50 text-white'
                      : 'bg-[#181A20] border-white/[0.06] text-zinc-300 hover:border-white/[0.15]'
                  } ${!layer.enabled ? 'opacity-50' : ''}`}
                >
                  <button
                    type="button"
                    onClick={() => onSelectOverlay(layer.id)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left"
                  >
                    <img
                      src={layer.params.src}
                      alt={layer.name}
                      className="w-7 h-7 rounded object-cover border border-white/10 shrink-0 bg-zinc-900"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[11px] font-medium">{layer.name}</div>
                      <div className="text-[9px] text-zinc-500 truncate">
                        {layer.blendMode && layer.blendMode !== 'normal'
                          ? layer.blendMode
                          : 'normal'}{' '}
                        · {layer.opacity ?? 100}%
                        {fxCount > 0 ? ` · ${fxCount} FX` : ''}
                        {strokeCount > 0 ? ` · Masked` : ''}
                      </div>
                    </div>
                  </button>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      type="button"
                      disabled={index >= allLayers.length - 1}
                      onClick={() => onMoveOverlayOrder(index, index + 1)}
                      aria-label={`Move ${layer.name} forward`}
                      title="Bring forward"
                      className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={index <= 0}
                      onClick={() => onMoveOverlayOrder(index, index - 1)}
                      aria-label={`Move ${layer.name} backward`}
                      title="Send backward"
                      className="p-1 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleLock(layer.id)}
                      aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                      title={layer.locked ? 'Unlock overlay' : 'Lock overlay'}
                      className={`p-1 rounded ${
                        layer.locked ? 'text-amber-400' : 'text-zinc-400 hover:text-white'
                      }`}
                    >
                      {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      onClick={() => onToggleVisibility(layer.id)}
                      aria-label={`${layer.enabled ? 'Hide' : 'Show'} ${layer.name}`}
                      title={layer.enabled ? 'Hide overlay' : 'Show overlay'}
                      className="p-1 rounded text-zinc-400 hover:text-white"
                    >
                      {layer.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    </button>
                    <button
                      type="button"
                      disabled={Boolean(layer.locked)}
                      onClick={() => onDeleteOverlay(layer.id)}
                      aria-label={`Delete ${layer.name}`}
                      title="Delete overlay"
                      className="p-1 rounded text-zinc-400 hover:text-rose-400 disabled:opacity-25"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Selected Overlay Editor */}
      {selected && (
        <div className="space-y-4 pt-3 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={onOpenOverlayStudio}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#EC269D] to-[#D946EF] hover:brightness-110 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-lg shadow-fuchsia-500/20 transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Overlay Studio</span>
          </button>

          {/* Per-Overlay History & Quick Actions Bar */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={!canUndoOverlay(selected.id)}
                onClick={() => onUndoOverlay(selected.id)}
                aria-label="Undo overlay edit"
                title="Undo overlay edit"
                className="px-2 py-1 rounded bg-[#181A20] border border-white/10 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-30 flex items-center gap-1"
              >
                <Undo2 className="w-3 h-3" />
                <span>Undo</span>
              </button>
              <button
                type="button"
                disabled={!canRedoOverlay(selected.id)}
                onClick={() => onRedoOverlay(selected.id)}
                aria-label="Redo overlay edit"
                title="Redo overlay edit"
                className="px-2 py-1 rounded bg-[#181A20] border border-white/10 text-[11px] text-zinc-200 hover:bg-white/10 disabled:opacity-30 flex items-center gap-1"
              >
                <Redo2 className="w-3 h-3" />
              </button>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onDuplicateOverlay(selected.id)}
                aria-label="Duplicate selected overlay"
                title="Duplicate overlay"
                className="px-2 py-1 rounded bg-[#181A20] border border-white/10 text-[11px] text-zinc-200 hover:bg-white/10 flex items-center gap-1"
              >
                <CopyPlus className="w-3 h-3" />
                <span>Duplicate</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onResetOverlay(selected.id)}
                aria-label="Reset overlay effects and mask"
                title="Reset effects and erasing (keeps image)"
                className="px-2 py-1 rounded bg-[#181A20] border border-white/10 text-[11px] text-zinc-300 hover:text-amber-300 disabled:opacity-30 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Overlay</span>
              </button>
            </div>
          </div>

          {isLocked && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 text-[11px] text-amber-300 flex items-center justify-between">
              <span>This overlay is locked. Unlock to edit or erase.</span>
              <button
                type="button"
                onClick={() => onToggleLock(selected.id)}
                className="underline font-medium"
              >
                Unlock
              </button>
            </div>
          )}

          {/* Cutout / Erase & Restore Launcher (opens floating Cutout Studio over full canvas) */}
          <section className="space-y-2.5 rounded-xl bg-[#0B0C0F] border border-white/[0.06] p-2.5">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-zinc-400">Erase & Restore Cutout</h3>
              {(eraseStrokes.length > 0 ||
                (selected.params.cutoutShape && selected.params.cutoutShape !== 'none') ||
                selected.params.cutoutInverted) && (
                <span className="text-[10px] text-amber-300 font-medium">Cutout Active</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onOpenCutoutStudio('erase')}
                aria-pressed={overlayBrush.active && overlayBrush.lastPaintTool === 'erase'}
                className="flex items-center justify-center gap-1.5 py-2 rounded-md text-xs border disabled:opacity-40 bg-[#181A20] border-white/[0.08] text-zinc-200 hover:bg-amber-500 hover:text-zinc-950 hover:border-amber-500 hover:font-semibold transition-colors"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Erase Cutout</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => onOpenCutoutStudio('restore')}
                aria-pressed={overlayBrush.active && overlayBrush.lastPaintTool === 'restore'}
                className="flex items-center justify-center gap-1.5 py-2 rounded-md text-xs border disabled:opacity-40 bg-[#181A20] border-white/[0.08] text-zinc-200 hover:bg-emerald-400 hover:text-zinc-950 hover:border-emerald-400 hover:font-semibold transition-colors"
              >
                <Paintbrush className="w-3.5 h-3.5" />
                <span>Restore</span>
              </button>
            </div>

            <p className="text-[10px] text-zinc-500">
              Opens full-screen cutout studio with floating Size, Opacity &amp; Hardness controls.
            </p>

            {(eraseStrokes.length > 0 ||
              (selected.params.cutoutShape && selected.params.cutoutShape !== 'none') ||
              selected.params.cutoutInverted) && (
              <div className="flex items-center gap-1.5 pt-1">
                {eraseStrokes.length > 0 && (
                  <button
                    type="button"
                    disabled={isLocked}
                    onClick={() =>
                      onUpdateOverlayParams(
                        selected.id,
                        (prev) => ({
                          ...prev,
                          eraseStrokes: (prev.eraseStrokes ?? []).slice(0, -1),
                        }),
                        true,
                      )
                    }
                    className="flex-1 py-1 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300 disabled:opacity-35"
                  >
                    Undo Stroke
                  </button>
                )}
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    onUpdateOverlayParams(
                      selected.id,
                      (prev) => ({
                        ...prev,
                        eraseStrokes: [],
                        cutoutShape: 'none',
                        cutoutInverted: false,
                      }),
                      true,
                    )
                  }
                  className="flex-1 py-1 rounded bg-[#181A20] hover:text-amber-300 border border-white/10 text-[11px] text-zinc-300 disabled:opacity-35"
                >
                  Reset Mask
                </button>
              </div>
            )}
          </section>

          {/* Blend Mode & Opacity */}
          <section className="space-y-2.5 pt-2 border-t border-white/[0.06]">
            <h3 className="text-[11px] font-medium text-zinc-500">Blend Mode & Opacity</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="overlay-blend-select" className="text-[11px] text-zinc-400 shrink-0">
                Blend
              </label>
              <select
                id="overlay-blend-select"
                aria-label="Overlay blend mode"
                disabled={isLocked}
                value={selected.blendMode ?? 'normal'}
                onChange={(e) =>
                  onUpdateOverlayBase(
                    selected.id,
                    selected.opacity ?? 100,
                    e.target.value as BlendMode,
                    true,
                  )
                }
                className="flex-1 rounded-md bg-[#181A20] border border-white/10 px-2 py-1 text-xs text-zinc-200 capitalize"
              >
                {OVERLAY_BLEND_MODES.map((m) => (
                  <option key={m} value={m}>
                    {m.replace('-', ' ')}
                  </option>
                ))}
              </select>
            </div>

            <StudioSlider
              label="Opacity"
              value={selected.opacity ?? 100}
              min={0}
              max={100}
              defaultValue={100}
              unit="%"
              onChange={(op) =>
                onUpdateOverlayBase(selected.id, op, selected.blendMode ?? 'normal', false)
              }
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </section>

          {/* Transform & Auto-Snap */}
          <section className="space-y-2.5 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-zinc-500">Transform</h3>
              <button
                type="button"
                aria-pressed={autoSnapEnabled}
                onClick={() => onToggleAutoSnap(!autoSnapEnabled)}
                className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 border transition-colors ${
                  autoSnapEnabled
                    ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                    : 'bg-[#181A20] border-white/10 text-zinc-400'
                }`}
              >
                <Magnet className="w-3 h-3" />
                <span>Auto-Snap</span>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                disabled={isLocked}
                aria-pressed={Boolean(selected.params.flipH)}
                onClick={() =>
                  onUpdateOverlayParams(
                    selected.id,
                    (prev) => ({ ...prev, flipH: !prev.flipH }),
                    true,
                  )
                }
                className={`py-1.5 rounded-md text-[11px] flex items-center justify-center gap-1 border disabled:opacity-40 ${
                  selected.params.flipH
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-[#181A20] border-white/[0.08] text-zinc-300 hover:bg-white/10'
                }`}
              >
                <FlipHorizontal2 className="w-3.5 h-3.5" />
                <span>Flip H</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                aria-pressed={Boolean(selected.params.flipV)}
                onClick={() =>
                  onUpdateOverlayParams(
                    selected.id,
                    (prev) => ({ ...prev, flipV: !prev.flipV }),
                    true,
                  )
                }
                className={`py-1.5 rounded-md text-[11px] flex items-center justify-center gap-1 border disabled:opacity-40 ${
                  selected.params.flipV
                    ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                    : 'bg-[#181A20] border-white/[0.08] text-zinc-300 hover:bg-white/10'
                }`}
              >
                <FlipVertical2 className="w-3.5 h-3.5" />
                <span>Flip V</span>
              </button>
              <button
                type="button"
                disabled={isLocked}
                onClick={() =>
                  onUpdateOverlayParams(
                    selected.id,
                    (prev) => ({ ...prev, x: 0.5, y: 0.5 }),
                    true,
                  )
                }
                className="py-1.5 rounded-md text-[11px] bg-[#181A20] border border-white/[0.08] text-zinc-300 hover:bg-white/10 disabled:opacity-40"
              >
                Center
              </button>
            </div>

            <StudioSlider
              label="Scale"
              value={Math.round(selected.params.scale * 100)}
              min={10}
              max={250}
              defaultValue={55}
              unit="%"
              onChange={(pct) => {
                if (isLocked) return;
                onUpdateOverlayParams(
                  selected.id,
                  (prev) => ({ ...prev, scale: Number((pct / 100).toFixed(2)) }),
                  false,
                );
              }}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />

            <StudioSlider
              label="Rotation"
              value={selected.params.rotation}
              min={-180}
              max={180}
              defaultValue={0}
              unit="°"
              onChange={(rotation) => {
                if (isLocked) return;
                onUpdateOverlayParams(selected.id, (prev) => ({ ...prev, rotation }), false);
              }}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </section>

          {/* Border */}
          <section className="space-y-2.5 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-zinc-500">Overlay Border</h3>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-zinc-500">Color</span>
                <input
                  type="color"
                  aria-label="Overlay border color"
                  disabled={isLocked}
                  value={border.color}
                  onChange={(e) =>
                    onUpdateOverlayParams(
                      selected.id,
                      (prev) => ({
                        ...prev,
                        border: { ...(prev.border ?? createDefaultOverlayBorder()), color: e.target.value },
                      }),
                      true,
                    )
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {(['solid', 'dashed', 'dotted'] as const).map((style) => (
                <button
                  key={style}
                  type="button"
                  disabled={isLocked}
                  aria-pressed={border.style === style}
                  onClick={() =>
                    onUpdateOverlayParams(
                      selected.id,
                      (prev) => ({
                        ...prev,
                        border: { ...(prev.border ?? createDefaultOverlayBorder()), style },
                      }),
                      true,
                    )
                  }
                  className={`py-1 rounded-md text-[11px] capitalize border disabled:opacity-40 ${
                    border.style === style
                      ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                      : 'bg-[#181A20] border-white/[0.06] text-zinc-300 hover:bg-white/10'
                  }`}
                >
                  {style}
                </button>
              ))}
            </div>

            <StudioSlider
              label="Border Width"
              value={border.width}
              min={0}
              max={40}
              defaultValue={0}
              unit="px"
              onChange={(width) => {
                if (isLocked) return;
                onUpdateOverlayParams(
                  selected.id,
                  (prev) => ({
                    ...prev,
                    border: { ...(prev.border ?? createDefaultOverlayBorder()), width },
                  }),
                  false,
                );
              }}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />

            <StudioSlider
              label="Corner Radius"
              value={border.radius}
              min={0}
              max={50}
              defaultValue={0}
              unit="%"
              onChange={(radius) => {
                if (isLocked) return;
                onUpdateOverlayParams(
                  selected.id,
                  (prev) => ({
                    ...prev,
                    border: { ...(prev.border ?? createDefaultOverlayBorder()), radius },
                  }),
                  false,
                );
              }}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </section>

          {/* Applied Effects Stack (Reorderable, Removable, Intensity Slider) */}
          <section className="space-y-2.5 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <h3 className="text-[11px] font-medium text-zinc-500 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-400" />
                <span>Effects Stack ({effects.length})</span>
              </h3>
              {effects.length > 0 && (
                <button
                  type="button"
                  disabled={isLocked}
                  onClick={() =>
                    onUpdateOverlayParams(selected.id, (prev) => ({ ...prev, effects: [] }), true)
                  }
                  className="text-[10px] text-zinc-400 hover:text-rose-400 disabled:opacity-30"
                >
                  Clear Effects
                </button>
              )}
            </div>

            {effects.length > 0 && (
              <div className="space-y-2" aria-label="Applied overlay effects">
                {effects.map((fx, idx) => (
                  <div
                    key={fx.id}
                    className={`rounded-lg bg-[#0B0C0F] border border-white/[0.07] p-2 space-y-1.5 ${
                      !fx.enabled ? 'opacity-55' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[11px] font-medium text-zinc-200 truncate">
                        {fx.label}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={isLocked || idx === 0}
                          aria-label={`Move ${fx.label} up`}
                          onClick={() =>
                            onUpdateOverlayParams(
                              selected.id,
                              (prev) => {
                                const list = [...(prev.effects ?? [])];
                                const [moved] = list.splice(idx, 1);
                                list.splice(idx - 1, 0, moved);
                                return { ...prev, effects: list };
                              },
                              true,
                            )
                          }
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-25"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLocked || idx === effects.length - 1}
                          aria-label={`Move ${fx.label} down`}
                          onClick={() =>
                            onUpdateOverlayParams(
                              selected.id,
                              (prev) => {
                                const list = [...(prev.effects ?? [])];
                                const [moved] = list.splice(idx, 1);
                                list.splice(idx + 1, 0, moved);
                                return { ...prev, effects: list };
                              },
                              true,
                            )
                          }
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-25"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          aria-label={`${fx.enabled ? 'Hide' : 'Show'} ${fx.label}`}
                          onClick={() =>
                            onUpdateOverlayParams(
                              selected.id,
                              (prev) => ({
                                ...prev,
                                effects: (prev.effects ?? []).map((item) =>
                                  item.id === fx.id ? { ...item, enabled: !item.enabled } : item,
                                ),
                              }),
                              true,
                            )
                          }
                          className="p-0.5 text-zinc-400 hover:text-white disabled:opacity-25"
                        >
                          {fx.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <button
                          type="button"
                          disabled={isLocked}
                          aria-label={`Remove ${fx.label}`}
                          onClick={() =>
                            onUpdateOverlayParams(
                              selected.id,
                              (prev) => ({
                                ...prev,
                                effects: (prev.effects ?? []).filter((item) => item.id !== fx.id),
                              }),
                              true,
                            )
                          }
                          className="p-0.5 text-zinc-400 hover:text-rose-400 disabled:opacity-25"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    <StudioSlider
                      label="Intensity"
                      value={fx.intensity}
                      min={0}
                      max={100}
                      unit="%"
                      onChange={(intensity) => {
                        if (isLocked) return;
                        onUpdateOverlayParams(
                          selected.id,
                          (prev) => ({
                            ...prev,
                            effects: (prev.effects ?? []).map((item) =>
                              item.id === fx.id ? { ...item, intensity } : item,
                            ),
                          }),
                          false,
                        );
                      }}
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Picsart-style Categorized Effects Library with Live Thumbnails */}
            <EffectPreviewGrid
              sourceSrc={selected.params.src}
              activeKinds={effects.filter((e) => e.enabled).map((e) => e.kind)}
              disabled={isLocked}
              onPickEffect={handleAddEffect}
            />
          </section>
        </div>
      )}
    </div>
  );
};
