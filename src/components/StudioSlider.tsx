import React from 'react';
import { RotateCcw } from 'lucide-react';

interface StudioSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  defaultValue?: number;
  unit?: string;
  onChange: (value: number) => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  accentColor?: string;
}

export const StudioSlider: React.FC<StudioSliderProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  defaultValue = 0,
  unit = '',
  onChange,
  onDragStart,
  onDragEnd,
}) => {
  const isDirty = Math.abs(value - defaultValue) > 0.001;
  const id = React.useId();

  return (
    <div className="group flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <label htmlFor={id} className="text-zinc-300 font-medium select-none">
          {label}
        </label>
        <div className="flex items-center gap-1.5">
          <span
            className={`font-mono-num text-[11px] ${
              isDirty ? 'text-amber-400' : 'text-zinc-500'
            }`}
          >
            {value > 0 && min < 0 ? `+${value}` : value}
            {unit}
          </span>
          {isDirty && (
            <button
              type="button"
              onClick={() => {
                onChange(defaultValue);
                onDragEnd?.();
              }}
              aria-label={`Reset ${label}`}
              title={`Reset ${label}`}
              className="p-0.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-white/10 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onPointerDown={onDragStart}
        onPointerUp={onDragEnd}
        onTouchEnd={onDragEnd}
        onKeyUp={onDragEnd}
        onChange={(e) => onChange(Number(e.target.value))}
        className="studio-slider"
      />
    </div>
  );
};
