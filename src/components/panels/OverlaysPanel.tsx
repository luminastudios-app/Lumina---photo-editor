import React, { useMemo, useRef, useState } from 'react';
import { Eraser, Paintbrush, Search, Sparkles, Trash2, Upload } from 'lucide-react';
import type { EditLayer, FrameParams, ShapeKind, ShapeParams } from '../../types/editor';
import { StudioSlider } from '../StudioSlider';

export interface BrushConfig {
  active: boolean;
  tool: 'brush' | 'eraser';
  neon?: boolean;
  color: string;
  size: number;
  opacity: number;
}

interface OverlaysPanelProps {
  frame: FrameParams;
  brush: BrushConfig;
  strokeCount: number;
  shapeLayers: Array<Extract<EditLayer, { type: 'shape' }>>;
  selectedShapeId: string | null;
  onSelectShape: (id: string) => void;
  onAddShape: (kind: ShapeKind) => void;
  onUpdateShape: (id: string, next: ShapeParams) => void;
  onChangeFrame: (next: FrameParams) => void;
  onChangeBrush: (next: BrushConfig) => void;
  onUndoStroke: () => void;
  onClearStrokes: () => void;
  onAddSticker: (kind: 'emoji' | 'shape' | 'image', value: string, color?: string, src?: string) => void;
  onUploadCustomSticker: (file: File) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

type StickerCategory = 'all' | 'glow' | 'nature' | 'mood' | 'retro' | 'travel' | 'badges';

interface StickerItem {
  emoji: string;
  name: string;
  category: Exclude<StickerCategory, 'all'>;
}

const STICKER_LIBRARY: StickerItem[] = [
  { emoji: '✨', name: 'sparkles glow magic stars', category: 'glow' },
  { emoji: '💫', name: 'dizzy shooting star swirl', category: 'glow' },
  { emoji: '⚡', name: 'lightning neon bolt energy', category: 'glow' },
  { emoji: '🔥', name: 'fire flame hot lit', category: 'glow' },
  { emoji: '💥', name: 'boom burst pop comic', category: 'glow' },
  { emoji: '🌈', name: 'rainbow pride arc', category: 'glow' },
  { emoji: '🎆', name: 'fireworks sparkle light', category: 'glow' },
  { emoji: '🌙', name: 'crescent moon night dream', category: 'nature' },
  { emoji: '☀️', name: 'sun sunshine summer', category: 'nature' },
  { emoji: '🌸', name: 'cherry blossom sakura flower', category: 'nature' },
  { emoji: '🌿', name: 'leaf botanical plant herb', category: 'nature' },
  { emoji: '🌊', name: 'ocean wave sea surf', category: 'nature' },
  { emoji: '🦋', name: 'butterfly wing pastel', category: 'nature' },
  { emoji: '☁️', name: 'cloud sky soft', category: 'nature' },
  { emoji: '🤍', name: 'white heart pure love', category: 'mood' },
  { emoji: '💖', name: 'sparkling heart pink love', category: 'mood' },
  { emoji: '🖤', name: 'black heart dark aesthetic', category: 'mood' },
  { emoji: '😎', name: 'cool sunglasses vibe', category: 'mood' },
  { emoji: '🥹', name: 'tears joy cute soft', category: 'mood' },
  { emoji: '🤩', name: 'star eyes excited', category: 'mood' },
  { emoji: '📸', name: 'camera flash photo', category: 'retro' },
  { emoji: '🎞️', name: 'film strip 35mm analog', category: 'retro' },
  { emoji: '📼', name: 'vhs cassette tape 90s', category: 'retro' },
  { emoji: '💿', name: 'cd disc y2k holographic', category: 'retro' },
  { emoji: '🕹️', name: 'arcade joystick gaming', category: 'retro' },
  { emoji: '🎧', name: 'headphones music beat', category: 'retro' },
  { emoji: '✈️', name: 'airplane travel flight', category: 'travel' },
  { emoji: '☕', name: 'coffee latte cafe morning', category: 'travel' },
  { emoji: '🌴', name: 'palm tree vacation beach', category: 'travel' },
  { emoji: '🏔️', name: 'mountain peak hike', category: 'travel' },
  { emoji: '🌆', name: 'cityscape dusk skyline', category: 'travel' },
  { emoji: '🚗', name: 'roadtrip car drive', category: 'travel' },
  { emoji: '🏆', name: 'trophy winner award', category: 'badges' },
  { emoji: '👑', name: 'crown queen king royal', category: 'badges' },
  { emoji: '💎', name: 'diamond gem jewel', category: 'badges' },
  { emoji: '🎯', name: 'target bullseye goal', category: 'badges' },
  { emoji: '🏷️', name: 'price tag label stamp', category: 'badges' },
  { emoji: '✅', name: 'verified checkmark badge', category: 'badges' },
];

const STICKER_CATEGORIES: Array<{ id: StickerCategory; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'glow', label: 'Glow' },
  { id: 'nature', label: 'Nature' },
  { id: 'mood', label: 'Mood' },
  { id: 'retro', label: 'Retro' },
  { id: 'travel', label: 'Travel' },
  { id: 'badges', label: 'Badges' },
];

