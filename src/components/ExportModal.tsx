import React, { useState } from 'react';
import { Check, Download, Layers, Link2, Printer, X } from 'lucide-react';
import type { EditLayer } from '../types/editor';
import {
  encodeStackToUrlHash,
  exportCanvasToPdfBlob,
  exportSingleImage,
  INSTAGRAM_EXPORT_PRESETS,
  triggerDownload,
  type ExportColorProfile,
  type ExportFormat,
} from '../engine/exportUtils';
import { renderEditStack } from '../engine/pipeline';

interface ExportModalProps {
  sourceSrc: string;
  projectName: string;
  layers: EditLayer[];
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  sourceSrc,
  projectName,
  layers,
  onClose,
}) => {
  const [format, setFormat] = useState<ExportFormat>('image/jpeg');
  const [quality, setQuality] = useState(92);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [longEdge, setLongEdge] = useState(2048);
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const [colorProfile, setColorProfile] = useState<ExportColorProfile>('srgb');
  const [exifMode, setExifMode] = useState<'strip' | 'preserve'>('strip');
  const [watermarkEnabled, setWatermarkEnabled] = useState(false);
  const [watermarkText, setWatermarkText] = useState('© Lumina Studio');
  const [watermarkOpacity, setWatermarkOpacity] = useState(65);
  const [watermarkPos, setWatermarkPos] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'center'>('bottom-right');
  const [filenamePattern, setFilenamePattern] = useState('{name}-{preset}');
  const [pdfPageSize, setPdfPageSize] = useState<'a4' | 'letter'>('a4');
  const [batchSelected, setBatchSelected] = useState<string[]>(['ig-square', 'ig-portrait']);
  const [busy, setBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  const toggleBatch = (id: string) => {
    setBatchSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const wmOptions = {
    enabled: watermarkEnabled,
    text: watermarkText,
    opacity: watermarkOpacity / 100,
    position: watermarkPos,
  };

  const handleExportSingle = async () => {
    setBusy(true);
    setStatusMessage('Rendering full-resolution export…');
    try {
      const preset = INSTAGRAM_EXPORT_PRESETS.find((p) => p.id === selectedPresetId) ?? null;
      const res = await exportSingleImage(sourceSrc, layers, {
        format,
        quality: quality / 100,
        longEdge: preset ? undefined : longEdge,
        exactPreset: preset,
        fitMode,
        colorProfile,
        exifMode,
        watermark: wmOptions,
        filenamePattern,
        baseName: projectName || 'lumina',
      });
      triggerDownload(res.blob, res.filename);
      setStatusMessage(`Exported ${res.filename} (${res.width}×${res.height})`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBatchExport = async () => {
    if (batchSelected.length === 0) return;
    setBusy(true);
    try {
      let done = 0;
      for (const id of batchSelected) {
        const preset = INSTAGRAM_EXPORT_PRESETS.find((p) => p.id === id);
        if (!preset) continue;
        setStatusMessage(`Exporting ${preset.label} (${done + 1}/${batchSelected.length})…`);
        const res = await exportSingleImage(sourceSrc, layers, {
          format,
          quality: quality / 100,
          exactPreset: preset,
          fitMode,
          colorProfile,
          exifMode,
          watermark: wmOptions,
          filenamePattern,
          baseName: projectName || 'lumina',
          batchIndex: done,
        });
        triggerDownload(res.blob, res.filename);
        done++;
      }
      setStatusMessage(`Batch exported ${done} Instagram presets.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'Batch export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleExportPdf = async () => {
    setBusy(true);
    setStatusMessage('Generating Print PDF layout…');
    try {
      const { canvas } = await renderEditStack(sourceSrc, layers, { maxEdge: 2400 });
      const blob = await exportCanvasToPdfBlob(canvas, pdfPageSize);
      triggerDownload(blob, `${(projectName || 'lumina').replace(/[^a-zA-Z0-9_-]+/g, '-')}-${pdfPageSize}.pdf`);
      setStatusMessage(`Exported ${pdfPageSize.toUpperCase()} Print PDF.`);
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : 'PDF export failed');
    } finally {
      setBusy(false);
    }
  };

  const handleCopyShareLink = async () => {
    const hash = encodeStackToUrlHash(layers);
    const fullUrl = `${window.location.origin}${window.location.pathname}${hash}`;
    window.history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(fullUrl);
      setLinkCopied(true);
      setStatusMessage('Copied shareable edit stack URL to clipboard.');
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      setStatusMessage('Updated URL hash with shareable edit stack.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-dialog-title"
    >
      <div className="w-full max-w-xl rounded-xl bg-[#14161B] border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 id="export-dialog-title" className="text-base font-semibold text-white">
            Export, Print & Share
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close export dialog"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto studio-scroll">
          {/* Format */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Format</span>
            <div className="grid grid-cols-5 gap-1.5">
              {(
                [
                  { id: 'image/jpeg', label: 'JPEG' },
                  { id: 'image/png', label: 'PNG' },
                  { id: 'image/webp', label: 'WebP' },
                  { id: 'image/avif', label: 'AVIF' },
                  { id: 'image/tiff', label: 'TIFF' },
                ] as const
              ).map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id)}
                  className={`py-2 rounded-lg text-xs font-semibold border transition-colors ${
                    format === fmt.id
                      ? 'bg-amber-500 text-zinc-950 border-amber-500'
                      : 'bg-[#181A20] text-zinc-300 border-white/10 hover:bg-white/10'
                  }`}
                >
                  {fmt.label}
                </button>
              ))}
            </div>
          </div>

          {format !== 'image/png' && format !== 'image/tiff' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="export-quality" className="text-zinc-300 font-medium">
                  Quality
                </label>
                <span className="font-mono-num text-amber-400">{quality}%</span>
              </div>
              <input
                id="export-quality"
                type="range"
                min={30}
                max={100}
                value={quality}
                onChange={(e) => setQuality(Number(e.target.value))}
                className="studio-slider"
              />
            </div>
          )}

          {/* Color Profile & EXIF */}
          <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-[#0B0C0F] border border-white/[0.06]">
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400">Color Space</span>
              <div className="grid grid-cols-2 gap-1">
                {(['srgb', 'display-p3'] as const).map((cp) => (
                  <button
                    key={cp}
                    type="button"
                    onClick={() => setColorProfile(cp)}
                    className={`py-1 rounded text-[11px] border ${
                      colorProfile === cp
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                        : 'bg-[#181A20] text-zinc-300 border-white/10'
                    }`}
                  >
                    {cp === 'srgb' ? 'sRGB' : 'Display P3'}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-zinc-400">EXIF Metadata</span>
              <div className="grid grid-cols-2 gap-1">
                {(['strip', 'preserve'] as const).map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => setExifMode(em)}
                    className={`py-1 rounded text-[11px] capitalize border ${
                      exifMode === em
                        ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                        : 'bg-[#181A20] text-zinc-300 border-white/10'
                    }`}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Instagram & Size Presets */}
          <div className="space-y-2">
            <span className="text-xs font-medium text-zinc-400">Instagram & Size Presets</span>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedPresetId('custom')}
                className={`p-2.5 rounded-lg border text-left transition-colors ${
                  selectedPresetId === 'custom'
                    ? 'border-amber-500 bg-amber-500/10'
                    : 'border-white/10 bg-[#181A20] hover:border-white/20'
                }`}
              >
                <div className="text-xs font-semibold text-zinc-100">Original Aspect</div>
                <div className="text-[11px] text-zinc-400 font-mono-num">Custom long edge</div>
              </button>
              {INSTAGRAM_EXPORT_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPresetId(p.id)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    selectedPresetId === p.id
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-white/10 bg-[#181A20] hover:border-white/20'
                  }`}
                >
                  <div className="text-xs font-semibold text-zinc-100">{p.label}</div>
                  <div className="text-[11px] text-zinc-400 font-mono-num">{p.subtitle}</div>
                </button>
              ))}
            </div>
          </div>

          {selectedPresetId === 'custom' ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label htmlFor="export-long-edge" className="text-zinc-300 font-medium">
                  Long Edge Resolution
                </label>
                <span className="font-mono-num text-amber-400">{longEdge} px</span>
              </div>
              <input
                id="export-long-edge"
                type="range"
                min={640}
                max={4096}
                step={64}
                value={longEdge}
                onChange={(e) => setLongEdge(Number(e.target.value))}
                className="studio-slider"
              />
            </div>
          ) : (
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300">Preset Framing</span>
              <div className="flex gap-1 p-0.5 rounded-md bg-[#0B0C0F] border border-white/10">
                <button
                  type="button"
                  onClick={() => setFitMode('cover')}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    fitMode === 'cover' ? 'bg-white/15 text-white' : 'text-zinc-400'
                  }`}
                >
                  Fill (Cover)
                </button>
                <button
                  type="button"
                  onClick={() => setFitMode('contain')}
                  className={`px-2.5 py-1 rounded text-[11px] ${
                    fitMode === 'contain' ? 'bg-white/15 text-white' : 'text-zinc-400'
                  }`}
                >
                  Fit (Letterbox)
                </button>
              </div>
            </div>
          )}

          {/* Watermark Overlay */}
          <div className="p-3 rounded-lg bg-[#0B0C0F] border border-white/[0.06] space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300">Watermark Overlay</span>
              <button
                type="button"
                role="switch"
                aria-checked={watermarkEnabled}
                aria-label="Toggle watermark overlay"
                onClick={() => setWatermarkEnabled((v) => !v)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                  watermarkEnabled
                    ? 'bg-amber-500 text-zinc-950'
                    : 'bg-[#181A20] text-zinc-400 border border-white/10'
                }`}
              >
                {watermarkEnabled ? 'Enabled' : 'Off'}
              </button>
            </div>
            {watermarkEnabled && (
              <div className="space-y-2">
                <input
                  type="text"
                  value={watermarkText}
                  onChange={(e) => setWatermarkText(e.target.value)}
                  aria-label="Watermark text"
                  className="w-full rounded bg-[#181A20] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100"
                />
                <div className="flex items-center gap-2 text-[11px]">
                  <span className="text-zinc-400 shrink-0">Opacity {watermarkOpacity}%</span>
                  <input
                    type="range"
                    min={10}
                    max={100}
                    value={watermarkOpacity}
                    onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                    className="studio-slider flex-1"
                  />
                  <select
                    value={watermarkPos}
                    aria-label="Watermark position"
                    onChange={(e) =>
                      setWatermarkPos(
                        e.target.value as 'bottom-right' | 'bottom-left' | 'top-right' | 'center',
                      )
                    }
                    className="rounded bg-[#181A20] border border-white/10 px-2 py-1 text-[11px] text-zinc-200"
                  >
                    <option value="bottom-right">Bottom Right</option>
                    <option value="bottom-left">Bottom Left</option>
                    <option value="top-right">Top Right</option>
                    <option value="center">Center</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Filename Pattern & Batch Presets */}
          <div className="pt-3 border-t border-white/[0.08] space-y-2.5">
            <div className="space-y-1">
              <label htmlFor="export-filename-pattern" className="text-[11px] text-zinc-400">
                Filename Pattern ({'{name}'}, {'{preset}'}, {'{index}'}, {'{w}'}, {'{h}'})
              </label>
              <input
                id="export-filename-pattern"
                type="text"
                value={filenamePattern}
                onChange={(e) => setFilenamePattern(e.target.value)}
                className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100 font-mono-num"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Batch Export Presets</span>
              </span>
              <span className="text-[11px] text-zinc-500 font-mono-num">
                {batchSelected.length} selected
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {INSTAGRAM_EXPORT_PRESETS.map((p) => {
                const checked = batchSelected.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => toggleBatch(p.id)}
                    aria-pressed={checked}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-md border text-xs transition-colors ${
                      checked
                        ? 'border-amber-500/60 bg-amber-500/10 text-zinc-100'
                        : 'border-white/[0.06] bg-[#181A20] text-zinc-400'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border ${
                        checked
                          ? 'bg-amber-500 border-amber-500 text-zinc-950'
                          : 'border-white/20'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                    <span className="truncate">{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Print PDF & Share URL */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.08]">
            <div className="flex items-center gap-1.5">
              <select
                value={pdfPageSize}
                aria-label="PDF print paper size"
                onChange={(e) => setPdfPageSize(e.target.value as 'a4' | 'letter')}
                className="rounded-lg bg-[#181A20] border border-white/10 px-2 py-2 text-xs text-zinc-200"
              >
                <option value="a4">A4 PDF</option>
                <option value="letter">Letter PDF</option>
              </select>
              <button
                type="button"
                disabled={busy}
                onClick={handleExportPdf}
                className="flex-1 py-2 px-2.5 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-xs text-zinc-200 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5 text-amber-400" />
                <span>Print PDF</span>
              </button>
            </div>
            <button
              type="button"
              onClick={handleCopyShareLink}
              className="py-2 px-3 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-xs text-zinc-200 flex items-center justify-center gap-1.5"
            >
              {linkCopied ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Link2 className="w-3.5 h-3.5 text-amber-400" />
              )}
              <span>{linkCopied ? 'Link Copied' : 'Share Edit URL'}</span>
            </button>
          </div>

          {statusMessage && (
            <div className="px-3 py-2 rounded-lg bg-[#0B0C0F] border border-white/10 text-xs text-zinc-200">
              {statusMessage}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.08] bg-[#0F1115]">
          <button
            type="button"
            disabled={busy || batchSelected.length === 0}
            onClick={handleBatchExport}
            className="px-3.5 py-2 rounded-lg text-xs font-medium bg-[#1C1F26] hover:bg-white/10 disabled:opacity-40 text-zinc-100 border border-white/10"
          >
            Batch Export ({batchSelected.length})
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={handleExportSingle}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Image</span>
          </button>
        </div>
      </div>
    </div>
  );
};
