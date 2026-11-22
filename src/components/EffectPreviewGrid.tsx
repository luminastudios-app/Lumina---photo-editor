import React, { useEffect, useState } from 'react';
import {
  OVERLAY_EFFECT_CATALOG,
  OVERLAY_EFFECT_CATEGORIES,
  generateEffectThumbnails,
  type OverlayEffectDefinition,
} from '../engine/overlayEffects';
import type { OverlayEffectCategory, OverlayEffectKind } from '../types/editor';

interface EffectPreviewGridProps {
  sourceSrc: string;
  activeKinds?: Set<OverlayEffectKind> | OverlayEffectKind[];
  onPickEffect: (kind: OverlayEffectKind) => void;
  disabled?: boolean;
  excludeKinds?: OverlayEffectKind[];
  /** 'grid' renders responsive 3-column grid (EffectsPanel / OverlayPanel); 'strip' renders horizontal scroll row (OverlayStudioOverlay bottom drawer) */
  layout?: 'grid' | 'strip';
  darkSurface?: boolean;
  ariaLabel?: string;
}

export const EffectPreviewGrid: React.FC<EffectPreviewGridProps> = ({
  sourceSrc,
  activeKinds,
  onPickEffect,
  disabled = false,
  excludeKinds = [],
  layout = 'grid',
  darkSurface = false,
  ariaLabel = 'Effects preview library',
}) => {
  const [category, setCategory] = useState<OverlayEffectCategory | 'all'>('blur');
  const [thumbs, setThumbs] = useState<Record<string, string>>({});

  const visibleCatalog = React.useMemo(() => {
    const excludeSet = new Set(excludeKinds);
    return OVERLAY_EFFECT_CATALOG.filter(
      (item) =>
        !excludeSet.has(item.kind) &&
        (category === 'all' || item.category === category),
    );
  }, [category, excludeKinds]);

  // Pre-generate thumbnails for currently visible category first, then lazily warm remaining items
  useEffect(() => {
    if (!sourceSrc) return;
    let cancelled = false;

    const run = async () => {
      try {
        await generateEffectThumbnails(sourceSrc, visibleCatalog, 84, (partial) => {
          if (!cancelled) setThumbs((prev) => ({ ...prev, ...partial }));
        });
        const full = await generateEffectThumbnails(sourceSrc, OVERLAY_EFFECT_CATALOG, 84, (partial) => {
          if (!cancelled) setThumbs((prev) => ({ ...prev, ...partial }));
        });
        if (!cancelled) setThumbs((prev) => ({ ...prev, ...full }));
      } catch {
        // fallback cleanly to original sourceSrc inside tile
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [sourceSrc, visibleCatalog]);

  const activeSet = React.useMemo(() => {
    if (!activeKinds) return new Set<OverlayEffectKind>();
    return activeKinds instanceof Set ? activeKinds : new Set(activeKinds);
  }, [activeKinds]);

  const visibleCategories = OVERLAY_EFFECT_CATEGORIES.filter((cat) =>
    cat.id === 'all'
      ? true
      : OVERLAY_EFFECT_CATALOG.some(
          (item) => item.category === cat.id && !excludeKinds.includes(item.kind),
        ),
  );

  return (
    <div className="space-y-2.5">
      {/* Category tabs */}
      <div
        className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5"
        role="tablist"
        aria-label="Effect categories"
      >
        {visibleCategories.map((cat) => {
          const isSelected = category === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              role="tab"
              aria-selected={isSelected}
              onClick={() => setCategory(cat.id)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium whitespace-nowrap shrink-0 border transition-colors ${
                isSelected
                  ? darkSurface
                    ? 'bg-white text-zinc-950 border-white font-semibold'
                    : 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                  : darkSurface
                  ? 'bg-white/[0.06] border-white/10 text-zinc-300 hover:bg-white/10'
                  : 'bg-[#181A20] border-white/[0.06] text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Live Preview Tile Grid matching IMG_4874_21132eb4.png */}
      <div
        aria-label={ariaLabel}
        className={
          layout === 'strip'
            ? 'flex items-center gap-2 overflow-x-auto no-scrollbar pb-1'
            : 'grid grid-cols-3 gap-2 max-h-72 overflow-y-auto studio-scroll pr-0.5'
        }
      >
        {visibleCatalog.map((fx: OverlayEffectDefinition) => {
          const applied = activeSet.has(fx.kind);
          const previewSrc = thumbs[fx.kind] || sourceSrc;
          return (
            <button
              key={fx.kind}
              type="button"
              data-testid="effect-preview-tile"
              data-effect-kind={fx.kind}
              disabled={disabled}
              onClick={() => onPickEffect(fx.kind)}
              title={`Add ${fx.label}`}
              className={`group relative overflow-hidden rounded-xl aspect-square bg-[#14161B] border transition-all text-left disabled:opacity-40 ${
                layout === 'strip' ? 'w-20 h-20 shrink-0' : 'w-full'
              } ${
                applied
                  ? 'border-amber-400 ring-2 ring-amber-400/70'
                  : 'border-white/15 hover:border-white/40 hover:scale-[1.02]'
              }`}
            >
              {previewSrc ? (
                <img
                  src={previewSrc}
                  alt={fx.label}
                  loading="lazy"
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 animate-pulse" />
              )}
              <div className="absolute inset-x-0 bottom-0 bg-black/62 backdrop-blur-[1px] py-1 px-1 flex items-center justify-center">
                <span className="effect-tile-label text-[10px] sm:text-[11px] font-semibold text-white leading-tight text-center truncate">
                  {fx.label}
                </span>
              </div>
              {applied && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 shadow"
                />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
