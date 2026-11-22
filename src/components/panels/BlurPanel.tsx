import React from 'react';
import type { BlurParams } from '../../types/editor';
import { StudioSlider } from '../StudioSlider';

interface BlurPanelProps {
  params: BlurParams;
  onChange: (next: BlurParams) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const MODES: Array<{ id: BlurParams['mode']; label: string }> = [
  { id: 'radial', label: 'Radial' },
  { id: 'linear', label: 'Linear' },
  { id: 'tiltshift', label: 'Tilt-Shift' },
  { id: 'background', label: 'Subject' },
];

export const BlurPanel: React.FC<BlurPanelProps> = ({
  params,
  onChange,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Blur & Focus</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onChange({ ...params, mode: m.id, amount: params.amount === 0 ? 45 : params.amount });
              onDragEnd();
            }}
            aria-pressed={params.mode === m.id}
            className={`py-1.5 rounded-md text-xs font-medium border transition-colors ${
              params.mode === m.id
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'bg-[#181A20] text-zinc-300 border-white/[0.06] hover:bg-white/10'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 pt-1">
        <StudioSlider
          label="Blur Intensity"
          value={params.amount}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => onChange({ ...params, amount: v })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Focus Radius"
          value={Math.round(params.radius * 100)}
          min={5}
          max={80}
          defaultValue={32}
          unit="%"
          onChange={(v) => onChange({ ...params, radius: v / 100 })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Feather"
          value={params.feather}
          min={5}
          max={100}
          defaultValue={45}
          unit="%"
          onChange={(v) => onChange({ ...params, feather: v })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        {(params.mode === 'linear' || params.mode === 'tiltshift') && (
          <StudioSlider
            label="Plane Angle"
            value={params.angle}
            min={-90}
            max={90}
            unit="°"
            onChange={(v) => onChange({ ...params, angle: v })}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        )}
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-500">Bokeh Aperture Shape</span>
        <div className="grid grid-cols-4 gap-1">
          {(['circle', 'hexagon', 'octagon', 'anamorphic'] as const).map((shape) => (
            <button
              key={shape}
              type="button"
              onClick={() => {
                onChange({ ...params, bokehShape: shape });
                onDragEnd();
              }}
              aria-pressed={(params.bokehShape ?? 'circle') === shape}
              className={`py-1 rounded text-[10px] capitalize border ${
                (params.bokehShape ?? 'circle') === shape
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                  : 'bg-[#181A20] text-zinc-400 border-white/[0.06]'
              }`}
            >
              {shape === 'anamorphic' ? 'Oval' : shape}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-zinc-500">
        Drag the focus target directly on the canvas to reposition the focal point.
      </p>
    </div>
  );
};