const SHAPE_KINDS: Array<{ id: ShapeKind; label: string }> = [
  { id: 'rect', label: 'Rect' },
  { id: 'circle', label: 'Circle' },
  { id: 'triangle', label: 'Triangle' },
  { id: 'star', label: 'Star' },
  { id: 'heart', label: 'Heart' },
  { id: 'arrow', label: 'Arrow' },
  { id: 'ring', label: 'Ring' },
  { id: 'badge', label: 'Badge' },
];
const BRUSH_COLORS = ['#F8FAFC', '#0B0C0F', '#F59E0B', '#FB7185', '#38BDF8', '#34D399'];

export const OverlaysPanel: React.FC<OverlaysPanelProps> = ({
  frame,
  brush,
  strokeCount,
  shapeLayers,
  selectedShapeId,
  onSelectShape,
  onAddShape,
  onUpdateShape,
  onChangeFrame,
  onChangeBrush,
  onUndoStroke,
  onClearStrokes,
  onAddSticker,
  onUploadCustomSticker,
  onDragStart,
  onDragEnd,
}) => {
  const customStickerRef = useRef<HTMLInputElement | null>(null);
  const [stickerSearch, setStickerSearch] = useState('');
  const [stickerCategory, setStickerCategory] = useState<StickerCategory>('all');

  const activeShape =
    shapeLayers.find((s) => s.id === selectedShapeId) ?? shapeLayers[shapeLayers.length - 1] ?? null;

  const filteredStickers = useMemo(() => {
    const q = stickerSearch.trim().toLowerCase();
    return STICKER_LIBRARY.filter((item) => {
      if (stickerCategory !== 'all' && item.category !== stickerCategory) return false;
      if (!q) return true;
      return item.name.includes(q) || item.category.includes(q) || item.emoji.includes(q);
    });
  }, [stickerCategory, stickerSearch]);

  return (
    <div className="space-y-5">
      <input
        ref={customStickerRef}
        type="file"
        accept="image/png,image/webp,image/svg+xml,image/jpeg"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onUploadCustomSticker(f);
          e.target.value = '';
        }}
      />

      <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">
        Stickers, Shapes, Brush & Frames
      </h2>

      {/* Drawing / Brush Tool */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">Drawing & Neon Brush</h3>
          <button
            type="button"
            onClick={() => onChangeBrush({ ...brush, active: !brush.active })}
            aria-pressed={brush.active}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              brush.active
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-[#181A20] text-zinc-300 border border-white/10 hover:bg-white/10'
            }`}
          >
            {brush.active ? 'Drawing Active' : 'Enable Brush'}
          </button>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => onChangeBrush({ ...brush, active: true, tool: 'brush', neon: false })}
            aria-pressed={brush.active && brush.tool === 'brush' && !brush.neon}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border ${
              brush.active && brush.tool === 'brush' && !brush.neon
                ? 'bg-white/10 border-amber-500 text-white'
                : 'bg-[#181A20] border-white/[0.06] text-zinc-400'
            }`}
          >
            <Paintbrush className="w-3.5 h-3.5" />
            <span>Brush</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeBrush({ ...brush, active: true, tool: 'brush', neon: true })}
            aria-pressed={brush.active && brush.tool === 'brush' && Boolean(brush.neon)}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border ${
              brush.active && brush.tool === 'brush' && brush.neon
                ? 'bg-fuchsia-500/20 border-fuchsia-400 text-fuchsia-200 font-semibold'
                : 'bg-[#181A20] border-white/[0.06] text-zinc-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Neon Glow</span>
          </button>
          <button
            type="button"
            onClick={() => onChangeBrush({ ...brush, active: true, tool: 'eraser' })}
            aria-pressed={brush.active && brush.tool === 'eraser'}
            className={`flex items-center justify-center gap-1 py-1.5 rounded-md text-xs border ${
              brush.active && brush.tool === 'eraser'
                ? 'bg-white/10 border-amber-500 text-white'
                : 'bg-[#181A20] border-white/[0.06] text-zinc-400'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>Eraser</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          {BRUSH_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Brush color ${c}`}
              onClick={() => onChangeBrush({ ...brush, color: c, tool: 'brush' })}
              className={`w-6 h-6 rounded-full border ${
                brush.color === c ? 'border-amber-400 scale-110' : 'border-white/20'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            aria-label="Custom brush color"
            value={brush.color}
            onChange={(e) => onChangeBrush({ ...brush, color: e.target.value, tool: 'brush' })}
            className="w-6 h-6 rounded bg-transparent cursor-pointer"
          />
        </div>

        <StudioSlider label="Brush Size" value={brush.size} min={1} max={40} defaultValue={10} unit="px" onChange={(v) => onChangeBrush({ ...brush, size: v })} />
        <StudioSlider label="Brush Opacity" value={brush.opacity} min={10} max={100} defaultValue={100} unit="%" onChange={(v) => onChangeBrush({ ...brush, opacity: v })} />

        {strokeCount > 0 && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={onUndoStroke} className="flex-1 py-1.5 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-300 border border-white/[0.06]">
              Undo Stroke
            </button>
            <button type="button" onClick={onClearStrokes} className="py-1.5 px-2.5 rounded-md text-xs bg-[#181A20] hover:text-rose-400 text-zinc-400 border border-white/[0.06]" aria-label="Clear all brush strokes">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </section>

      {/* Searchable Sticker Library */}
      <section className="space-y-2.5 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">Sticker Library</h3>
          <button
            type="button"
            onClick={() => customStickerRef.current?.click()}
            className="px-2 py-1 rounded bg-[#181A20] hover:bg-white/10 border border-white/10 text-[10px] text-zinc-200 flex items-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span>Upload Sticker</span>
          </button>
        </div>

        <div className="relative">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={stickerSearch}
            onChange={(e) => setStickerSearch(e.target.value)}
            placeholder="Search stickers (star, neon, retro…)"
            aria-label="Search stickers"
            className="w-full rounded-md bg-[#0B0C0F] border border-white/10 pl-8 pr-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5" role="tablist" aria-label="Sticker categories">
          {STICKER_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={stickerCategory === cat.id}
              onClick={() => setStickerCategory(cat.id)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium whitespace-nowrap shrink-0 border ${
                stickerCategory === cat.id
                  ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                  : 'bg-[#181A20] text-zinc-400 border-white/[0.06]'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-6 gap-1.5 max-h-36 overflow-y-auto studio-scroll pr-0.5">
          {filteredStickers.length === 0 ? (
            <p className="col-span-6 text-center py-3 text-[11px] text-zinc-500">
              No stickers matched "{stickerSearch}".
            </p>
          ) : (
            filteredStickers.map((st) => (
              <button
                key={st.emoji}
                type="button"
                onClick={() => onAddSticker('emoji', st.emoji)}
                aria-label={`Add ${st.emoji} ${st.name.split(' ')[0]} sticker`}
                title={st.name.split(' ')[0]}
                className="h-9 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-lg flex items-center justify-center transition-transform active:scale-95"
              >
                {st.emoji}
              </button>
            ))
          )}
        </div>
      </section>

      {/* Configurable Vector Shapes */}
      <section className="space-y-2.5 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Vector Shapes (Fill, Stroke, Radius)</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {SHAPE_KINDS.map((sh) => (
            <button
              key={sh.id}
              type="button"
              onClick={() => onAddShape(sh.id)}
              className="py-1.5 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-[11px] text-zinc-300"
            >
              + {sh.label}
            </button>
          ))}
        </div>

        {shapeLayers.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {shapeLayers.map((sl) => (
              <button
                key={sl.id}
                type="button"
                onClick={() => onSelectShape(sl.id)}
                className={`px-2 py-1 rounded text-[11px] border ${
                  activeShape?.id === sl.id
                    ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                    : 'border-white/10 bg-[#181A20] text-zinc-300'
                }`}
              >
                {sl.name}
              </button>
            ))}
          </div>
        )}

        {activeShape && (
          <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-400">Fill & Stroke</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Shape fill color"
                  value={activeShape.params.fillColor}
                  onChange={(e) =>
                    onUpdateShape(activeShape.id, { ...activeShape.params, fillColor: e.target.value })
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
                <input
                  type="color"
                  aria-label="Shape stroke color"
                  value={activeShape.params.strokeColor}
                  onChange={(e) =>
                    onUpdateShape(activeShape.id, { ...activeShape.params, strokeColor: e.target.value })
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
              </div>
            </div>
            <StudioSlider
              label="Stroke Width"
              value={activeShape.params.strokeWidth}
              min={0}
              max={20}
              unit="px"
              onChange={(v) => onUpdateShape(activeShape.id, { ...activeShape.params, strokeWidth: v })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
            <StudioSlider
              label="Corner Radius"
              value={activeShape.params.cornerRadius}
              min={0}
              max={50}
              onChange={(v) => onUpdateShape(activeShape.id, { ...activeShape.params, cornerRadius: v })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
            <StudioSlider
              label="Rotation"
              value={activeShape.params.rotation}
              min={-180}
              max={180}
              unit="°"
              onChange={(v) => onUpdateShape(activeShape.id, { ...activeShape.params, rotation: v })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>
        )}
      </section>

      {/* Frames & Borders */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Frames & Borders</h3>
        <div className="grid grid-cols-4 gap-1.5">
          {(['none', 'solid', 'polaroid', 'film', 'double', 'rounded', 'torn-paper', 'grunge'] as const).map((style) => (
            <button
              key={style}
              type="button"
              onClick={() => {
                onChangeFrame({ ...frame, style });
                onDragEnd();
              }}
              aria-pressed={frame.style === style}
              className={`py-1.5 px-1 rounded-md text-[11px] capitalize border truncate ${
                frame.style === style
                  ? 'bg-amber-500 text-zinc-950 border-amber-500 font-medium'
                  : 'bg-[#181A20] text-zinc-300 border-white/[0.06] hover:bg-white/10'
              }`}
            >
              {style.replace('-', ' ')}
            </button>
          ))}
        </div>

        {frame.style !== 'none' && frame.style !== 'rounded' && (
          <>
            <StudioSlider label="Border Width" value={frame.width} min={6} max={80} defaultValue={28} unit="px" onChange={(v) => onChangeFrame({ ...frame, width: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
            {frame.style !== 'film' && (
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Border Color</span>
                <input
                  type="color"
                  aria-label="Frame border color"
                  value={frame.color}
                  onChange={(e) => {
                    onChangeFrame({ ...frame, color: e.target.value });
                    onDragEnd();
                  }}
                  className="w-7 h-7 rounded bg-transparent cursor-pointer"
                />
              </div>
            )}
          </>
        )}

        {frame.style === 'rounded' && (
          <StudioSlider label="Corner Radius" value={frame.innerRadius} min={0} max={120} defaultValue={36} unit="px" onChange={(v) => onChangeFrame({ ...frame, innerRadius: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        )}
      </section>
    </div>
  );
};
