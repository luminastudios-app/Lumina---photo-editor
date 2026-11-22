import React, { useState } from 'react';
import {
  BookmarkPlus,
  ClipboardCopy,
  ClipboardPaste,
  Eraser,
  Lasso,
  Layers,
  Layers2,
  Paintbrush,
  Pipette,
  RotateCcw,
  Trash2,
  Wand2,
} from 'lucide-react';
import type {
  EditLayer,
  LayerMask,
  MaskKind,
  SavedMaskSelection,
} from '../../types/editor';
import { createDefaultLayerMask } from '../../engine/stackReducer';
import { StudioSlider } from '../StudioSlider';

export interface MaskBrushState {
  active: boolean;
  tool: 'paint' | 'erase';
  size: number; // 1..40
  hardness: number; // 0..100
  opacity: number; // 10..100
  colorPickActive: boolean;
}

interface MasksPanelProps {
  layers: EditLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  maskBrush: MaskBrushState;
  onChangeMaskBrush: (next: MaskBrushState) => void;
  savedMasks: SavedMaskSelection[];
  hasCopiedSelection?: boolean;
  onCopySelection?: (mask: LayerMask) => void;
  onPasteSelectionLayer?: (mask?: LayerMask) => void;
  onUpdateLayerMask: (layerId: string, mask: LayerMask | undefined) => void;
  onSaveSelection: (name: string, mask: LayerMask) => void;
  onDeleteSavedSelection: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const MASK_KINDS: Array<{ id: MaskKind; label: string }> = [
  { id: 'magic-wand', label: 'Magic Wand' },
  { id: 'lasso', label: 'Lasso' },
  { id: 'polygon', label: 'Polygon' },
  { id: 'brush', label: 'Brush' },
  { id: 'linear', label: 'Linear Grad' },
  { id: 'radial', label: 'Radial Grad' },
  { id: 'luminosity', label: 'Luminosity' },
  { id: 'color-range', label: 'Color Range' },
];

export const MasksPanel: React.FC<MasksPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  maskBrush,
  onChangeMaskBrush,
  savedMasks,
  hasCopiedSelection = false,
  onCopySelection,
  onPasteSelectionLayer,
  onUpdateLayerMask,
  onSaveSelection,
  onDeleteSavedSelection,
  onDragStart,
  onDragEnd,
}) => {
  const [saveName, setSaveName] = useState('');

  const maskableLayers = layers.filter((l) => l.type !== 'crop' && l.type !== 'group' && l.type !== 'frame');
  const targetLayer =
    maskableLayers.find((l) => l.id === selectedLayerId) ??
    maskableLayers[maskableLayers.length - 1] ??
    null;

  const mask = targetLayer?.mask ?? null;

  const setKind = (kind: MaskKind) => {
    if (!targetLayer) return;
    const base = createDefaultLayerMask(kind);
    if (mask) {
      base.inverted = mask.inverted;
      base.feather = mask.feather;
      base.refineEdge = mask.refineEdge;
      base.expand = mask.expand ?? 0;
    }
    onUpdateLayerMask(targetLayer.id, base);
    if (kind === 'brush') {
      onChangeMaskBrush({ ...maskBrush, active: true, colorPickActive: false });
    } else {
      onChangeMaskBrush({ ...maskBrush, active: false, colorPickActive: false });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Masks & Selections</h2>
        {mask && targetLayer && (
          <button
            type="button"
            onClick={() => {
              onUpdateLayerMask(targetLayer.id, undefined);
              onChangeMaskBrush({ ...maskBrush, active: false, colorPickActive: false });
            }}
            className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Remove Mask</span>
          </button>
        )}
      </div>

      {/* Target layer picker */}
      <div className="space-y-1.5">
        <label htmlFor="mask-target-layer" className="text-[11px] text-zinc-400 flex items-center gap-1.5">
          <Layers className="w-3 h-3 text-amber-400" />
          <span>Target Layer</span>
        </label>
        {maskableLayers.length === 0 ? (
          <p className="text-[11px] text-zinc-500 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
            Add an adjustment, filter, color, or effect layer first to attach a mask.
          </p>
        ) : (
          <select
            id="mask-target-layer"
            value={targetLayer?.id ?? ''}
            onChange={(e) => onSelectLayer(e.target.value)}
            className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100"
          >
            {maskableLayers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} {l.mask ? '· Masked' : ''}
              </option>
            ))}
          </select>
        )}
      </div>

      {targetLayer && (
        <>
          <div className="space-y-1.5">
            <span className="text-[11px] font-medium text-zinc-500">Create / Switch Mask</span>
            <div className="grid grid-cols-2 gap-1.5">
              {MASK_KINDS.map((k) => {
                const active = mask?.kind === k.id;
                return (
                  <button
                    key={k.id}
                    type="button"
                    onClick={() => setKind(k.id)}
                    aria-pressed={active}
                    className={`py-1.5 px-2 rounded-md text-[11px] font-medium border flex items-center justify-center gap-1 transition-colors ${
                      active
                        ? 'bg-amber-500 text-zinc-950 border-amber-500'
                        : 'bg-[#181A20] text-zinc-300 border-white/[0.06] hover:bg-white/10'
                    }`}
                  >
                    <span>{k.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {mask && (
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              {/* Common Refine Controls */}
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() =>
                    onUpdateLayerMask(targetLayer.id, { ...mask, inverted: !mask.inverted })
                  }
                  aria-pressed={mask.inverted}
                  className={`flex-1 py-1.5 rounded-md text-xs font-medium border flex items-center justify-center gap-1.5 ${
                    mask.inverted
                      ? 'bg-amber-500 text-zinc-950 border-amber-500'
                      : 'bg-[#181A20] text-zinc-300 border-white/10'
                  }`}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{mask.inverted ? 'Inverted' : 'Invert Mask'}</span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateLayerMask(targetLayer.id, { ...mask, enabled: !mask.enabled })
                  }
                  aria-pressed={mask.enabled}
                  className="px-3 py-1.5 rounded-md text-xs font-medium bg-[#181A20] text-zinc-200 border border-white/10"
                >
                  {mask.enabled ? 'Active' : 'Bypassed'}
                </button>
              </div>

              <StudioSlider
                label="Feather"
                value={mask.feather}
                min={0}
                max={50}
                defaultValue={22}
                unit="px"
                onChange={(v) => onUpdateLayerMask(targetLayer.id, { ...mask, feather: v })}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
              <StudioSlider
                label="Expand / Contract"
                value={mask.expand ?? 0}
                min={-30}
                max={30}
                defaultValue={0}
                unit="px"
                onChange={(v) => onUpdateLayerMask(targetLayer.id, { ...mask, expand: v })}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />
              <StudioSlider
                label="Refine Edge"
                value={mask.refineEdge}
                min={-50}
                max={50}
                defaultValue={0}
                onChange={(v) => onUpdateLayerMask(targetLayer.id, { ...mask, refineEdge: v })}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
              />

              {/* Copy / Paste Selection as New Overlay Layer */}
              {onCopySelection && onPasteSelectionLayer && (
                <div className="space-y-1.5 pt-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onCopySelection(mask)}
                      className="py-1.5 px-2 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/10 text-[11px] font-medium text-zinc-200 flex items-center justify-center gap-1"
                    >
                      <ClipboardCopy className="w-3.5 h-3.5 text-amber-400" />
                      <span>Copy Selection</span>
                    </button>
                    <button
                      type="button"
                      disabled={!hasCopiedSelection}
                      onClick={() => onPasteSelectionLayer()}
                      className="py-1.5 px-2 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/10 text-[11px] font-medium text-zinc-200 disabled:opacity-35 flex items-center justify-center gap-1"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5 text-amber-400" />
                      <span>Paste as Layer</span>
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => onPasteSelectionLayer(mask)}
                    className="w-full py-1.5 px-2.5 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-[11px] font-semibold text-amber-300 flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Layers2 className="w-3.5 h-3.5" />
                    <span>Duplicate Selection as New Layer</span>
                  </button>
                </div>
              )}

              {/* Magic Wand Selection */}
              {mask.kind === 'magic-wand' && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
                      <Wand2 className="w-3.5 h-3.5 text-amber-400" />
                      <span>Magic Wand</span>
                    </span>
                    <button
                      type="button"
                      aria-pressed={mask.wand?.contiguous ?? true}
                      onClick={() =>
                        onUpdateLayerMask(targetLayer.id, {
                          ...mask,
                          wand: {
                            ...(mask.wand ?? { seedX: 0.5, seedY: 0.5, tolerance: 32, contiguous: true }),
                            contiguous: !(mask.wand?.contiguous ?? true),
                          },
                        })
                      }
                      className={`px-2 py-0.5 rounded text-[10px] font-medium border ${
                        (mask.wand?.contiguous ?? true)
                          ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-[#181A20] border-white/10 text-zinc-400'
                      }`}
                    >
                      {(mask.wand?.contiguous ?? true) ? 'Contiguous' : 'Global Match'}
                    </button>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    Tap any area on the photo to select similar pixels (seed{' '}
                    {Math.round((mask.wand?.seedX ?? 0.5) * 100)}%,{' '}
                    {Math.round((mask.wand?.seedY ?? 0.5) * 100)}%).
                  </p>
                  <StudioSlider
                    label="Wand Tolerance"
                    value={mask.wand?.tolerance ?? 32}
                    min={5}
                    max={95}
                    defaultValue={32}
                    unit="%"
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        wand: {
                          ...(mask.wand ?? { seedX: 0.5, seedY: 0.5, tolerance: 32, contiguous: true }),
                          tolerance: v,
                        },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              )}

              {/* Lasso & Polygon Selection */}
              {(mask.kind === 'lasso' || mask.kind === 'polygon') && (
                <div className="space-y-2 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-300 flex items-center gap-1">
                      <Lasso className="w-3.5 h-3.5 text-amber-400" />
                      <span>{mask.kind === 'lasso' ? 'Freehand Lasso' : 'Polygon Path'}</span>
                    </span>
                    <span className="text-[10px] font-mono-num text-zinc-400">
                      {mask.polygonPoints?.length ?? 0} vertices
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400">
                    {mask.kind === 'lasso'
                      ? 'Drag on the photo to draw a freehand selection loop.'
                      : 'Click points around your subject on the photo to build a polygon cutout.'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        polygonPoints: [],
                      })
                    }
                    className="w-full py-1 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[11px] text-zinc-300"
                  >
                    Clear Selection Path
                  </button>
                </div>
              )}

              {/* Brush Mask Tools */}
              {mask.kind === 'brush' && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-zinc-300">Brush Selection</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeMaskBrush({ ...maskBrush, active: !maskBrush.active })
                      }
                      aria-pressed={maskBrush.active}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                        maskBrush.active ? 'bg-amber-500 text-zinc-950' : 'bg-[#181A20] text-zinc-300'
                      }`}
                    >
                      {maskBrush.active ? 'Painting On' : 'Resume Paint'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => onChangeMaskBrush({ ...maskBrush, active: true, tool: 'paint' })}
                      className={`py-1 rounded text-xs flex items-center justify-center gap-1 border ${
                        maskBrush.tool === 'paint'
                          ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                          : 'border-white/10 text-zinc-400'
                      }`}
                    >
                      <Paintbrush className="w-3 h-3" />
                      <span>Paint (Add)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeMaskBrush({ ...maskBrush, active: true, tool: 'erase' })}
                      className={`py-1 rounded text-xs flex items-center justify-center gap-1 border ${
                        maskBrush.tool === 'erase'
                          ? 'border-amber-500 bg-amber-500/15 text-amber-200'
                          : 'border-white/10 text-zinc-400'
                      }`}
                    >
                      <Eraser className="w-3 h-3" />
                      <span>Subtract</span>
                    </button>
                  </div>
                  <StudioSlider
                    label="Size"
                    value={maskBrush.size}
                    min={2}
                    max={45}
                    defaultValue={14}
                    unit="px"
                    onChange={(v) => onChangeMaskBrush({ ...maskBrush, size: v })}
                  />
                  <StudioSlider
                    label="Hardness"
                    value={maskBrush.hardness}
                    min={0}
                    max={100}
                    defaultValue={70}
                    unit="%"
                    onChange={(v) => onChangeMaskBrush({ ...maskBrush, hardness: v })}
                  />
                  <StudioSlider
                    label="Opacity"
                    value={maskBrush.opacity}
                    min={10}
                    max={100}
                    defaultValue={100}
                    unit="%"
                    onChange={(v) => onChangeMaskBrush({ ...maskBrush, opacity: v })}
                  />
                </div>
              )}

              {/* Linear & Radial Gradient */}
              {(mask.kind === 'linear' || mask.kind === 'radial') && mask.gradient && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <StudioSlider
                    label="Center X"
                    value={Math.round(mask.gradient.x1 * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        gradient: { ...mask.gradient!, x1: v / 100 },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <StudioSlider
                    label="Center Y"
                    value={Math.round(mask.gradient.y1 * 100)}
                    min={0}
                    max={100}
                    unit="%"
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        gradient: { ...mask.gradient!, y1: v / 100 },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  {mask.kind === 'radial' ? (
                    <StudioSlider
                      label="Radial Radius"
                      value={Math.round(mask.gradient.radius * 100)}
                      min={10}
                      max={95}
                      defaultValue={36}
                      unit="%"
                      onChange={(v) =>
                        onUpdateLayerMask(targetLayer.id, {
                          ...mask,
                          gradient: { ...mask.gradient!, radius: v / 100 },
                        })
                      }
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  ) : (
                    <StudioSlider
                      label="End Y Reach"
                      value={Math.round(mask.gradient.y2 * 100)}
                      min={0}
                      max={100}
                      defaultValue={85}
                      unit="%"
                      onChange={(v) =>
                        onUpdateLayerMask(targetLayer.id, {
                          ...mask,
                          gradient: { ...mask.gradient!, y2: v / 100 },
                        })
                      }
                      onDragStart={onDragStart}
                      onDragEnd={onDragEnd}
                    />
                  )}
                </div>
              )}

              {/* Luminosity Range */}
              {mask.kind === 'luminosity' && mask.luminosity && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <StudioSlider
                    label="Min Brightness"
                    value={mask.luminosity.min}
                    min={0}
                    max={250}
                    defaultValue={100}
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        luminosity: { ...mask.luminosity!, min: Math.min(v, mask.luminosity!.max) },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <StudioSlider
                    label="Max Brightness"
                    value={mask.luminosity.max}
                    min={5}
                    max={255}
                    defaultValue={255}
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        luminosity: { ...mask.luminosity!, max: Math.max(v, mask.luminosity!.min) },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                  <StudioSlider
                    label="Roll-off Softness"
                    value={mask.luminosity.softness}
                    min={5}
                    max={100}
                    defaultValue={40}
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        luminosity: { ...mask.luminosity!, softness: v },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              )}

              {/* Color Range */}
              {mask.kind === 'color-range' && mask.colorRange && (
                <div className="space-y-2.5 p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Target mask color"
                        value={mask.colorRange.hex}
                        onChange={(e) =>
                          onUpdateLayerMask(targetLayer.id, {
                            ...mask,
                            colorRange: { ...mask.colorRange!, hex: e.target.value },
                          })
                        }
                        className="w-7 h-7 rounded bg-transparent cursor-pointer"
                      />
                      <span className="text-xs font-mono-num text-zinc-300">{mask.colorRange.hex}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeMaskBrush({
                          ...maskBrush,
                          active: false,
                          colorPickActive: !maskBrush.colorPickActive,
                        })
                      }
                      aria-pressed={maskBrush.colorPickActive}
                      className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 border ${
                        maskBrush.colorPickActive
                          ? 'bg-amber-500 text-zinc-950 border-amber-500'
                          : 'bg-[#181A20] text-zinc-300 border-white/10'
                      }`}
                    >
                      <Pipette className="w-3 h-3" />
                      <span>{maskBrush.colorPickActive ? 'Tap Photo…' : 'Sample Color'}</span>
                    </button>
                  </div>
                  <StudioSlider
                    label="Color Tolerance"
                    value={mask.colorRange.tolerance}
                    min={5}
                    max={95}
                    defaultValue={35}
                    unit="%"
                    onChange={(v) =>
                      onUpdateLayerMask(targetLayer.id, {
                        ...mask,
                        colorRange: { ...mask.colorRange!, tolerance: v },
                      })
                    }
                    onDragStart={onDragStart}
                    onDragEnd={onDragEnd}
                  />
                </div>
              )}

              {/* Save selection as reusable */}
              <div className="pt-2 border-t border-white/[0.06] flex gap-1.5">
                <input
                  type="text"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="Save selection name…"
                  aria-label="Reusable mask name"
                  className="flex-1 rounded-md bg-[#0B0C0F] border border-white/10 px-2 py-1 text-xs text-zinc-100"
                />
                <button
                  type="button"
                  onClick={() => {
                    onSaveSelection(saveName.trim() || `${mask.kind} selection`, mask);
                    setSaveName('');
                  }}
                  aria-label="Save mask selection"
                  className="px-2.5 py-1 rounded-md bg-white/10 hover:bg-white/15 text-xs text-zinc-100 flex items-center gap-1"
                >
                  <BookmarkPlus className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
            </div>
          )}

          {/* Reusable Saved Selections */}
          {savedMasks.length > 0 && (
            <section className="space-y-2 pt-3 border-t border-white/[0.06]">
              <h3 className="text-[11px] font-medium text-zinc-500">Saved Selections</h3>
              <div className="space-y-1">
                {savedMasks.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#181A20] border border-white/[0.06]"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        onUpdateLayerMask(targetLayer.id, {
                          ...JSON.parse(JSON.stringify(s.mask)),
                          enabled: true,
                        })
                      }
                      className="text-xs text-zinc-200 hover:text-amber-300 truncate text-left flex-1"
                    >
                      {s.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteSavedSelection(s.id)}
                      aria-label={`Delete saved mask ${s.name}`}
                      className="p-1 text-zinc-500 hover:text-rose-400"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
};
