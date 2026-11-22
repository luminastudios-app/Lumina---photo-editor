import React, { useMemo, useRef, useState } from 'react';
import type { CurveChannel, CurvePoint, CurvesParams } from '../../types/editor';
import { buildCurveLUT } from '../../engine/curves';

interface CurvesPanelProps {
  params: CurvesParams;
  onChange: (next: CurvesParams) => void;
  onReset: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}

const CHANNEL_TABS: Array<{ id: CurveChannel; label: string; stroke: string }> = [
  { id: 'rgb', label: 'RGB', stroke: '#F8FAFC' },
  { id: 'r', label: 'Red', stroke: '#EF4444' },
  { id: 'g', label: 'Green', stroke: '#22C55E' },
  { id: 'b', label: 'Blue', stroke: '#3B82F6' },
];

export const CurvesPanel: React.FC<CurvesPanelProps> = ({
  params,
  onChange,
  onReset,
  onDragStart,
  onDragEnd,
}) => {
  const [channel, setChannel] = useState<CurveChannel>('rgb');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const points = params[channel];
  const size = 220;

  const curvePath = useMemo(() => {
    const lut = buildCurveLUT(points);
    const cmds: string[] = [];
    for (let x = 0; x < 256; x += 4) {
      const sx = (x / 255) * size;
      const sy = size - (lut[x] / 255) * size;
      cmds.push(`${x === 0 ? 'M' : 'L'} ${sx.toFixed(1)} ${sy.toFixed(1)}`);
    }
    const endY = size - (lut[255] / 255) * size;
    cmds.push(`L ${size} ${endY.toFixed(1)}`);
    return cmds.join(' ');
  }, [points]);

  const toCurveCoords = (clientX: number, clientY: number): CurvePoint => {
    const rect = svgRef.current!.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
    return { x: Math.round(nx * 255), y: Math.round(ny * 255) };
  };

  const handleSvgPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const pt = toCurveCoords(e.clientX, e.clientY);

    // Check if near an existing point
    const hitIdx = points.findIndex(
      (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 18,
    );

    onDragStart();
    if (hitIdx !== -1) {
      setDragIdx(hitIdx);
      svgRef.current.setPointerCapture(e.pointerId);
      return;
    }

    // Add new point and sort
    const nextPts = [...points, pt].sort((a, b) => a.x - b.x);
    const newIdx = nextPts.findIndex((p) => p.x === pt.x && p.y === pt.y);
    onChange({ ...params, [channel]: nextPts });
    setDragIdx(newIdx);
    svgRef.current.setPointerCapture(e.pointerId);
  };

  const handleSvgPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx === null || !svgRef.current) return;
    const pt = toCurveCoords(e.clientX, e.clientY);
    const sorted = [...points];
    const isFirst = dragIdx === 0;
    const isLast = dragIdx === sorted.length - 1;

    const minX = isFirst ? 0 : sorted[dragIdx - 1].x + 2;
    const maxX = isLast ? 255 : sorted[dragIdx + 1].x - 2;
    sorted[dragIdx] = {
      x: isFirst ? Math.min(200, pt.x) : isLast ? Math.max(55, pt.x) : Math.max(minX, Math.min(maxX, pt.x)),
      y: pt.y,
    };
    onChange({ ...params, [channel]: sorted });
  };

  const handleSvgPointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragIdx !== null) {
      setDragIdx(null);
      svgRef.current?.releasePointerCapture(e.pointerId);
      onDragEnd();
    }
  };

  const removePoint = (idx: number) => {
    if (points.length <= 2) return;
    const next = points.filter((_, i) => i !== idx);
    onChange({ ...params, [channel]: next });
    onDragEnd();
  };

  const applyCurvePreset = (pts: CurvePoint[]) => {
    onChange({ ...params, [channel]: pts });
    onDragEnd();
  };

  const activeColor = CHANNEL_TABS.find((t) => t.id === channel)?.stroke ?? '#F8FAFC';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold text-zinc-200 tracking-wide">Tone Curves</h2>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          Reset
        </button>
      </div>

      <div className="grid grid-cols-4 gap-1 p-1 rounded-lg bg-[#0B0C0F] border border-white/[0.06]" role="tablist" aria-label="Curve channel">
        {CHANNEL_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={channel === t.id}
            onClick={() => setChannel(t.id)}
            className={`py-1.5 text-[11px] font-medium rounded-md transition-colors ${
              channel === t.id
                ? 'bg-[#1C1F26] text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="relative rounded-lg bg-[#0B0C0F] border border-white/[0.08] p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${size} ${size}`}
          className="w-full aspect-square touch-none cursor-crosshair select-none"
          onPointerDown={handleSvgPointerDown}
          onPointerMove={handleSvgPointerMove}
          onPointerUp={handleSvgPointerUp}
          aria-label={`${channel.toUpperCase()} tone curve graph`}
        >
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <React.Fragment key={f}>
              <line x1={f * size} y1={0} x2={f * size} y2={size} stroke="rgba(255,255,255,0.06)" />
              <line x1={0} y1={f * size} x2={size} y2={f * size} stroke="rgba(255,255,255,0.06)" />
            </React.Fragment>
          ))}
          <line x1={0} y1={size} x2={size} y2={0} stroke="rgba(255,255,255,0.12)" strokeDasharray="4 4" />

          <path
            d={curvePath}
            fill="none"
            stroke={activeColor}
            strokeWidth="2"
          />

          {points.map((pt, idx) => {
            const cx = (pt.x / 255) * size;
            const cy = size - (pt.y / 255) * size;
            return (
              <circle
                key={`${idx}-${pt.x}`}
                cx={cx}
                cy={cy}
                r={5.5}
                fill="#0B0C0F"
                stroke={activeColor}
                strokeWidth="2"
                className="cursor-grab active:cursor-grabbing"
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  removePoint(idx);
                }}
              />
            );
          })}
        </svg>
        <p className="mt-1.5 text-[10px] text-zinc-500">
          Click curve to add point · Drag to adjust · Double-click point to remove
        </p>
      </div>

      <div className="space-y-1.5">
        <span className="text-[11px] font-medium text-zinc-500">Quick Curves</span>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => applyCurvePreset([{ x: 0, y: 0 }, { x: 255, y: 255 }])}
            className="px-2.5 py-1.5 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-300 border border-white/[0.06]"
          >
            Linear
          </button>
          <button
            type="button"
            onClick={() =>
              applyCurvePreset([
                { x: 0, y: 0 },
                { x: 64, y: 48 },
                { x: 192, y: 210 },
                { x: 255, y: 255 },
              ])
            }
            className="px-2.5 py-1.5 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-300 border border-white/[0.06]"
          >
            S-Contrast
          </button>
          <button
            type="button"
            onClick={() =>
              applyCurvePreset([
                { x: 0, y: 26 },
                { x: 75, y: 78 },
                { x: 190, y: 198 },
                { x: 255, y: 245 },
              ])
            }
            className="px-2.5 py-1.5 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-300 border border-white/[0.06]"
          >
            Matte Fade
          </button>
          <button
            type="button"
            onClick={() =>
              applyCurvePreset([
                { x: 0, y: 0 },
                { x: 55, y: 36 },
                { x: 145, y: 162 },
                { x: 255, y: 255 },
              ])
            }
            className="px-2.5 py-1.5 rounded-md text-xs bg-[#181A20] hover:bg-white/10 text-zinc-300 border border-white/[0.06]"
          >
            Punchy
          </button>
        </div>
      </div>
    </div>
  );
};
