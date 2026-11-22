import React, { useRef, useState } from 'react';
import { Film, Grid, ImagePlus, Link2, Trash2, Upload } from 'lucide-react';
import type { SavedProject } from '../types/editor';
import { PWAInstallButton } from './PwaControls';

interface ImportWelcomeProps {
  savedProjects: SavedProject[];
  autoSaveEnabled: boolean;
  hasSharedStackInUrl: boolean;
  onImportFile: (file: File) => void;
  onLoadProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  onOpenCollage: () => void;
  onOpenVideoStudio?: () => void;
  errorMsg: string | null;
}

function formatUpdatedAt(ts: number): string {
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(ts).toLocaleDateString();
}

export const ImportWelcome: React.FC<ImportWelcomeProps> = ({
  savedProjects,
  autoSaveEnabled,
  hasSharedStackInUrl,
  onImportFile,
  onLoadProject,
  onDeleteProject,
  onOpenCollage,
  onOpenVideoStudio,
  errorMsg,
}) => {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) onImportFile(file);
  };

  return (
    <div
      className="flex-1 flex flex-col items-center justify-start md:justify-center p-6 md:p-10 bg-[#07080A] overflow-y-auto studio-scroll"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
    >
      <div className="w-full max-w-3xl space-y-8 my-auto">
        <div className="text-center space-y-2.5">
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white text-balance">
            Darkroom precision in your browser
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Non-destructive layers, masks, 44+ presets, RAW decoding, and collages. Everything runs locally on your device.
          </p>
        </div>

        {hasSharedStackInUrl && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-2.5 text-xs text-amber-200">
            <Link2 className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Shared edit stack detected in URL! Import a photo below to automatically apply the shared edits.
            </span>
          </div>
        )}

        {/* Dropzone */}
        <div
          className={`rounded-2xl border-2 border-dashed p-8 md:p-10 text-center transition-colors ${
            dragOver
              ? 'border-amber-400 bg-amber-500/10'
              : 'border-white/15 bg-[#121419] hover:border-white/25'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,.cr2,.nef,.arw,.dng"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
            }}
          />

          <div className="w-12 h-12 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center mx-auto mb-4">
            <Upload className="w-5 h-5 text-amber-400" />
          </div>
          <p className="text-sm font-medium text-zinc-100">
            Drag and drop a photo here, or paste from clipboard
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Supports PNG, JPEG, WebP, HEIC & Camera RAW (.CR2, .NEF, .ARW, .DNG) ·{' '}
            {autoSaveEnabled ? 'Auto-saved to your browser' : 'Local-only editing'}
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="px-5 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-2 transition-colors"
            >
              <ImagePlus className="w-4 h-4" />
              <span>Choose Photo / RAW</span>
            </button>
            <button
              type="button"
              onClick={onOpenCollage}
              className="px-4 py-2.5 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
            >
              <Grid className="w-4 h-4 text-amber-400" />
              <span>Collage Studio</span>
            </button>
            {onOpenVideoStudio && (
              <button
                type="button"
                onClick={onOpenVideoStudio}
                className="px-4 py-2.5 rounded-lg bg-[#181A20] hover:bg-white/10 border border-white/10 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors"
              >
                <Film className="w-4 h-4 text-amber-400" />
                <span>Video Studio</span>
              </button>
            )}
            <PWAInstallButton />
          </div>

          {errorMsg && (
            <p className="mt-4 text-xs text-rose-400" role="alert">
              {errorMsg}
            </p>
          )}
        </div>

        {/* User's Own Saved Photos */}
        <section className="space-y-3" aria-label="Your saved photos">
          <div className="flex items-center justify-between text-xs text-zinc-400">
            <span className="font-medium text-zinc-300">Your Saved Photos</span>
            <span className="font-mono-num">
              {savedProjects.length} {savedProjects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          {savedProjects.length === 0 ? (
            <div className="rounded-xl border border-white/[0.08] bg-[#121419] p-6 text-center space-y-1.5">
              <p className="text-xs font-medium text-zinc-300">No saved photos yet</p>
              <p className="text-xs text-zinc-500">
                Import a photo above to begin editing. Your edits will automatically save here so you can pick up right where you left off.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {savedProjects.map((project) => (
                <div
                  key={project.id}
                  className="group relative rounded-xl overflow-hidden bg-[#14161B] border border-white/[0.08] hover:border-amber-500/60 transition-all"
                >
                  <button
                    type="button"
                    onClick={() => onLoadProject(project)}
                    aria-label={`Open saved photo ${project.name}`}
                    className="w-full text-left"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden bg-[#0B0C0F]">
                      <img
                        src={project.thumbnailDataUrl}
                        alt={project.name}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                      />
                    </div>
                    <div className="p-3 pr-10">
                      <div className="text-xs font-semibold text-zinc-100 truncate">
                        {project.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 font-mono-num">
                        {project.layers.length} {project.layers.length === 1 ? 'layer' : 'layers'} · {formatUpdatedAt(project.updatedAt)}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProject(project.id)}
                    aria-label={`Delete saved photo ${project.name}`}
                    title="Delete saved photo"
                    className="absolute bottom-2.5 right-2.5 p-1.5 rounded-md bg-black/50 text-zinc-400 hover:text-rose-400 hover:bg-black/80 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
