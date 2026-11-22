import React, { useState } from 'react';
import type { HistogramData } from '../types/editor';

interface HistogramViewProps {
  histogram: HistogramData | null;
  compact?: boolean;
}

function buildChannelPath(bins: number[], maxCount: number, width: number, height: number): string {
  if (!bins || bins.length === 0) return '';
  const step = 4;
  const points: string[] = [`M 0 ${height}`];
  const normMax = Math.max(1, maxCount);

  for (let i = 0; i < 256; i += step) {
    let acc = 0;
    for (let j = 0; j < step && i + j < 256; j++) {
      acc += bins[i + j];
    }
    const avg = acc / step;
    const x = (i / 252) * width;
    const y = height - Math.min(1, Math.pow(avg / normMax, 0.72)) * (height - 4);
    points.push(`L ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  points.push(`L ${width} ${height} Z`);
  return points.join(' ');
}

export const HistogramView: React.FC<HistogramViewProps> = ({ histogram, compact = false }) => {
  const [cbSafe, setCbSafe] = useState(false);
  const width = 240;
  const height = 64;

  const paths = React.useMemo(() => {
    if (!histogram) return null;
    return {
      luma: buildChannelPath(histogram.luma, histogram.maxCount, width, height),
      r: buildChannelPath(histogram.r, histogram.maxCount, width, height),
      g: buildChannelPath(histogram.g, histogram.maxCount, width, height),
      b: buildChannelPath(histogram.b, histogram.maxCount, width, height),
    };
  }, [histogram]);

  // Color-blind-safe Okabe-Ito palette vs classic RGB
  const colors = cbSafe
    ? {
        r: { fill: 'rgba(230, 159, 0, 0.30)', stroke: 'rgba(230, 159, 0, 0.85)' },
        g: { fill: 'rgba(86, 180, 233, 0.28)', stroke: 'rgba(86, 180, 233, 0.85)' },
        b: { fill: 'rgba(204, 121, 167, 0.28)', stroke: 'rgba(204, 121, 167, 0.85)' },
      }
    : {
        r: { fill: 'rgba(239, 68, 68, 0.28)', stroke: 'rgba(239, 68, 68, 0.65)' },
        g: { fill: 'rgba(34, 197, 94, 0.25)', stroke: 'rgba(34, 197, 94, 0.6)' },
        b: { fill: 'rgba(59, 130, 246, 0.28)', stroke: 'rgba(59, 130, 246, 0.65)' },
      };

  return (
    <div className={compact ? '' : 'px-3 py-2.5 border-b border-white/[0.08]'}>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-medium text-zinc-400">Histogram</span>
        <button
          type="button"
          onClick={() => setCbSafe((v) => !v)}
          aria-pressed={cbSafe}
          aria-label="Toggle color-blind safe histogram palette"
          className="text-[10px] font-mono-num text-zinc-400 hover:text-amber-300 transition-colors"
        >
          {cbSafe ? 'Okabe-Ito Safe' : 'RGB · Luma'}
        </button>
      </div>
      <div className="relative h-16 w-full rounded-md bg-[#0B0C0F] border border-white/[0.06] overflow-hidden">
        {paths ? (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="none"
            className="w-full h-full block"
            aria-label="RGB and luminance histogram"
          >
            <line x1="60" y1="0" x2="60" y2={height} stroke="rgba(255,255,255,0.05)" />
            <line x1="120" y1="0" x2="120" y2={height} stroke="rgba(255,255,255,0.05)" />
            <line x1="180" y1="0" x2="180" y2={height} stroke="rgba(255,255,255,0.05)" />
            <path d={paths.r} fill={colors.r.fill} stroke={colors.r.stroke} strokeWidth="1" />
            <path d={paths.g} fill={colors.g.fill} stroke={colors.g.stroke} strokeWidth="1" />
            <path d={paths.b} fill={colors.b.fill} stroke={colors.b.stroke} strokeWidth="1" />
            <path d={paths.luma} fill="rgba(248, 250, 252, 0.14)" stroke="rgba(248, 250, 252, 0.55)" strokeWidth="1" />
          </svg>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[11px] text-zinc-600">
            No image loaded
          </div>
        )}
      </div>
    </div>
  );
};
