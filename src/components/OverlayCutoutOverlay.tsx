import React from 'react';
import {
  Check,
  Contrast,
  Eraser,
  FlipHorizontal2,
  Paintbrush,
  Redo2,
  ScanFace,
  Sparkles,
  Square,
  Undo2,
  X,
} from 'lucide-react';
import type { OverlayCutoutShape } from '../types/editor';
import type { OverlayBrushState } from './panels/OverlayPanel';

interface OverlayCutoutOverlayProps {
  overlayBrush: OverlayBrushState;
  cutoutShape: OverlayCutoutShape;
  cutoutInverted: boolean;
  subjectSelected: boolean;
  canUndo: boolean;
  canRedo: boolean;
  comparePreview: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onToggleCompare: (active: boolean) => void;
  onCancel: () => void;
  onConfirm: () => void;
  onChangeBrush: (next: OverlayBrushState) => void;
  onBrushSliderDragChange: (dragging: boolean) => void;
  onApplySelectSubject: () => void;
  onSelectShape: (shape: OverlayCutoutShape) => void;
  onToggleInvert: () => void;
}

const CUTOUT_SHAPES: Array<{ id: OverlayCutoutShape; label: string }> = [
  { id: 'none', label: 'Full' },
  { id: 'circle', label: 'Circle' },
  { id: 'rounded', label: 'Rounded' },
  { id: 'heart', label: 'Heart' },
  { id: 'star', label: 'Star' },
  { id: 'diamond', label: 'Diamond' },
];

