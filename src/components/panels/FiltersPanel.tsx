import React, { useRef, useState } from 'react';
import { BookmarkPlus, Download, Puzzle, Star, Trash2, Upload } from 'lucide-react';
import {
  FILTER_CATEGORIES,
  getAllFilterPresets,
  type FilterCategory,
} from '../../engine/filters';
import type { CustomPreset, FilterParams } from '../../types/editor';
import { StudioSlider } from '../StudioSlider';

interface FiltersPanelProps {
  activeFilter: FilterParams | null;
  thumbnails: Record<string, string>;
  customPresets: CustomPreset[];
  favoriteIds: string[];
  recentIds: string[];
  onSelectPreset: (presetId: string, presetName: string) => void;
  onSelectCustomPreset: (preset: CustomPreset) => void;
  onToggleFavorite: (presetId: string) => void;
  onSaveCustomPreset: (name: string) => void;
  onDeleteCustomPreset: (id: string) => void;
  onExportCustomPresets: () => void;
  onImportPresetsFile: (file: File) => void;
  onRegisterPluginPreset: () => void;
  onChangeIntensity: (intensity: number) => void;
  onClearFilter: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const FiltersPanel: React.FC<FiltersPanelProps> = ({
  activeFilter,
  thumbnails,
  customPresets,
  favoriteIds,
  recentIds,
  onSelectPreset,
  onSelectCustomPreset,
  onToggleFavorite,
  onSaveCustomPreset,
  onDeleteCustomPreset,
  onExportCustomPresets,
  onImportPresetsFile,
  onRegisterPluginPreset,
  onChangeIntensity,
  onClearFilter,
  onDragStart,
  onDragEnd,
}) => {
  const [category, setCategory] = useState<FilterCategory>('All');
  const [customName, setCustomName] = useState('');
  const importRef = useRef<HTMLInputElement | null>(null);

  const allBuiltIn = getAllFilterPresets();

  const visibleBuiltIn =
    category === 'All'
      ? allBuiltIn
      : category === 'Favourites'
        ? allBuiltIn.filter((p) => favoriteIds.includes(p.id))
        : category === 'Custom'
          ? []
          : allBuiltIn.filter((p) => p.category === category);

  const recentPresets = recentIds
    .map((id) => allBuiltIn.find((p) => p.id === id))
    .filter((p): p is NonNullable<typeof p> => Boolean(p))
    .slice(0, 4);

  return (
    <div className="space-y-4">
      <input
        ref={importRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onImportPresetsFile(f);
          e.target.value = '';
        }}
      />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Presets & Looks</h2>
          <span className="text-[11px] font-mono-num text-zinc-500">
            {allBuiltIn.length + customPresets.length}
          </span>
        </div>
        {activeFilter && (
          <button
            type="button"
            onClick={onClearFilter}
            className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {activeFilter && (
        <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.08]">
          <StudioSlider
            label={`${activeFilter.presetName} Intensity`}
            value={activeFilter.intensity}
            min={0}
            max={100}
            defaultValue={100}
            unit="%"
            onChange={onChangeIntensity}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>
      )}

      {/* Save Current Edit Stack as Custom Preset + Import/Export */}
      <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2">
        <div className="flex gap-1.5">
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            placeholder="Custom preset name…"
            aria-label="Custom preset name"
            className="flex-1 rounded-md bg-[#181A20] border border-white/10 px-2 py-1 text-xs text-zinc-100"
          />
          <button
            type="button"
            onClick={() => {
              onSaveCustomPreset(customName.trim() || `Custom Look ${customPresets.length + 1}`);
              setCustomName('');
            }}
            aria-label="Save stack as custom preset"
            className="px-2.5 py-1 rounded-md bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-medium flex items-center gap-1"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span>Save</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => importRef.current?.click()}
            className="flex-1 py-1 px-2 rounded bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-[11px] text-zinc-300 flex items-center justify-center gap-1"
          >
            <Upload className="w-3 h-3" />
            <span>Import JSON</span>
          </button>
          <button
            type="button"
            onClick={onExportCustomPresets}
            disabled={customPresets.length === 0}
            className="flex-1 py-1 px-2 rounded bg-[#181A20] hover:bg-white/10 disabled:opacity-40 border border-white/[0.06] text-[11px] text-zinc-300 flex items-center justify-center gap-1"
          >
            <Download className="w-3 h-3" />
            <span>Export ({customPresets.length})</span>
          </button>
          <button
            type="button"
            onClick={onRegisterPluginPreset}
            title="Register Custom Filter Plugin"
            aria-label="Register custom filter plugin"
            className="py-1 px-2 rounded bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-[11px] text-zinc-300 flex items-center justify-center gap-1"
          >
            <Puzzle className="w-3 h-3 text-violet-400" />
          </button>
        </div>
      </div>

      {/* Recently Used */}
      {recentPresets.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Recently Used
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {recentPresets.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPreset(p.id, p.name)}
                className="px-1.5 py-1 rounded bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-[10px] text-zinc-300 truncate"
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-1" role="tablist" aria-label="Filter categories">
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            role="tab"
            aria-selected={category === cat}
            onClick={() => setCategory(cat)}
            className={`px-2 py-1 rounded-md text-[11px] font-medium whitespace-nowrap transition-colors ${
              category === cat
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-[#181A20] text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Custom Saved Stack Presets */}
      {(category === 'All' || category === 'Custom') && customPresets.length > 0 && (
        <div className="space-y-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-amber-400/90">
            Your Custom Presets
          </span>
          <div className="space-y-1">
            {customPresets.map((cp) => (
              <div
                key={cp.id}
                className="flex items-center justify-between px-2.5 py-1.5 rounded-md bg-[#181A20] border border-white/[0.06]"
              >
                <button
                  type="button"
                  onClick={() => onSelectCustomPreset(cp)}
                  className="text-xs text-zinc-200 hover:text-amber-300 truncate text-left flex-1"
                >
                  {cp.name} ({cp.layers.length} layers)
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteCustomPreset(cp.id)}
                  aria-label={`Delete custom preset ${cp.name}`}
                  className="p-1 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Preset Grid */}
      <div className="grid grid-cols-3 gap-2">
        {visibleBuiltIn.map((preset) => {
          const isSelected = activeFilter?.presetId === preset.id;
          const isFav = favoriteIds.includes(preset.id);
          const thumb = thumbnails[preset.id];
          return (
            <div
              key={preset.id}
              className={`group relative flex flex-col items-center gap-1 rounded-lg p-1 border transition-all ${
                isSelected
                  ? 'border-amber-500 bg-amber-500/10'
                  : 'border-white/[0.06] bg-[#181A20] hover:border-white/20'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleFavorite(preset.id);
                }}
                aria-label={isFav ? `Unfavourite ${preset.name}` : `Favourite ${preset.name}`}
                aria-pressed={isFav}
                className={`absolute top-1.5 right-1.5 z-10 p-0.5 rounded bg-black/55 backdrop-blur transition-opacity ${
                  isFav ? 'opacity-100 text-amber-400' : 'opacity-0 group-hover:opacity-100 text-zinc-300'
                }`}
              >
                <Star className={`w-3 h-3 ${isFav ? 'fill-amber-400' : ''}`} />
              </button>
              <button
                type="button"
                onClick={() => onSelectPreset(preset.id, preset.name)}
                aria-pressed={isSelected}
                className="w-full flex flex-col items-center gap-1 text-left"
              >
                <div className="w-full aspect-square rounded overflow-hidden bg-[#0B0C0F]">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`${preset.name} filter preview`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-zinc-600">
                      ...
                    </div>
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium truncate w-full text-center ${
                    isSelected ? 'text-amber-300' : 'text-zinc-300'
                  }`}
                >
                  {preset.name}
                </span>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
