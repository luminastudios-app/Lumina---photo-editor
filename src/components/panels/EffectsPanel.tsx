import React from 'react';
import { ArrowDown, ArrowUp, Sparkles, Eye, EyeOff, X } from 'lucide-react';
import type { DetailEffectsParams, OverlayEffectKind } from '../../types/editor';
import { createOverlayEffectItem } from '../../engine/overlayEffects';
import { EffectPreviewGrid } from '../EffectPreviewGrid';
import { StudioSlider } from '../StudioSlider';

interface EffectsPanelProps {
  sourceSrc: string;
  params: DetailEffectsParams;
  onChange: (next: DetailEffectsParams, recordHistory?: boolean) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

export const EffectsPanel: React.FC<EffectsPanelProps> = ({
  sourceSrc,
  params,
  onChange,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  const upd = <K extends keyof DetailEffectsParams>(key: K, val: DetailEffectsParams[K]) => {
    onChange({ ...params, [key]: val });
  };

  const picsartFx = params.picsartFx ?? [];

  const handleAddPicsartFx = (kind: OverlayEffectKind) => {
    const item = createOverlayEffectItem(kind);
    onChange({ ...params, picsartFx: [...picsartFx, item] }, true);
  };

  const moveFx = (idx: number, dir: -1 | 1) => {
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= picsartFx.length) return;
    const copy = [...picsartFx];
    const [item] = copy.splice(idx, 1);
    copy.splice(nextIdx, 0, item);
    onChange({ ...params, picsartFx: copy }, true);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Effects Library & Optics</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* Picsart-Style Categorized Effects Library with Live Previews */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Creative Effects ({picsartFx.length} stacked)</span>
          </h3>
          {picsartFx.length > 0 && (
            <button
              type="button"
              onClick={() => onChange({ ...params, picsartFx: [] }, true)}
              className="text-[10px] text-zinc-400 hover:text-rose-400"
            >
              Clear FX
            </button>
          )}
        </div>

        {/* Active Stackable / Reorderable FX Cards */}
        {picsartFx.length > 0 && (
          <div className="space-y-2" aria-label="Applied effects stack">
            {picsartFx.map((fx, idx) => (
              <div
                key={fx.id}
                data-testid="applied-effect-card"
                className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      aria-label={fx.enabled ? `Hide ${fx.label}` : `Show ${fx.label}`}
                      onClick={() =>
                        onChange(
                          {
                            ...params,
                            picsartFx: picsartFx.map((item) =>
                              item.id === fx.id ? { ...item, enabled: !item.enabled } : item,
                            ),
                          },
                          true,
                        )
                      }
                      className="text-zinc-400 hover:text-white"
                    >
                      {fx.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 opacity-45" />}
                    </button>
                    <span className={`text-xs font-medium truncate ${fx.enabled ? 'text-zinc-100' : 'text-zinc-500 line-through'}`}>
                      {fx.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      disabled={idx === 0}
                      aria-label={`Move ${fx.label} up`}
                      onClick={() => moveFx(idx, -1)}
                      className="p-0.5 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      disabled={idx === picsartFx.length - 1}
                      aria-label={`Move ${fx.label} down`}
                      onClick={() => moveFx(idx, 1)}
                      className="p-0.5 rounded text-zinc-400 hover:text-white disabled:opacity-25"
                    >
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Remove ${fx.label}`}
                      onClick={() =>
                        onChange(
                          {
                            ...params,
                            picsartFx: picsartFx.filter((item) => item.id !== fx.id),
                          },
                          true,
                        )
                      }
                      className="p-0.5 rounded text-zinc-400 hover:text-rose-400"
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
                  onChange={(intensity) =>
                    onChange(
                      {
                        ...params,
                        picsartFx: picsartFx.map((item) =>
                          item.id === fx.id ? { ...item, intensity } : item,
                        ),
                      },
                      false,
                    )
                  }
                  onDragStart={onDragStart}
                  onDragEnd={onDragEnd}
                />
              </div>
            ))}
          </div>
        )}

        <EffectPreviewGrid
          sourceSrc={sourceSrc}
          activeKinds={picsartFx.filter((e) => e.enabled).map((e) => e.kind)}
          excludeKinds={['bg-remove']}
          onPickEffect={handleAddPicsartFx}
        />
      </section>

      {/* Texture & Unsharp Mask */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Detail & Unsharp Mask</h3>
        <StudioSlider
          label="Texture"
          value={params.texture}
          min={-100}
          max={100}
          onChange={(v) => upd('texture', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Unsharp Amount"
          value={params.unsharpAmount}
          min={0}
          max={200}
          unit="%"
          onChange={(v) => upd('unsharpAmount', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Unsharp Radius"
          value={params.unsharpRadius}
          min={1}
          max={5}
          defaultValue={2}
          unit="px"
          onChange={(v) => upd('unsharpRadius', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Unsharp Threshold"
          value={params.unsharpThreshold}
          min={0}
          max={64}
          defaultValue={4}
          onChange={(v) => upd('unsharpThreshold', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>

      {/* Noise Reduction */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Noise Reduction</h3>
        <StudioSlider
          label="Luminance NR"
          value={params.noiseLuma}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('noiseLuma', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Color (Chroma) NR"
          value={params.noiseChroma}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('noiseChroma', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>

      {/* Analog & Glow Effects */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Glow, Halation & Film Artifacts</h3>
        <StudioSlider
          label="Bloom / Glow"
          value={params.bloomAmount}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('bloomAmount', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        {params.bloomAmount > 0 && (
          <StudioSlider
            label="Bloom Radius"
            value={params.bloomRadius}
            min={2}
            max={30}
            defaultValue={10}
            unit="px"
            onChange={(v) => upd('bloomRadius', v)}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        )}
        <StudioSlider
          label="Film Halation"
          value={params.halation}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('halation', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Light Leak"
          value={params.lightLeak}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('lightLeak', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        {params.lightLeak > 0 && (
          <div className="grid grid-cols-3 gap-1">
            {([
              { id: 'amber-left', label: 'Amber' },
              { id: 'sunset-corner', label: 'Sunset' },
              { id: 'prism-edge', label: 'Prism' },
            ] as const).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => upd('lightLeakStyle', s.id)}
                className={`py-1 rounded text-[11px] border ${
                  params.lightLeakStyle === s.id
                    ? 'bg-amber-500 text-zinc-950 border-amber-500 font-medium'
                    : 'bg-[#181A20] text-zinc-300 border-white/10'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <StudioSlider
          label="Dust & Scratches"
          value={params.dustScratches}
          min={0}
          max={100}
          unit="%"
          onChange={(v) => upd('dustScratches', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>

      {/* Optics & Geometry */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Optics & Keystone</h3>
        <StudioSlider
          label="Chromatic Aberration"
          value={params.chromaticAberration}
          min={-100}
          max={100}
          onChange={(v) => upd('chromaticAberration', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Lens Distortion"
          value={params.lensDistortion}
          min={-100}
          max={100}
          onChange={(v) => upd('lensDistortion', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Perspective Horizontal"
          value={params.perspectiveX}
          min={-45}
          max={45}
          unit="°"
          onChange={(v) => upd('perspectiveX', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <StudioSlider
          label="Perspective Vertical"
          value={params.perspectiveY}
          min={-45}
          max={45}
          unit="°"
          onChange={(v) => upd('perspectiveY', v)}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      </section>
    </div>
  );
};
