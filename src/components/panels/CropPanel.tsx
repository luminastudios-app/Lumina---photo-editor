import React from 'react';
import { FlipHorizontal, FlipVertical, RotateCw } from 'lucide-react';
import type { AspectPreset, CropParams } from '../../types/editor';
import { ASPECT_RATIOS } from '../../engine/pipeline';
import { StudioSlider } from '../StudioSlider';

interface CropPanelProps {
  params: CropParams;
  imageAspect: number;
  onChange: (next: CropParams) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const ASPECT_OPTIONS: Array<{ id: AspectPreset; label: string }> = [
  { id: 'free', label: 'Free' },
  { id: '1:1', label: '1:1' },
  { id: '4:5', label: '4:5' },
  { id: '16:9', label: '16:9' },
  { id: '9:16', label: '9:16' },
];

export const CropPanel: React.FC<CropPanelProps> = ({
  params,
  imageAspect,
  onChange,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  const selectAspect = (preset: AspectPreset) => {
    const targetRatio = ASPECT_RATIOS[preset];
    if (!targetRatio) {
      onChange({
        ...params,
        aspectPreset: 'free',
        cropRect: { x: 0, y: 0, w: 1, h: 1 },
      });
      onDragEnd();
      return;
    }

    const rotatedAspect =
      params.rotate90 === 90 || params.rotate90 === 270
        ? 1 / Math.max(0.1, imageAspect)
        : Math.max(0.1, imageAspect);

    let w = 1;
    let h = 1;
    if (rotatedAspect > targetRatio) {
      h = 1;
      w = targetRatio / rotatedAspect;
    } else {
      w = 1;
      h = rotatedAspect / targetRatio;
    }

    onChange({
      ...params,
      aspectPreset: preset,
      cropRect: {
        x: (1 - w) / 2,
        y: (1 - h) / 2,
        w,
        h,
      },
    });
    onDragEnd();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Crop & Transform</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      <section className="space-y-2">
        <span className="text-[11px] font-medium text-zinc-500">Aspect Ratio</span>
        <div className="grid grid-cols-5 gap-1">
          {ASPECT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => selectAspect(opt.id)}
              aria-pressed={params.aspectPreset === opt.id}
              className={`py-1.5 rounded-md text-[11px] font-medium transition-colors ${
                params.aspectPreset === opt.id
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-[#181A20] text-zinc-300 hover:bg-white/10 border border-white/[0.06]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2 pt-3 border-t border-white/[0.06]">
        <span className="text-[11px] font-medium text-zinc-500">Orientation</span>
        <div className="grid grid-cols-3 gap-1.5">
          <button
            type="button"
            onClick={() => {
              onChange({
                ...params,
                rotate90: ((params.rotate90 + 90) % 360) as 0 | 90 | 180 | 270,
              });
              onDragEnd();
            }}
            className="flex items-center justify-center gap-1.5 py-2 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-200 border border-white/[0.06]"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>90°</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ ...params, flipH: !params.flipH });
              onDragEnd();
            }}
            aria-pressed={params.flipH}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs border transition-colors ${
              params.flipH
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-[#181A20] hover:bg-white/10 text-zinc-200 border-white/[0.06]'
            }`}
          >
            <FlipHorizontal className="w-3.5 h-3.5" />
            <span>Flip H</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onChange({ ...params, flipV: !params.flipV });
              onDragEnd();
            }}
            aria-pressed={params.flipV}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-md text-xs border transition-colors ${
              params.flipV
                ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                : 'bg-[#181A20] hover:bg-white/10 text-zinc-200 border-white/[0.06]'
            }`}
          >
            <FlipVertical className="w-3.5 h-3.5" />
            <span>Flip V</span>
          </button>
        </div>
      </section>

      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <span className="text-[11px] font-medium text-zinc-500">Transform Inside Frame</span>
        <StudioSlider
          label="Straighten"
          value={params.straighten}
          min={-45}
          max={45}
          step={0.5}
          unit="°"
          onChange={(v) => onChange({ ...params, straighten: v })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Scale"
          value={Math.round(params.scale * 100)}
          min={50}
          max={250}
          defaultValue={100}
          unit="%"
          onChange={(v) => onChange({ ...params, scale: v / 100 })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Pan X"
          value={Math.round(params.offsetX * 100)}
          min={-50}
          max={50}
          unit="%"
          onChange={(v) => onChange({ ...params, offsetX: v / 100 })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Pan Y"
          value={Math.round(params.offsetY * 100)}
          min={-50}
          max={50}
          unit="%"
          onChange={(v) => onChange({ ...params, offsetY: v / 100 })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>

      <section className="space-y-2.5 pt-3 border-t border-white/[0.06]">
        <span className="text-[11px] font-medium text-zinc-500">Crop Bounds</span>
        <StudioSlider
          label="Crop Width"
          value={Math.round(params.cropRect.w * 100)}
          min={20}
          max={100}
          defaultValue={100}
          unit="%"
          onChange={(v) => {
            const w = v / 100;
            const x = Math.min(params.cropRect.x, 1 - w);
            onChange({
              ...params,
              aspectPreset: 'free',
              cropRect: { ...params.cropRect, x, w },
            });
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Crop Height"
          value={Math.round(params.cropRect.h * 100)}
          min={20}
          max={100}
          defaultValue={100}
          unit="%"
          onChange={(v) => {
            const h = v / 100;
            const y = Math.min(params.cropRect.y, 1 - h);
            onChange({
              ...params,
              aspectPreset: 'free',
              cropRect: { ...params.cropRect, y, h },
            });
          }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>
    </div>
  );
};
