import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  CopyPlus,
  Eye,
  EyeOff,
  FolderKanban,
  Layers,
  Lock,
  Trash2,
  Unlock,
} from 'lucide-react';
import type { BlendMode, EditLayer, LayerBaseProps, ToolId } from '../types/editor';

interface EditStackPanelProps {
  layers: EditLayer[];
  selectedLayerId: string | null;
  onSelectLayer: (layer: EditLayer) => void;
  onToggleLayer: (id: string) => void;
  onToggleLock: (id: string) => void;
  onDuplicateLayer: (id: string) => void;
  onGroupLayer: (id: string) => void;
  onUpdateLayerBase: (id: string, patch: Partial<LayerBaseProps>) => void;
  onMoveLayer: (from: number, to: number) => void;
  onRemoveLayer: (id: string) => void;
  onClearAll: () => void;
}

const BLEND_MODES: BlendMode[] = [
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

export function layerTypeToTool(type: EditLayer['type']): ToolId {
  switch (type) {
    case 'adjustments':
    case 'tone-extended':
      return 'adjust';
    case 'hsl':
      return 'color';
    case 'curves':
      return 'curves';
    case 'detail-effects':
      return 'effects';
    case 'filter':
      return 'filters';
    case 'crop':
      return 'crop';
    case 'blur':
      return 'blur';
    case 'text':
      return 'text';
    case 'frame':
    case 'draw':
    case 'sticker':
    case 'shape':
      return 'overlays';
    case 'image':
      return 'overlay';
    case 'group':
      return 'masks';
    default:
      return 'effects';
  }
}

export const EditStackPanel: React.FC<EditStackPanelProps> = ({
  layers,
  selectedLayerId,
  onSelectLayer,
  onToggleLayer,
  onToggleLock,
  onDuplicateLayer,
  onGroupLayer,
  onUpdateLayerBase,
  onMoveLayer,
  onRemoveLayer,
  onClearAll,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const selectedLayer = layers.find((l) => l.id === selectedLayerId) ?? null;

  return (
    <div className="flex flex-col border-t border-white/[0.08]">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white"
        >
          <Layers className="w-3.5 h-3.5 text-zinc-400" />
          <span>Layers</span>
          <span className="font-mono-num text-[11px] text-zinc-500">({layers.length})</span>
          {collapsed ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>
        {layers.length > 0 && (
          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-zinc-400 hover:text-rose-400 transition-colors whitespace-nowrap"
          >
            Reset All
          </button>
        )}
      </div>

      {!collapsed && (
        <>
          {/* Selected Layer Opacity & Blend Mode Bar */}
          {selectedLayer && selectedLayer.type !== 'crop' && selectedLayer.type !== 'group' && (
            <div className="mx-2 mb-2 p-2 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2">
              <div className="flex items-center justify-between gap-2">
                <select
                  aria-label="Layer blend mode"
                  value={selectedLayer.blendMode ?? 'normal'}
                  onChange={(e) =>
                    onUpdateLayerBase(selectedLayer.id, { blendMode: e.target.value as BlendMode })
                  }
                  className="flex-1 rounded bg-[#181A20] border border-white/10 px-1.5 py-1 text-[11px] text-zinc-200 capitalize"
                >
                  {BLEND_MODES.map((m) => (
                    <option key={m} value={m}>
                      {m.replace('-', ' ')}
                    </option>
                  ))}
                </select>
                <span className="font-mono-num text-[11px] text-zinc-300 w-9 text-right">
                  {selectedLayer.opacity ?? 100}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={selectedLayer.opacity ?? 100}
                aria-label="Layer opacity"
                onChange={(e) =>
                  onUpdateLayerBase(selectedLayer.id, { opacity: Number(e.target.value) })
                }
                className="studio-slider"
              />
            </div>
          )}

          {layers.length === 0 ? (
            <div className="px-3 pb-3 text-[11px] text-zinc-500">
              Non-destructive layers appear here. Drag to reorder, blend, mask, duplicate, or group.
            </div>
          ) : (
            <ul className="px-2 pb-2 space-y-1 max-h-48 overflow-y-auto studio-scroll" aria-label="Edit stack layers">
              {[...layers].reverse().map((layer, revIdx) => {
                const actualIdx = layers.length - 1 - revIdx;
                const isSelected = selectedLayerId === layer.id;

                return (
                  <li
                    key={layer.id}
                    draggable={!layer.locked}
                    onDragStart={() => setDragIdx(actualIdx)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (dragIdx !== null && dragIdx !== actualIdx) {
                        onMoveLayer(dragIdx, actualIdx);
                      }
                      setDragIdx(null);
                    }}
                    className={`flex items-center justify-between gap-1 px-2 py-1.5 rounded-lg border text-xs transition-colors ${
                      layer.groupId ? 'ml-3' : ''
                    } ${
                      isSelected
                        ? 'bg-white/[0.08] border-amber-500/40 text-zinc-100'
                        : 'bg-[#181A20] border-white/[0.06] text-zinc-300 hover:border-white/[0.14]'
                    } ${!layer.enabled ? 'opacity-50' : ''}`}
                  >
                    <button
                      type="button"
                      onClick={() => onSelectLayer(layer)}
                      className="flex items-center gap-1 min-w-0 flex-1 text-left"
                    >
                      {layer.type === 'group' && (
                        <FolderKanban className="w-3 h-3 text-amber-400 shrink-0" />
                      )}
                      <span className="truncate font-medium">{layer.name}</span>
                      {layer.mask?.enabled && (
                        <span className="px-1 rounded bg-amber-500/20 text-[9px] text-amber-300 shrink-0">
                          M
                        </span>
                      )}
                    </button>

                    <div className="flex items-center gap-0.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => onMoveLayer(actualIdx, actualIdx + 1)}
                        disabled={actualIdx === layers.length - 1}
                        aria-label={`Move ${layer.name} up`}
                        title="Move up"
                        className="p-0.5 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onMoveLayer(actualIdx, actualIdx - 1)}
                        disabled={actualIdx === 0}
                        aria-label={`Move ${layer.name} down`}
                        title="Move down"
                        className="p-0.5 rounded text-zinc-400 hover:text-zinc-100 disabled:opacity-25"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDuplicateLayer(layer.id)}
                        aria-label={`Duplicate ${layer.name}`}
                        title="Duplicate layer"
                        className="p-0.5 rounded text-zinc-400 hover:text-zinc-100"
                      >
                        <CopyPlus className="w-3 h-3" />
                      </button>
                      {actualIdx > 0 && layer.type !== 'group' && (
                        <button
                          type="button"
                          onClick={() => onGroupLayer(layer.id)}
                          aria-label={`Group ${layer.name} with below`}
                          title="Group with layer below"
                          className="p-0.5 rounded text-zinc-400 hover:text-amber-300"
                        >
                          <FolderKanban className="w-3 h-3" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleLock(layer.id)}
                        aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
                        title={layer.locked ? 'Unlock layer' : 'Lock layer'}
                        className={`p-0.5 rounded ${layer.locked ? 'text-amber-400' : 'text-zinc-400 hover:text-zinc-100'}`}
                      >
                        {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleLayer(layer.id)}
                        aria-label={`${layer.enabled ? 'Hide' : 'Show'} ${layer.name}`}
                        title={layer.enabled ? 'Hide layer' : 'Show layer'}
                        className="p-0.5 rounded text-zinc-400 hover:text-zinc-100"
                      >
                        {layer.enabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(layer.locked)}
                        onClick={() => onRemoveLayer(layer.id)}
                        aria-label={`Delete ${layer.name}`}
                        title="Delete layer"
                        className="p-0.5 rounded text-zinc-400 hover:text-rose-400 disabled:opacity-25"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </div>
  );
};
