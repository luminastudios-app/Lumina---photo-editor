import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Download, Grid, ImagePlus, Move, Sparkles, X } from 'lucide-react';
import type { CollageCell, SavedProject } from '../types/editor';
import { fileOrBlobToDataUrl } from '../utils/storage';
import { loadImageCached } from '../engine/pipeline';
import { triggerDownload } from '../engine/exportUtils';

interface CollageModalProps {
  savedProjects: SavedProject[];
  currentPhotoSrc: string | null;
  onOpenInEditor: (dataUrl: string, name: string) => void;
  onClose: () => void;
}

type TemplateCount = 2 | 3 | 4 | 5 | 6 | 9;

function buildTemplateCells(count: TemplateCount, existingSrcs: Array<string | null> = []): CollageCell[] {
  const mk = (x: number, y: number, w: number, h: number, idx: number): CollageCell => ({
    id: `cell_${idx}`,
    src: existingSrcs[idx] ?? null,
    x,
    y,
    w,
    h,
    aspectRatio: 'auto',
    borderWidth: 10,
    offsetX: 0,
    offsetY: 0,
    scale: 1,
  });

  if (count === 2) {
    return [mk(0, 0, 0.5, 1, 0), mk(0.5, 0, 0.5, 1, 1)];
  }
  if (count === 3) {
    return [mk(0, 0, 0.5, 1, 0), mk(0.5, 0, 0.5, 0.5, 1), mk(0.5, 0.5, 0.5, 0.5, 2)];
  }
  if (count === 4) {
    return [
      mk(0, 0, 0.5, 0.5, 0),
      mk(0.5, 0, 0.5, 0.5, 1),
      mk(0, 0.5, 0.5, 0.5, 2),
      mk(0.5, 0.5, 0.5, 0.5, 3),
    ];
  }
  if (count === 5) {
    return [
      mk(0, 0, 0.5, 0.5, 0),
      mk(0.5, 0, 0.5, 0.5, 1),
      mk(0, 0.5, 1 / 3, 0.5, 2),
      mk(1 / 3, 0.5, 1 / 3, 0.5, 3),
      mk(2 / 3, 0.5, 1 / 3, 0.5, 4),
    ];
  }
  if (count === 6) {
    const out: CollageCell[] = [];
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 3; c++) {
        out.push(mk(c / 3, r / 2, 1 / 3, 0.5, r * 3 + c));
      }
    }
    return out;
  }
  // 9-grid
  const out: CollageCell[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(mk(c / 3, r / 3, 1 / 3, 1 / 3, r * 3 + c));
    }
  }
  return out;
}

