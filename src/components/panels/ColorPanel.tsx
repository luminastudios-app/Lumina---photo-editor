import React, { useRef, useState } from 'react';
import { Pipette } from 'lucide-react';
import type { ColorWheelGrade, HslBandKey, HslParams, ToneExtendedParams } from '../../types/editor';
import { HSL_BANDS } from '../../engine/stackReducer';
import { StudioSlider } from '../StudioSlider';

interface ColorPanelProps {
  params: HslParams;
  toneExtended: ToneExtendedParams;
  splashPickActive?: boolean;
  replacePickActive?: boolean;
  onToggleSplashPick?: () => void;
  onToggleReplacePick?: () => void;
  onChange: (next: HslParams) => void;
  onChangeToneExtended: (next: ToneExtendedParams) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const BAND_META: Record<HslBandKey, { label: string; color: string }> = {
  red: { label: 'Red', color: '#EF4444' },
  orange: { label: 'Orange', color: '#F97316' },
  yellow: { label: 'Yellow', color: '#EAB308' },
  green: { label: 'Green', color: '#22C55E' },
  cyan: { label: 'Cyan', color: '#06B6D4' },
  blue: { label: 'Blue', color: '#3B82F6' },
  purple: { label: 'Purple', color: '#8B5CF6' },
  magenta: { label: 'Magenta', color: '#EC4899' },
};

const ColorGradingWheel: React.FC<{
  label: string;
  value: ColorWheelGrade;
  onChange: (next: ColorWheelGrade) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}> = ({ label, value, onChange, onDragStart, onDragEnd }) => {
  const wheelRef = useRef<SVGSVGElement | null>(null);
  const draggingRef = useRef(false);

  const handlePointer = (clientX: number, clientY: number) => {
    const svg = wheelRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const maxR = rect.width / 2 - 4;
    const dist = Math.min(maxR, Math.hypot(dx, dy));
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (deg < 0) deg += 360;
    onChange({
      ...value,
      hue: Math.round(deg),
      sat: Math.round((dist / Math.max(1, maxR)) * 100),
    });
  };

  const rad = (value.hue * Math.PI) / 180;
  const knobR = (value.sat / 100) * 30;
  const kx = 40 + Math.cos(rad) * knobR;
  const ky = 40 + Math.sin(rad) * knobR;

  return (
    <div className="flex flex-col items-center gap-1.5 p-2 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
      <div className="w-full flex items-center justify-between text-[10px]">
        <span className="font-medium text-zinc-300">{label}</span>
        {value.sat > 0 && (
          <button
            type="button"
            onClick={() => {
              onChange({ ...value, sat: 0, lum: 0 });
              onDragEnd();
            }}
            className="text-zinc-500 hover:text-zinc-200"
          >
            Reset
          </button>
        )}
      </div>
      <svg
        ref={wheelRef}
        viewBox="0 0 80 80"
        className="w-20 h-20 cursor-crosshair touch-none select-none"
        role="slider"
        aria-label={`${label} color wheel`}
        aria-valuetext={`Hue ${value.hue}°, Saturation ${value.sat}%`}
        tabIndex={0}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          draggingRef.current = true;
          onDragStart();
          handlePointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) handlePointer(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          if (draggingRef.current) {
            draggingRef.current = false;
            onDragEnd();
          }
        }}
      >
        <defs>
          <radialGradient id={`wg-${label}`}>
            <stop offset="0%" stopColor="#888888" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#888888" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="40" cy="40" r="35" fill="#181A20" stroke="rgba(255,255,255,0.14)" strokeWidth="1.5" />
        {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
          const a = (deg * Math.PI) / 180;
          return (
            <line
              key={deg}
              x1={40 + Math.cos(a) * 18}
              y1={40 + Math.sin(a) * 18}
              x2={40 + Math.cos(a) * 34}
              y2={40 + Math.sin(a) * 34}
              stroke={`hsl(${deg}, 80%, 55%)`}
              strokeWidth="4"
              strokeLinecap="round"
              opacity="0.65"
            />
          );
        })}
        <circle cx="40" cy="40" r="35" fill={`url(#wg-${label})`} />
        <circle cx="40" cy="40" r="2" fill="rgba(255,255,255,0.4)" />
        <circle
          cx={kx}
          cy={ky}
          r="5"
          fill={`hsl(${value.hue}, 85%, 56%)`}
          stroke="#FFFFFF"
          strokeWidth="1.5"
        />
      </svg>
      <input
        type="range"
        min={-50}
        max={50}
        value={value.lum}
        aria-label={`${label} wheel luminance`}
        onPointerDown={onDragStart}
        onPointerUp={onDragEnd}
        onChange={(e) => onChange({ ...value, lum: Number(e.target.value) })}
        className="studio-slider"
      />
    </div>
  );
};