export const OverlayCutoutOverlay: React.FC<OverlayCutoutOverlayProps> = ({
  overlayBrush,
  cutoutShape,
  cutoutInverted,
  subjectSelected,
  canUndo,
  canRedo,
  comparePreview,
  onUndo,
  onRedo,
  onToggleCompare,
  onCancel,
  onConfirm,
  onChangeBrush,
  onBrushSliderDragChange,
  onApplySelectSubject,
  onSelectShape,
  onToggleInvert,
}) => {
  const paintKey = overlayBrush.lastPaintTool;
  const activePreset = overlayBrush[paintKey];

  const updateActivePreset = (patch: Partial<typeof activePreset>) => {
    onChangeBrush({
      ...overlayBrush,
      [paintKey]: { ...activePreset, ...patch },
    });
  };

  const sliders: Array<{
    id: 'size' | 'opacity' | 'hardness';
    label: string;
    value: number;
    min: number;
    max: number;
  }> = [
    { id: 'size', label: 'Size', value: activePreset.size, min: 4, max: 120 },
    { id: 'opacity', label: 'Opacity', value: activePreset.opacity, min: 0, max: 100 },
    { id: 'hardness', label: 'Hardness', value: activePreset.hardness, min: 0, max: 100 },
  ];

  return (
    <div
      data-testid="overlay-cutout-studio"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between"
    >
      {/* Top Bar: Close (X), Undo, Redo, Compare Split, Confirm (Checkmark) */}
      <div className="pointer-events-auto flex items-center justify-between px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 bg-gradient-to-b from-black/85 via-black/55 to-transparent">
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel cutout edits"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all"
        >
          <X className="w-6 h-6 stroke-[1.9]" />
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!canUndo}
            onClick={onUndo}
            aria-label="Undo cutout edit"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
          >
            <Undo2 className="w-5 h-5 stroke-[1.9]" />
          </button>
          <button
            type="button"
            disabled={!canRedo}
            onClick={onRedo}
            aria-label="Redo cutout edit"
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/15 disabled:opacity-35 transition-colors"
          >
            <Redo2 className="w-5 h-5 stroke-[1.9]" />
          </button>
          <button
            type="button"
            onClick={() => onToggleCompare(!comparePreview)}
            aria-pressed={comparePreview}
            aria-label="Compare before cutout"
            className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full transition-colors ${
              comparePreview ? 'bg-white/25 text-white' : 'text-white/90 hover:bg-white/15'
            }`}
          >
            <FlipHorizontal2 className="w-5 h-5 stroke-[1.9]" />
          </button>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          aria-label="Confirm cutout edits"
          className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full text-white hover:bg-white/15 active:scale-95 transition-all"
        >
          <Check className="w-6 h-6 stroke-[2.1]" />
        </button>
      </div>

      {/* Bottom Floating Translucent Controls Over Canvas */}
      <div
        className="pointer-events-auto w-full bg-gradient-to-t from-black/95 via-black/78 to-transparent pt-8 pb-[max(0.75rem,env(safe-area-inset-bottom))] px-4"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="max-w-lg mx-auto space-y-3">
          {/* Quick Shape Cutout Sub-bar when Shape tool is selected */}
          {overlayBrush.tool === 'shape' && (
            <div
              role="region"
              aria-label="Cutout shapes"
              className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1"
            >
              {CUTOUT_SHAPES.map((sh) => (
                <button
                  key={sh.id}
                  type="button"
                  onClick={() => onSelectShape(sh.id)}
                  aria-pressed={cutoutShape === sh.id}
                  className={`px-3 min-h-[36px] rounded-full text-xs font-medium whitespace-nowrap shrink-0 transition-colors border ${
                    cutoutShape === sh.id
                      ? 'bg-white text-zinc-950 border-white'
                      : 'bg-black/60 text-zinc-200 border-white/20 hover:bg-white/15'
                  }`}
                >
                  {sh.label}
                </button>
              ))}
            </div>
          )}

          {/* 3 Single-Line Floating Sliders: Size, Opacity, Hardness */}
          <div className="space-y-1">
            {sliders.map((s) => {
              const pct = ((s.value - s.min) / Math.max(1, s.max - s.min)) * 100;
              return (
                <div key={s.id} className="flex items-center gap-3 min-h-[44px]">
                  <label
                    htmlFor={`cutout-${s.id}-slider`}
                    className="w-16 text-[13px] font-medium text-white shrink-0 select-none"
                  >
                    {s.label}
                  </label>
                  <input
                    id={`cutout-${s.id}-slider`}
                    type="range"
                    min={s.min}
                    max={s.max}
                    value={s.value}
                    aria-label={s.label}
                    onPointerDown={() => onBrushSliderDragChange(true)}
                    onPointerUp={() => onBrushSliderDragChange(false)}
                    onPointerCancel={() => onBrushSliderDragChange(false)}
                    onBlur={() => onBrushSliderDragChange(false)}
                    onInput={(e) =>
                      updateActivePreset({ [s.id]: Number((e.target as HTMLInputElement).value) })
                    }
                    onChange={(e) => updateActivePreset({ [s.id]: Number(e.target.value) })}
                    style={{
                      background: `linear-gradient(to right, #FFFFFF ${pct}%, rgba(255,255,255,0.28) ${pct}%)`,
                    }}
                    className="cutout-slider flex-1"
                  />
                  <span className="w-8 text-right font-mono-num text-[13px] font-medium text-white shrink-0 select-none">
                    {s.value}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Segmented Assisted / Manual Pill */}
          <div
            role="tablist"
            aria-label="Cutout mode"
            className="grid grid-cols-2 p-1 rounded-2xl bg-[#18191E]/90 border border-white/10 backdrop-blur-md"
          >
            <button
              type="button"
              role="tab"
              aria-selected={overlayBrush.mode === 'assisted'}
              onClick={() => onChangeBrush({ ...overlayBrush, mode: 'assisted' })}
              className={`min-h-[44px] rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                overlayBrush.mode === 'assisted'
                  ? 'bg-[#32343B] text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Assisted</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={overlayBrush.mode === 'manual'}
              onClick={() => onChangeBrush({ ...overlayBrush, mode: 'manual' })}
              className={`min-h-[44px] rounded-xl flex items-center justify-center gap-2 text-xs font-medium transition-colors ${
                overlayBrush.mode === 'manual'
                  ? 'bg-[#32343B] text-white shadow-sm'
                  : 'text-zinc-300 hover:text-white'
              }`}
            >
              <Paintbrush className="w-4 h-4" />
              <span>Manual</span>
            </button>
          </div>

          {/* 5 Action Buttons Row: Select, Restore, Erase, Shape, Invert */}
          <div className="grid grid-cols-5 gap-1 pt-0.5">
            <button
              type="button"
              onClick={() => {
                onChangeBrush({ ...overlayBrush, tool: 'select' });
                onApplySelectSubject();
              }}
              aria-pressed={overlayBrush.tool === 'select' || subjectSelected}
              className="min-h-[54px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  overlayBrush.tool === 'select' || subjectSelected
                    ? 'bg-[#32343B] text-white border border-white/15'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <ScanFace className="w-5 h-5 stroke-[1.8]" />
              </span>
              <span className="text-[11px] font-medium">Select</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeBrush({ ...overlayBrush, tool: 'restore', lastPaintTool: 'restore' })
              }
              aria-pressed={overlayBrush.tool === 'restore'}
              className="min-h-[54px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  overlayBrush.tool === 'restore'
                    ? 'bg-[#32343B] text-white border border-white/15'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Paintbrush className="w-5 h-5 stroke-[1.8]" />
              </span>
              <span className="text-[11px] font-medium">Restore</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeBrush({ ...overlayBrush, tool: 'erase', lastPaintTool: 'erase' })
              }
              aria-pressed={overlayBrush.tool === 'erase'}
              className="min-h-[54px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  overlayBrush.tool === 'erase'
                    ? 'bg-[#32343B] text-white border border-white/15'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Eraser className="w-5 h-5 stroke-[1.8]" />
              </span>
              <span className="text-[11px] font-medium">Erase</span>
            </button>

            <button
              type="button"
              onClick={() =>
                onChangeBrush({
                  ...overlayBrush,
                  tool: overlayBrush.tool === 'shape' ? overlayBrush.lastPaintTool : 'shape',
                })
              }
              aria-pressed={overlayBrush.tool === 'shape' || cutoutShape !== 'none'}
              className="min-h-[54px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  overlayBrush.tool === 'shape' || cutoutShape !== 'none'
                    ? 'bg-[#32343B] text-white border border-white/15'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Square className="w-5 h-5 stroke-[1.8]" />
              </span>
              <span className="text-[11px] font-medium">Shape</span>
            </button>

            <button
              type="button"
              onClick={onToggleInvert}
              aria-pressed={cutoutInverted}
              className="min-h-[54px] min-w-[44px] flex flex-col items-center justify-center gap-1 text-white"
            >
              <span
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                  cutoutInverted
                    ? 'bg-[#32343B] text-white border border-white/15'
                    : 'text-zinc-200 hover:bg-white/10'
                }`}
              >
                <Contrast className="w-5 h-5 stroke-[1.8]" />
              </span>
              <span className="text-[11px] font-medium">Invert</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