export const CollageModal: React.FC<CollageModalProps> = ({
  savedProjects,
  currentPhotoSrc,
  onOpenInEditor,
  onClose,
}) => {
  const [templateCount, setTemplateCount] = useState<TemplateCount>(4);
  const [freeform, setFreeform] = useState(false);
  const [cells, setCells] = useState<CollageCell[]>(() =>
    buildTemplateCells(4, currentPhotoSrc ? [currentPhotoSrc] : []),
  );
  const [selectedCellId, setSelectedCellId] = useState<string>('cell_0');
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const [bgColor, setBgColor] = useState('#0F1115');
  const [globalGap, setGlobalGap] = useState(12);
  const [dragCell, setDragCell] = useState<{ id: string; startX: number; startY: number; origX: number; origY: number } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cellFileRef = useRef<HTMLInputElement | null>(null);
  const multiFileRef = useRef<HTMLInputElement | null>(null);

  const selectedCell = cells.find((c) => c.id === selectedCellId) ?? cells[0];

  const switchTemplate = (count: TemplateCount) => {
    setTemplateCount(count);
    const existingSrcs = cells.map((c) => c.src);
    setCells(buildTemplateCells(count, existingSrcs));
    setSelectedCellId('cell_0');
    setSwapSourceId(null);
  };

  // Render composite collage canvas
  useEffect(() => {
    let cancelled = false;
    const render = async () => {
      const size = 1080;
      const off = document.createElement('canvas');
      off.width = size;
      off.height = size;
      const ctx = off.getContext('2d')!;
      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, size, size);

      for (const cell of cells) {
        const pad = (cell.borderWidth ?? globalGap) * 1.1;
        let cx = cell.x * size + pad;
        let cy = cell.y * size + pad;
        let cw = Math.max(24, cell.w * size - pad * 2);
        let ch = Math.max(24, cell.h * size - pad * 2);

        if (cell.aspectRatio && cell.aspectRatio !== 'auto') {
          const [rw, rh] = cell.aspectRatio.split(':').map(Number);
          const targetAspect = rw / Math.max(1, rh);
          const curAspect = cw / Math.max(1, ch);
          if (curAspect > targetAspect) {
            const newW = ch * targetAspect;
            cx += (cw - newW) / 2;
            cw = newW;
          } else {
            const newH = cw / targetAspect;
            cy += (ch - newH) / 2;
            ch = newH;
          }
        }

        ctx.save();
        ctx.beginPath();
        ctx.roundRect(cx, cy, cw, ch, 12);
        ctx.clip();
        ctx.fillStyle = '#181A20';
        ctx.fillRect(cx, cy, cw, ch);

        if (cell.src) {
          try {
            const img = await loadImageCached(cell.src);
            const cover = Math.max(cw / img.naturalWidth, ch / img.naturalHeight) * (cell.scale || 1);
            const dw = img.naturalWidth * cover;
            const dh = img.naturalHeight * cover;
            const dx = cx + (cw - dw) / 2 + cell.offsetX * cw;
            const dy = cy + (ch - dh) / 2 + cell.offsetY * ch;
            ctx.drawImage(img, dx, dy, dw, dh);
          } catch {
            // ignore broken source
          }
        } else {
          ctx.strokeStyle = 'rgba(255,255,255,0.16)';
          ctx.lineWidth = 2;
          ctx.strokeRect(cx + 2, cy + 2, cw - 4, ch - 4);
          ctx.fillStyle = '#71717A';
          ctx.font = '600 22px "Plus Jakarta Sans", sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`+ Photo`, cx + cw / 2, cy + ch / 2);
        }
        ctx.restore();
      }

      if (cancelled) return;
      const target = canvasRef.current;
      if (target) {
        target.width = size;
        target.height = size;
        target.getContext('2d')?.drawImage(off, 0, 0);
      }
    };
    render();
    return () => {
      cancelled = true;
    };
  }, [bgColor, cells, globalGap]);

  const handleCellUpload = async (file: File) => {
    const url = await fileOrBlobToDataUrl(file);
    setCells((prev) =>
      prev.map((c) => (c.id === selectedCell.id ? { ...c, src: url } : c)),
    );
  };

  const handleMultiFill = async (files: FileList) => {
    const urls = await Promise.all(Array.from(files).slice(0, cells.length).map((f) => fileOrBlobToDataUrl(f)));
    setCells((prev) =>
      prev.map((c, idx) => (urls[idx] ? { ...c, src: urls[idx] } : c)),
    );
  };

  const handleSwapOrSelect = (cellId: string) => {
    if (swapSourceId && swapSourceId !== cellId) {
      setCells((prev) => {
        const a = prev.find((c) => c.id === swapSourceId);
        const b = prev.find((c) => c.id === cellId);
        if (!a || !b) return prev;
        return prev.map((c) => {
          if (c.id === a.id) return { ...c, src: b.src };
          if (c.id === b.id) return { ...c, src: a.src };
          return c;
        });
      });
      setSwapSourceId(null);
      setSelectedCellId(cellId);
      return;
    }
    setSelectedCellId(cellId);
  };

  const handleExportPng = () => {
    const c = canvasRef.current;
    if (!c) return;
    c.toBlob((blob) => {
      if (blob) triggerDownload(blob, `lumina-collage-${templateCount}.png`);
    }, 'image/png');
  };

  const handleSendToEditor = () => {
    const c = canvasRef.current;
    if (!c) return;
    onOpenInEditor(c.toDataURL('image/png'), `Collage (${templateCount} Photos)`);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="collage-dialog-title"
    >
      <input
        ref={cellFileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,.heic,.cr2,.nef,.arw,.dng"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleCellUpload(f);
          e.target.value = '';
        }}
      />
      <input
        ref={multiFileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/heic,.heic,.cr2,.nef,.arw,.dng"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleMultiFill(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="w-full max-w-5xl max-h-[92vh] rounded-2xl bg-[#14161B] border border-white/10 shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Grid className="w-4 h-4 text-amber-400" />
            <h2 id="collage-dialog-title" className="text-sm font-semibold text-white">
              Collage & Multi-Photo Layout Studio
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close collage studio"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px] overflow-hidden">
          {/* Interactive Collage Canvas */}
          <div className="p-4 md:p-6 bg-[#0B0C0F] flex items-center justify-center overflow-auto">
            <div className="relative w-full max-w-[520px] aspect-square rounded-lg overflow-hidden shadow-2xl border border-white/10">
              <canvas ref={canvasRef} className="w-full h-full block" />
              {/* Interactive Cell Overlays */}
              {cells.map((cell, idx) => {
                const isSelected = cell.id === selectedCell.id;
                const isSwap = cell.id === swapSourceId;
                return (
                  <div
                    key={cell.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`Collage cell ${idx + 1}`}
                    onClick={() => handleSwapOrSelect(cell.id)}
                    onPointerDown={(e) => {
                      if (!freeform) return;
                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                      setSelectedCellId(cell.id);
                      setDragCell({
                        id: cell.id,
                        startX: e.clientX,
                        startY: e.clientY,
                        origX: cell.x,
                        origY: cell.y,
                      });
                    }}
                    onPointerMove={(e) => {
                      if (!freeform || !dragCell || dragCell.id !== cell.id) return;
                      const parent = e.currentTarget.parentElement?.getBoundingClientRect();
                      if (!parent) return;
                      const dx = (e.clientX - dragCell.startX) / parent.width;
                      const dy = (e.clientY - dragCell.startY) / parent.height;
                      setCells((prev) =>
                        prev.map((c) =>
                          c.id === cell.id
                            ? {
                                ...c,
                                x: Math.max(0, Math.min(1 - c.w, dragCell.origX + dx)),
                                y: Math.max(0, Math.min(1 - c.h, dragCell.origY + dy)),
                              }
                            : c,
                        ),
                      );
                    }}
                    onPointerUp={() => setDragCell(null)}
                    style={{
                      left: `${cell.x * 100}%`,
                      top: `${cell.y * 100}%`,
                      width: `${cell.w * 100}%`,
                      height: `${cell.h * 100}%`,
                    }}
                    className={`absolute transition-shadow ${
                      freeform ? 'cursor-move' : 'cursor-pointer'
                    } ${
                      isSwap
                        ? 'ring-2 ring-inset ring-violet-400 bg-violet-500/10'
                        : isSelected
                          ? 'ring-2 ring-inset ring-amber-400'
                          : 'hover:ring-1 hover:ring-inset hover:ring-white/40'
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Right Collage Controls */}
          <div className="p-4 border-t md:border-t-0 md:border-l border-white/[0.08] overflow-y-auto studio-scroll space-y-4">
            {/* Grid Template Selector */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400">Grid Templates (Photos)</span>
              <div className="grid grid-cols-6 gap-1">
                {([2, 3, 4, 5, 6, 9] as TemplateCount[]).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => switchTemplate(cnt)}
                    aria-pressed={templateCount === cnt}
                    className={`py-1.5 rounded text-xs font-mono-num font-semibold border ${
                      templateCount === cnt
                        ? 'bg-amber-500 text-zinc-950 border-amber-500'
                        : 'bg-[#181A20] text-zinc-300 border-white/10'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>

            {/* Freeform Mode + Quick Multi-Fill */}
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => setFreeform((v) => !v)}
                aria-pressed={freeform}
                className={`py-1.5 px-2 rounded-md text-xs font-medium border flex items-center justify-center gap-1 ${
                  freeform
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-[#181A20] text-zinc-300 border-white/10'
                }`}
              >
                <Move className="w-3.5 h-3.5" />
                <span>{freeform ? 'Freeform On' : 'Freeform Drag'}</span>
              </button>
              <button
                type="button"
                onClick={() => multiFileRef.current?.click()}
                className="py-1.5 px-2 rounded-md text-xs font-medium bg-[#181A20] hover:bg-white/10 text-zinc-200 border border-white/10 flex items-center justify-center gap-1"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Fill Multi</span>
              </button>
            </div>

            {/* Global Canvas Background & Spacing */}
            <div className="p-2.5 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">Matte Background</span>
                <input
                  type="color"
                  aria-label="Collage background color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-7 h-7 rounded bg-transparent cursor-pointer"
                />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between text-[11px]">
                  <span className="text-zinc-400">Default Border Gap</span>
                  <span className="font-mono-num text-amber-400">{globalGap}px</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={28}
                  value={globalGap}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setGlobalGap(val);
                    setCells((prev) => prev.map((c) => ({ ...c, borderWidth: val })));
                  }}
                  className="studio-slider"
                />
              </div>
            </div>

            {/* Selected Cell Inspector */}
            {selectedCell && (
              <div className="p-3 rounded-lg bg-[#0B0C0F] border border-white/[0.08] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">
                    Selected Cell #{cells.findIndex((c) => c.id === selectedCell.id) + 1}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => cellFileRef.current?.click()}
                      className="px-2 py-1 rounded bg-amber-500 text-zinc-950 text-[11px] font-semibold"
                    >
                      {selectedCell.src ? 'Replace' : 'Upload'}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSwapSourceId((prev) =>
                          prev === selectedCell.id ? null : selectedCell.id,
                        )
                      }
                      aria-pressed={swapSourceId === selectedCell.id}
                      className={`px-2 py-1 rounded text-[11px] font-medium border flex items-center gap-1 ${
                        swapSourceId === selectedCell.id
                          ? 'bg-violet-500 text-white border-violet-500'
                          : 'bg-[#181A20] text-zinc-300 border-white/10'
                      }`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{swapSourceId === selectedCell.id ? 'Pick Target' : 'Swap'}</span>
                    </button>
                  </div>
                </div>

                {/* Per-Cell Aspect Ratio */}
                <div className="space-y-1">
                  <span className="text-[11px] text-zinc-400">Cell Aspect Ratio</span>
                  <div className="grid grid-cols-4 gap-1">
                    {(['auto', '1:1', '4:5', '16:9'] as const).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() =>
                          setCells((prev) =>
                            prev.map((c) =>
                              c.id === selectedCell.id ? { ...c, aspectRatio: ar } : c,
                            ),
                          )
                        }
                        className={`py-1 rounded text-[11px] border ${
                          (selectedCell.aspectRatio ?? 'auto') === ar
                            ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                            : 'bg-[#181A20] text-zinc-300 border-white/10'
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Per-Cell Border Width */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-zinc-400">Cell Border Width</span>
                    <span className="font-mono-num text-amber-400">{selectedCell.borderWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={30}
                    value={selectedCell.borderWidth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCells((prev) =>
                        prev.map((c) =>
                          c.id === selectedCell.id ? { ...c, borderWidth: val } : c,
                        ),
                      );
                    }}
                    className="studio-slider"
                  />
                </div>

                {freeform && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-[11px]">
                      <span className="text-zinc-400">Freeform Frame Size</span>
                      <span className="font-mono-num text-amber-400">
                        {Math.round(selectedCell.w * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={85}
                      value={Math.round(selectedCell.w * 100)}
                      onChange={(e) => {
                        const sz = Number(e.target.value) / 100;
                        setCells((prev) =>
                          prev.map((c) =>
                            c.id === selectedCell.id
                              ? { ...c, w: sz, h: sz, x: Math.min(c.x, 1 - sz), y: Math.min(c.y, 1 - sz) }
                              : c,
                          ),
                        );
                      }}
                      className="studio-slider"
                    />
                  </div>
                )}

                {savedProjects.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[11px] text-zinc-400">Or Use Saved Photo</span>
                    <div className="flex gap-1.5 overflow-x-auto pb-1">
                      {savedProjects.slice(0, 6).map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() =>
                            setCells((prev) =>
                              prev.map((c) =>
                                c.id === selectedCell.id ? { ...c, src: p.sourceDataUrl } : c,
                              ),
                            )
                          }
                          title={p.name}
                          className="w-10 h-10 rounded overflow-hidden border border-white/15 shrink-0 hover:border-amber-400"
                        >
                          <img src={p.thumbnailDataUrl} alt={p.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-white/[0.08] bg-[#0F1115]">
          <button
            type="button"
            onClick={handleExportPng}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#1C1F26] hover:bg-white/10 text-zinc-100 border border-white/10 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PNG</span>
          </button>
          <button
            type="button"
            onClick={handleSendToEditor}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 flex items-center gap-1.5"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Collage in Studio</span>
          </button>
        </div>
      </div>
    </div>
  );
};