export const ColorPanel: React.FC<ColorPanelProps> = ({
  params,
  toneExtended,
  splashPickActive = false,
  replacePickActive = false,
  onToggleSplashPick,
  onToggleReplacePick,
  onChange,
  onChangeToneExtended,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  const [activeBand, setActiveBand] = useState<HslBandKey>('red');
  const bandVal = params.bands[activeBand];
  const splash = toneExtended.colorSplash ?? {
    enabled: false,
    targetHue: 20,
    targetHex: '#EF4444',
    tolerance: 28,
  };
  const replace = toneExtended.replaceColor ?? {
    enabled: false,
    sourceHex: '#3B82F6',
    targetHex: '#EC489D',
    tolerance: 34,
    softness: 30,
  };

  const updateBand = (field: 'h' | 's' | 'l', val: number) => {
    onChange({
      ...params,
      bands: {
        ...params.bands,
        [activeBand]: { ...bandVal, [field]: val },
      },
    });
  };

  const updateSplit = (field: keyof HslParams['splitToning'], val: number) => {
    onChange({
      ...params,
      splitToning: { ...params.splitToning, [field]: val },
    });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Color & Grading</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      {/* 3-Way Color Grading Wheels */}
      <section className="space-y-2.5">
        <h3 className="text-[11px] font-medium text-zinc-500">Color Grading Wheels</h3>
        <div className="grid grid-cols-3 gap-1.5">
          <ColorGradingWheel
            label="Shadows"
            value={toneExtended.colorWheels.shadows}
            onChange={(next) =>
              onChangeToneExtended({
                ...toneExtended,
                colorWheels: { ...toneExtended.colorWheels, shadows: next },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <ColorGradingWheel
            label="Midtones"
            value={toneExtended.colorWheels.midtones}
            onChange={(next) =>
              onChangeToneExtended({
                ...toneExtended,
                colorWheels: { ...toneExtended.colorWheels, midtones: next },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <ColorGradingWheel
            label="Highlights"
            value={toneExtended.colorWheels.highlights}
            onChange={(next) =>
              onChangeToneExtended({
                ...toneExtended,
                colorWheels: { ...toneExtended.colorWheels, highlights: next },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>
      </section>

      {/* Colour Splash & Replace Colour */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-200">Colour Splash</h3>
              <p className="text-[10px] text-zinc-500">Keep one hue, B&amp;W everything else</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={splash.enabled}
              aria-label="Toggle colour splash"
              onClick={() =>
                onChangeToneExtended({
                  ...toneExtended,
                  colorSplash: { ...splash, enabled: !splash.enabled },
                })
              }
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                splash.enabled
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-[#181A20] text-zinc-300 border border-white/10'
              }`}
            >
              {splash.enabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full border border-white/25"
                style={{ backgroundColor: `hsl(${splash.targetHue}, 86%, 52%)` }}
              />
              <span className="text-[11px] text-zinc-400">Keep Hue {splash.targetHue}°</span>
            </div>
            {onToggleSplashPick && (
              <button
                type="button"
                aria-pressed={splashPickActive}
                onClick={onToggleSplashPick}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 border ${
                  splashPickActive
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-[#181A20] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                <Pipette className="w-3 h-3" />
                <span>{splashPickActive ? 'Tap Photo…' : 'Pick on Photo'}</span>
              </button>
            )}
          </div>

          <StudioSlider
            label="Splash Hue"
            value={splash.targetHue}
            min={0}
            max={360}
            unit="°"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                colorSplash: { ...splash, enabled: true, targetHue: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <StudioSlider
            label="Hue Range"
            value={splash.tolerance}
            min={5}
            max={90}
            defaultValue={28}
            unit="°"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                colorSplash: { ...splash, enabled: true, tolerance: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>

        <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className="text-[11px] font-semibold text-zinc-200">Replace Colour</h3>
              <p className="text-[10px] text-zinc-500">Tap a colour &amp; swap to another</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={replace.enabled}
              aria-label="Toggle replace colour"
              onClick={() =>
                onChangeToneExtended({
                  ...toneExtended,
                  replaceColor: { ...replace, enabled: !replace.enabled },
                })
              }
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors ${
                replace.enabled
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-[#181A20] text-zinc-300 border border-white/10'
              }`}
            >
              {replace.enabled ? 'On' : 'Off'}
            </button>
          </div>

          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span>From</span>
                <input
                  type="color"
                  aria-label="Source colour to replace"
                  value={replace.sourceHex}
                  onChange={(e) =>
                    onChangeToneExtended({
                      ...toneExtended,
                      replaceColor: { ...replace, enabled: true, sourceHex: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
              </label>
              <span className="text-zinc-500 text-xs">→</span>
              <label className="flex items-center gap-1 text-[11px] text-zinc-400">
                <span>To</span>
                <input
                  type="color"
                  aria-label="Target replacement colour"
                  value={replace.targetHex}
                  onChange={(e) =>
                    onChangeToneExtended({
                      ...toneExtended,
                      replaceColor: { ...replace, enabled: true, targetHex: e.target.value },
                    })
                  }
                  className="w-6 h-6 rounded bg-transparent cursor-pointer"
                />
              </label>
            </div>

            {onToggleReplacePick && (
              <button
                type="button"
                aria-pressed={replacePickActive}
                onClick={onToggleReplacePick}
                className={`px-2 py-1 rounded text-[11px] font-medium flex items-center gap-1 border ${
                  replacePickActive
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-[#181A20] text-zinc-300 border-white/10 hover:text-white'
                }`}
              >
                <Pipette className="w-3 h-3" />
                <span>{replacePickActive ? 'Tap Photo…' : 'Pick Source'}</span>
              </button>
            )}
          </div>

          <StudioSlider
            label="Replace Tolerance"
            value={replace.tolerance}
            min={5}
            max={100}
            defaultValue={34}
            unit="%"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                replaceColor: { ...replace, enabled: true, tolerance: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <StudioSlider
            label="Edge Softness"
            value={replace.softness}
            min={0}
            max={100}
            defaultValue={30}
            unit="%"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                replaceColor: { ...replace, enabled: true, softness: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>
      </section>

      {/* Global Hue & Selective Color */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Selective Colour & Hue Rotate</h3>
        <StudioSlider
          label="Global Hue Rotation"
          value={toneExtended.hueRotate}
          min={-180}
          max={180}
          unit="°"
          onChange={(v) => onChangeToneExtended({ ...toneExtended, hueRotate: v })}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
        <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-zinc-400">Target Hue</span>
            <span
              className="w-4 h-4 rounded-full border border-white/20"
              style={{ backgroundColor: `hsl(${toneExtended.selectiveColor.targetHue}, 82%, 52%)` }}
            />
          </div>
          <StudioSlider
            label="Target Hue"
            value={toneExtended.selectiveColor.targetHue}
            min={0}
            max={360}
            unit="°"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                selectiveColor: { ...toneExtended.selectiveColor, targetHue: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <StudioSlider
            label="Selective Hue Shift"
            value={toneExtended.selectiveColor.hueShift}
            min={-180}
            max={180}
            unit="°"
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                selectiveColor: { ...toneExtended.selectiveColor, hueShift: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
          <StudioSlider
            label="Selective Saturation"
            value={toneExtended.selectiveColor.satShift}
            min={-100}
            max={100}
            onChange={(v) =>
              onChangeToneExtended({
                ...toneExtended,
                selectiveColor: { ...toneExtended.selectiveColor, satShift: v },
              })
            }
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
          />
        </div>
      </section>

      {/* HSL Mixer */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-medium text-zinc-500">HSL Mixer</h3>
          <span className="text-[11px] text-zinc-300">{BAND_META[activeBand].label}</span>
        </div>

        <div className="grid grid-cols-8 gap-1.5" role="radiogroup" aria-label="HSL color band">
          {HSL_BANDS.map((band) => {
            const isSelected = activeBand === band;
            const bVal = params.bands[band];
            const isEdited = bVal.h !== 0 || bVal.s !== 0 || bVal.l !== 0;
            return (
              <button
                key={band}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${BAND_META[band].label} channel`}
                onClick={() => setActiveBand(band)}
                className={`relative h-7 rounded-md flex items-center justify-center border transition-all ${
                  isSelected
                    ? 'border-white scale-105 bg-white/10'
                    : 'border-white/10 bg-[#181A20] hover:border-white/25'
                }`}
              >
                <span
                  className="w-3.5 h-3.5 rounded-full"
                  style={{ backgroundColor: BAND_META[band].color }}
                />
                {isEdited && <span className="sr-only">modified</span>}
              </button>
            );
          })}
        </div>

        <StudioSlider label="Hue" value={bandVal.h} min={-45} max={45} unit="°" onChange={(v) => updateBand('h', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Saturation" value={bandVal.s} min={-100} max={100} onChange={(v) => updateBand('s', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Luminance" value={bandVal.l} min={-100} max={100} onChange={(v) => updateBand('l', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </section>

      {/* Split-Toning */}
      <section className="space-y-3 pt-3 border-t border-white/[0.06]">
        <h3 className="text-[11px] font-medium text-zinc-500">Split-Toning</h3>
        <StudioSlider label="Shadow Hue" value={params.splitToning.shadowHue} min={0} max={360} defaultValue={215} unit="°" onChange={(v) => updateSplit('shadowHue', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Shadow Saturation" value={params.splitToning.shadowSat} min={0} max={100} onChange={(v) => updateSplit('shadowSat', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Highlight Hue" value={params.splitToning.highlightHue} min={0} max={360} defaultValue={40} unit="°" onChange={(v) => updateSplit('highlightHue', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Highlight Saturation" value={params.splitToning.highlightSat} min={0} max={100} onChange={(v) => updateSplit('highlightSat', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
        <StudioSlider label="Balance" value={params.splitToning.balance} min={-100} max={100} onChange={(v) => updateSplit('balance', v)} onDragStart={onDragStart} onDragEnd={onDragEnd} />
      </section>
    </div>
  );
};
