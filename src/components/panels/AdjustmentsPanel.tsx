import React from 'react';
import { Pipette } from 'lucide-react';
import type { AdjustmentsParams, ToneExtendedParams } from '../../types/editor';
import { StudioSlider } from '../StudioSlider';

interface AdjustmentsPanelProps {
  params: AdjustmentsParams;
  toneExtended: ToneExtendedParams;
  wbPickerActive: boolean;
  onToggleWbPicker: (active: boolean) => void;
  onChange: (next: AdjustmentsParams, commit: boolean) => void;
  onChangeToneExtended: (next: ToneExtendedParams) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({
  params,
  toneExtended,
  wbPickerActive,
  onToggleWbPicker,
  onChange,
  onChangeToneExtended,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  const update = (key: keyof AdjustmentsParams, val: number) => {
    onChange({ ...params, [key]: val }, false);
  };

  const updateExt = <K extends keyof ToneExtendedParams>(key: K, val: ToneExtendedParams[K]) => {
    onChangeToneExtended({ ...toneExtended, [key]: val });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Adjustments & Levels</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      <section className="space-y-3">
        <h3 className="text-[11px] font-medium text-zinc-500">Light & Tone</h3>
        <StudioSlider label="Exposure" value={params.exposure} min={-100} max={100} onChange={(v) => update('exposure', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Brightness" value={params.brightness ?? 0} min={-100} max={100} onChange={(v) => update('brightness', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Contrast" value={params.contrast} min={-100} max={100} onChange={(v) => update('contrast', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Highlights" value={params.highlights} min={-100} max={100} onChange={(v) => update('highlights', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Shadows" value={params.shadows} min={-100} max={100} onChange={(v) => update('shadows', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Whites" value={params.whites} min={-100} max={100} onChange={(v) => update('whites', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Blacks" value={params.blacks} min={-100} max={100} onChange={(v) => update('blacks', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </section>

      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">White Balance & Color</h3>
          <button
            type="button"
            onClick={() => onToggleWbPicker(!wbPickerActive)}
            aria-pressed={wbPickerActive}
            aria-label="White balance eyedropper"
            className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border transition-colors ${
              wbPickerActive
                ? 'bg-amber-500 text-zinc-950 border-amber-500'
                : 'bg-[#181A20] text-zinc-300 border-white/10 hover:bg-white/10'
            }`}
          >
            <Pipette className="w-3 h-3" />
            <span>{wbPickerActive ? 'Click Neutral…' : 'Eyedropper'}</span>
          </button>
        </div>
        <StudioSlider label="Temperature" value={params.temperature} min={-100} max={100} onChange={(v) => update('temperature', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Tint" value={params.tint} min={-100} max={100} onChange={(v) => update('tint', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Vibrance" value={params.vibrance} min={-100} max={100} onChange={(v) => update('vibrance', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Saturation" value={params.saturation} min={-100} max={100} onChange={(v) => update('saturation', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </section>

      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Levels & Gamma</h3>
        <StudioSlider
          label="Gamma"
          value={Math.round(toneExtended.gamma * 100)}
          min={30}
          max={250}
          defaultValue={100}
          unit="%"
          onChange={(v) => updateExt('gamma', Number((v / 100).toFixed(2)))}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Input Black Point"
          value={toneExtended.inputBlack}
          min={0}
          max={220}
          defaultValue={0}
          onChange={(v) => updateExt('inputBlack', Math.min(v, toneExtended.inputWhite - 10))}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Input White Point"
          value={toneExtended.inputWhite}
          min={35}
          max={255}
          defaultValue={255}
          onChange={(v) => updateExt('inputWhite', Math.max(v, toneExtended.inputBlack + 10))}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Output Black"
          value={toneExtended.outputBlack}
          min={0}
          max={220}
          defaultValue={0}
          onChange={(v) => updateExt('outputBlack', Math.min(v, toneExtended.outputWhite - 10))}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Output White"
          value={toneExtended.outputWhite}
          min={35}
          max={255}
          defaultValue={255}
          onChange={(v) => updateExt('outputWhite', Math.max(v, toneExtended.outputBlack + 10))}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>

      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Presence & Film</h3>
        <StudioSlider label="Clarity" value={params.clarity} min={-100} max={100} onChange={(v) => update('clarity', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Dehaze" value={params.dehaze} min={-100} max={100} onChange={(v) => update('dehaze', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Sharpness" value={params.sharpness} min={0} max={100} onChange={(v) => update('sharpness', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Film Grain" value={params.grain} min={0} max={100} onChange={(v) => update('grain', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Vignette" value={params.vignette} min={-100} max={100} onChange={(v) => update('vignette', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Fade" value={params.fade} min={0} max={100} onChange={(v) => update('fade', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </section>
    </div>
  );
};
