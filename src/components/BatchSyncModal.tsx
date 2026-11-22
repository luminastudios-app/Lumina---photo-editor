import React, { useRef, useState } from 'react';
import { Check, Copy, Download, Upload, X } from 'lucide-react';
import type { EditLayer, SavedProject } from '../types/editor';
import { fileOrBlobToDataUrl } from '../utils/storage';
import { exportSingleImage, triggerDownload } from '../engine/exportUtils';

interface BatchSyncModalProps {
  sourceLayers: EditLayer[];
  savedProjects: SavedProject[];
  onClose: () => void;
}

interface BatchTarget {
  id: string;
  name: string;
  src: string;
  selected: boolean;
}

export const BatchSyncModal: React.FC<BatchSyncModalProps> = ({
  sourceLayers,
  savedProjects,
  onClose,
}) => {
  const [targets, setTargets] = useState<BatchTarget[]>(() =>
    savedProjects.map((p) => ({
      id: p.id,
      name: p.name,
      src: p.sourceDataUrl,
      selected: false,
    })),
  );
  const [includeCrop, setIncludeCrop] = useState(false);
  const [pattern, setPattern] = useState('{name}-synced-{index}');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const portableLayers = sourceLayers.filter(
    (l) =>
      (includeCrop || l.type !== 'crop') &&
      l.type !== 'ai-eraser' &&
      l.type !== 'ai-upscale' &&
      l.type !== 'ai-outpaint',
  );

  const handleAddFiles = async (files: FileList) => {
    const added: BatchTarget[] = [];
    for (const f of Array.from(files)) {
      try {
        const src = await fileOrBlobToDataUrl(f);
        added.push({
          id: `bat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          name: f.name.replace(/\.[^.]+$/, '') || 'photo',
          src,
          selected: true,
        });
      } catch {
        // skip invalid file
      }
    }
    setTargets((prev) => [...added, ...prev]);
  };

  const selectedTargets = targets.filter((t) => t.selected);

  const handleRunBatchSync = async () => {
    if (selectedTargets.length === 0 || portableLayers.length === 0) return;
    setBusy(true);
    try {
      let i = 0;
      for (const item of selectedTargets) {
        setStatus(`Syncing & exporting ${item.name} (${i + 1}/${selectedTargets.length})…`);
        const res = await exportSingleImage(item.src, portableLayers, {
          format: 'image/jpeg',
          quality: 0.92,
          longEdge: 2048,
          filenamePattern: pattern,
          baseName: item.name,
          batchIndex: i,
        });
        triggerDownload(res.blob, res.filename);
        i++;
      }
      setStatus(`Synced ${portableLayers.length} layers onto ${selectedTargets.length} photos.`);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Batch sync failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="batch-sync-title"
    >
      <input
        ref={fileRef}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp,image/heic,.heic,.cr2,.nef,.arw,.dng"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleAddFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <div className="w-full max-w-lg rounded-xl bg-[#14161B] border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <div className="flex items-center gap-2">
            <Copy className="w-4 h-4 text-amber-400" />
            <h2 id="batch-sync-title" className="text-sm font-semibold text-white">
              Batch Sync Edits Across Photos
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close batch sync dialog"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto studio-scroll">
          <div className="flex items-center justify-between text-xs text-zinc-300">
            <span>Applying {portableLayers.length} edit layers from current photo</span>
            <label className="flex items-center gap-1.5 text-[11px] text-zinc-400 cursor-pointer">
              <input
                type="checkbox"
                checked={includeCrop}
                onChange={(e) => setIncludeCrop(e.target.checked)}
                className="accent-amber-500"
              />
              <span>Include Crop</span>
            </label>
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="flex-1 py-2 px-3 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-xs text-zinc-200 flex items-center justify-center gap-1.5"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Add Target Photos</span>
            </button>
            <button
              type="button"
              onClick={() =>
                setTargets((prev) => prev.map((t) => ({ ...t, selected: true })))
              }
              className="py-2 px-3 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-xs text-zinc-300"
            >
              Select All
            </button>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="batch-rename-pattern" className="text-[11px] text-zinc-400">
              Batch Rename Pattern ({'{name}'}, {'{index}'}, {'{w}'}, {'{h}'})
            </label>
            <input
              id="batch-rename-pattern"
              type="text"
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              className="w-full rounded-lg bg-[#0B0C0F] border border-white/10 px-2.5 py-1.5 text-xs text-zinc-100 font-mono-num"
            />
          </div>

          {targets.length === 0 ? (
            <div className="p-6 rounded-lg bg-[#0B0C0F] border border-white/[0.06] text-center text-xs text-zinc-500">
              Add photos above or save projects first to batch-sync your edit stack.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {targets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() =>
                    setTargets((prev) =>
                      prev.map((x) => (x.id === t.id ? { ...x, selected: !x.selected } : x)),
                    )
                  }
                  aria-pressed={t.selected}
                  className={`flex items-center gap-2 p-2 rounded-lg border text-left transition-colors ${
                    t.selected
                      ? 'border-amber-500 bg-amber-500/10 text-white'
                      : 'border-white/[0.08] bg-[#181A20] text-zinc-400'
                  }`}
                >
                  <img src={t.src} alt={t.name} className="w-9 h-9 rounded object-cover shrink-0" />
                  <span className="text-xs truncate flex-1">{t.name}</span>
                  {t.selected && <Check className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                </button>
              ))}
            </div>
          )}

          {status && (
            <div className="px-3 py-2 rounded-lg bg-[#0B0C0F] border border-white/10 text-xs text-zinc-200">
              {status}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-white/[0.08] bg-[#0F1115]">
          <button
            type="button"
            disabled={busy || selectedTargets.length === 0 || portableLayers.length === 0}
            onClick={handleRunBatchSync}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Sync & Export ({selectedTargets.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
};
