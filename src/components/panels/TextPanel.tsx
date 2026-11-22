import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, Plus, Trash2 } from 'lucide-react';
import type { EditLayer, TextParams } from '../../types/editor';
import { createDefaultText } from '../../engine/stackReducer';
import { StudioSlider } from '../StudioSlider';

interface TextPanelProps {
  textLayers: Array<Extract<EditLayer, { type: 'text' }>>;
  selectedLayerId: string | null;
  onSelectLayer: (id: string) => void;
  onAddText: (template?: Partial<TextParams>, label?: string) => void;
  onUpdateText: (id: string, next: TextParams) => void;
  onDeleteText: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const FONT_CHOICES = [
  { id: 'Plus Jakarta Sans', label: 'Jakarta Sans' },
  { id: 'DM Sans', label: 'DM Sans' },
  { id: 'Playfair Display', label: 'Playfair Serif' },
  { id: 'JetBrains Mono', label: 'JetBrains Mono' },
  { id: 'Georgia', label: 'Editorial Georgia' },
];

const COLOR_SWATCHES = ['#FFFFFF', '#0B0C0F', '#F59E0B', '#FB7185', '#38BDF8', '#34D399'];

const TEXT_TEMPLATES: Array<{ label: string; preset: Partial<TextParams> }> = [
  {
    label: 'Editorial Serif',
    preset: {
      text: 'EDITION N° 04',
      fontFamily: 'Playfair Display',
      fontSize: 58,
      fontWeight: 700,
      letterSpacing: 4,
      color: '#FFFFFF',
      shadowBlur: 18,
    },
  },
  {
    label: 'Neon Glow',
    preset: {
      text: 'AFTER HOURS',
      fontFamily: 'Plus Jakarta Sans',
      fontSize: 56,
      fontWeight: 800,
      letterSpacing: 3,
      color: '#FEF3C7',
      glowBlur: 26,
      glowColor: '#F59E0B',
    },
  },
  {
    label: 'Story Caption',
    preset: {
      text: 'Sunday Morning Coffee',
      fontFamily: 'DM Sans',
      fontSize: 38,
      fontWeight: 600,
      bgEnabled: true,
      bgColor: '#0B0C0F',
      color: '#FFFFFF',
    },
  },
  {
    label: 'Curved Badge',
    preset: {
      text: 'SHOT ON 35MM FILM',
      fontFamily: 'JetBrains Mono',
      fontSize: 36,
      fontWeight: 700,
      letterSpacing: 3,
      curveAmount: 42,
      color: '#F59E0B',
    },
  },
];

export const TextPanel: React.FC<TextPanelProps> = ({
  textLayers,
  selectedLayerId,
  onSelectLayer,
  onAddText,
  onUpdateText,
  onDeleteText,
  onDragStart,
  onDragEnd,
}) => {
  const activeLayer =
    textLayers.find((l) => l.id === selectedLayerId) ?? textLayers[textLayers.length - 1] ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Typography & Templates</h2>
        <button
          type="button"
          onClick={() => onAddText()}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-amber-500 text-zinc-950 hover:bg-amber-400 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Add Text</span>
        </button>
      </div>

      {/* Text Templates & Caption Styles */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-500">Templates & Caption Styles</span>
        <div className="grid grid-cols-2 gap-1.5">
          {TEXT_TEMPLATES.map((tpl) => (
            <button
              key={tpl.label}
              type="button"
              onClick={() =>
                onAddText({ ...createDefaultText(), ...tpl.preset }, tpl.label)
              }
              className="py-1.5 px-2 rounded-md bg-[#181A20] hover:bg-white/10 border border-white/[0.06] text-[11px] text-zinc-200 text-left truncate"
            >
              + {tpl.label}
            </button>
          ))}
        </div>
      </div>

      {textLayers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {textLayers.map((layer, idx) => (
            <button
              key={layer.id}
              type="button"
              onClick={() => onSelectLayer(layer.id)}
              className={`px-2 py-1 rounded-md text-[11px] font-medium border truncate max-w-[120px] ${
                activeLayer?.id === layer.id
                  ? 'border-amber-500 bg-amber-500/15 text-amber-300'
                  : 'border-white/[0.08] bg-[#181A20] text-zinc-300'
              }`}
            >
              {layer.params.text || `Text ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {!activeLayer ? (
        <div className="p-4 rounded-lg bg-[#0B0C0F] border border-white/[0.06] text-center space-y-2">
          <p className="text-xs text-zinc-400">No text layers yet.</p>
          <p className="text-[11px] text-zinc-500">
            Pick a template above or add custom curved/glowing text and drag on canvas.
          </p>
        </div>
      ) : (
        <div className="space-y-3.5">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="text-content-input" className="text-[11px] text-zinc-400">
                Content
              </label>
              <button
                type="button"
                onClick={() => onDeleteText(activeLayer.id)}
                aria-label="Delete active text layer"
                className="text-[11px] text-zinc-400 hover:text-rose-400 flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                <span>Remove</span>
              </button>
            </div>
            <textarea
              id="text-content-input"
              rows={2}
              value={activeLayer.params.text}
              onChange={(e) =>
                onUpdateText(activeLayer.id, { ...activeLayer.params, text: e.target.value })
              }
              className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label htmlFor="text-font-select" className="text-[11px] text-zinc-400">
                Font Family
              </label>
              <select
                id="text-font-select"
                value={activeLayer.params.fontFamily}
                onChange={(e) =>
                  onUpdateText(activeLayer.id, { ...activeLayer.params, fontFamily: e.target.value })
                }
                className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2 py-1.5 text-xs text-zinc-100"
              >
                {FONT_CHOICES.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <span className="text-[11px] text-zinc-400">Alignment</span>
              <div className="grid grid-cols-3 gap-1">
                {(['left', 'center', 'right'] as const).map((al) => {
                  const Icon = al === 'left' ? AlignLeft : al === 'right' ? AlignRight : AlignCenter;
                  const active = (activeLayer.params.textAlign ?? 'center') === al;
                  return (
                    <button
                      key={al}
                      type="button"
                      aria-label={`Align text ${al}`}
                      aria-pressed={active}
                      onClick={() =>
                        onUpdateText(activeLayer.id, { ...activeLayer.params, textAlign: al })
                      }
                      className={`py-1.5 rounded border flex items-center justify-center ${
                        active
                          ? 'bg-amber-500 text-zinc-950 border-amber-500'
                          : 'bg-[#181A20] text-zinc-300 border-white/10'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <span className="text-[11px] text-zinc-400">Text Color</span>
            <div className="flex items-center gap-1.5">
              {COLOR_SWATCHES.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`Text color ${c}`}
                  onClick={() =>
                    onUpdateText(activeLayer.id, { ...activeLayer.params, color: c })
                  }
                  className={`w-6 h-6 rounded-full border ${
                    activeLayer.params.color === c ? 'border-amber-400 scale-110' : 'border-white/20'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                aria-label="Custom text color"
                value={activeLayer.params.color}
                onChange={(e) =>
                  onUpdateText(activeLayer.id, { ...activeLayer.params, color: e.target.value })
                }
                className="w-6 h-6 rounded bg-transparent cursor-pointer"
              />
            </div>
          </div>

          <StudioSlider label="Font Size" value={activeLayer.params.fontSize} min={18} max={140} defaultValue={52} unit="px" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, fontSize: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Font Weight" value={activeLayer.params.fontWeight} min={300} max={900} step={100} defaultValue={700} onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, fontWeight: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Letter Spacing" value={activeLayer.params.letterSpacing ?? 0} min={-4} max={20} defaultValue={0} unit="px" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, letterSpacing: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Line Height" value={Math.round((activeLayer.params.lineHeight ?? 1.22) * 100)} min={80} max={220} defaultValue={122} unit="%" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, lineHeight: Number((v / 100).toFixed(2)) })} onDragStart={onDragStart} onDragEnd={onDragEnd} />

          {/* Text Path Mode & Curvature */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <span className="text-[11px] text-zinc-400">Text Path Shape</span>
            <div className="grid grid-cols-3 gap-1">
              {(['arc', 'wave', 'circle'] as const).map((ps) => {
                const active = (activeLayer.params.pathStyle ?? 'arc') === ps;
                return (
                  <button
                    key={ps}
                    type="button"
                    aria-pressed={active}
                    onClick={() =>
                      onUpdateText(activeLayer.id, {
                        ...activeLayer.params,
                        pathStyle: ps,
                        curveAmount:
                          activeLayer.params.curveAmount === 0 && ps !== 'arc'
                            ? 45
                            : activeLayer.params.curveAmount ?? 0,
                      })
                    }
                    className={`py-1 rounded text-[11px] capitalize border ${
                      active
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                        : 'bg-[#181A20] text-zinc-300 border-white/10'
                    }`}
                  >
                    {ps}
                  </button>
                );
              })}
            </div>
            <StudioSlider
              label="Path Curve"
              value={activeLayer.params.curveAmount ?? 0}
              min={-100}
              max={100}
              defaultValue={0}
              unit="°"
              onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, curveAmount: v })}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>

          {/* Gradient Text Fill */}
          <div className="space-y-2 pt-2 border-t border-white/[0.06]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-zinc-300 font-medium">Gradient Fill</span>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(activeLayer.params.gradientEnabled)}
                aria-label="Toggle text gradient fill"
                onClick={() =>
                  onUpdateText(activeLayer.id, {
                    ...activeLayer.params,
                    gradientEnabled: !activeLayer.params.gradientEnabled,
                  })
                }
                className={`px-2.5 py-0.5 rounded text-[11px] font-medium ${
                  activeLayer.params.gradientEnabled
                    ? 'bg-amber-500 text-zinc-950 font-semibold'
                    : 'bg-[#181A20] text-zinc-400 border border-white/10'
                }`}
              >
                {activeLayer.params.gradientEnabled ? 'On' : 'Off'}
              </button>
            </div>
            {activeLayer.params.gradientEnabled && (
              <div className="space-y-2 p-2 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-400">
                  <label className="flex items-center gap-1.5">
                    <span>Start</span>
                    <input
                      type="color"
                      aria-label="Gradient start color"
                      value={activeLayer.params.gradientColor1 ?? '#F59E0B'}
                      onChange={(e) =>
                        onUpdateText(activeLayer.id, {
                          ...activeLayer.params,
                          gradientColor1: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span>End</span>
                    <input
                      type="color"
                      aria-label="Gradient end color"
                      value={activeLayer.params.gradientColor2 ?? '#EC4899'}
                      onChange={(e) =>
                        onUpdateText(activeLayer.id, {
                          ...activeLayer.params,
                          gradientColor2: e.target.value,
                        })
                      }
                      className="w-6 h-6 rounded bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
                <StudioSlider
                  label="Gradient Angle"
                  value={activeLayer.params.gradientAngle ?? 45}
                  min={0}
                  max={360}
                  defaultValue={45}
                  unit="°"
                  onChange={(v) =>
                    onUpdateText(activeLayer.id, { ...activeLayer.params, gradientAngle: v })
                  }
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </div>
            )}
          </div>

          {/* Animated Text Preset for Video Export */}
          <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
            <label htmlFor="text-video-anim" className="text-[11px] text-zinc-400">
              Video Export Animation
            </label>
            <select
              id="text-video-anim"
              value={activeLayer.params.animation ?? 'none'}
              onChange={(e) =>
                onUpdateText(activeLayer.id, {
                  ...activeLayer.params,
                  animation: e.target.value as TextParams['animation'],
                })
              }
              className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2 py-1.5 text-xs text-zinc-100"
            >
              <option value="none">None (Static)</option>
              <option value="fade">Smooth Fade In/Out</option>
              <option value="slide-up">Slide Up</option>
              <option value="pop">Pop Bounce</option>
              <option value="typewriter">Typewriter Reveal</option>
              <option value="pulse">Subtle Pulse</option>
            </select>
          </div>

          <StudioSlider label="Rotation" value={activeLayer.params.rotation} min={-180} max={180} unit="°" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, rotation: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Stroke Width" value={activeLayer.params.strokeWidth} min={0} max={12} unit="px" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, strokeWidth: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Shadow Blur" value={activeLayer.params.shadowBlur} min={0} max={30} defaultValue={12} unit="px" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, shadowBlur: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />
          <StudioSlider label="Neon Glow Blur" value={activeLayer.params.glowBlur ?? 0} min={0} max={40} defaultValue={0} unit="px" onChange={(v) => onUpdateText(activeLayer.id, { ...activeLayer.params, glowBlur: v })} onDragStart={onDragStart} onDragEnd={onDragEnd} />

          <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
            <label htmlFor="text-bg-pill" className="text-xs text-zinc-300">
              Background Pill
            </label>
            <div className="flex items-center gap-2">
              {activeLayer.params.bgEnabled && (
                <input
                  type="color"
                  aria-label="Background pill color"
                  value={activeLayer.params.bgColor}
                  onChange={(e) =>
                    onUpdateText(activeLayer.id, { ...activeLayer.params, bgColor: e.target.value })
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
              )}
              <button
                id="text-bg-pill"
                type="button"
                role="switch"
                aria-checked={activeLayer.params.bgEnabled}
                onClick={() =>
                  onUpdateText(activeLayer.id, {
                    ...activeLayer.params,
                    bgEnabled: !activeLayer.params.bgEnabled,
                  })
                }
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  activeLayer.params.bgEnabled
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-[#181A20] text-zinc-400 border border-white/10'
                }`}
              >
                {activeLayer.params.bgEnabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
