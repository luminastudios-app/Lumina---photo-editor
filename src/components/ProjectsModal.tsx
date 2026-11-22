import React, { useState } from 'react';
import { FolderOpen, Save, Trash2, X } from 'lucide-react';
import type { SavedProject } from '../types/editor';

interface ProjectsModalProps {
  projects: SavedProject[];
  currentName: string;
  hasActiveImage: boolean;
  autoSaveEnabled: boolean;
  onToggleAutoSave: (enabled: boolean) => void;
  onSaveCurrent: (name: string) => { ok: boolean; error?: string };
  onLoadProject: (project: SavedProject) => void;
  onDeleteProject: (id: string) => void;
  onClose: () => void;
}

export const ProjectsModal: React.FC<ProjectsModalProps> = ({
  projects,
  currentName,
  hasActiveImage,
  autoSaveEnabled,
  onToggleAutoSave,
  onSaveCurrent,
  onLoadProject,
  onDeleteProject,
  onClose,
}) => {
  const [nameInput, setNameInput] = useState(currentName || 'Untitled Edit');
  const [feedback, setFeedback] = useState<string | null>(null);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!hasActiveImage) return;
    const res = onSaveCurrent(nameInput.trim() || 'Untitled Edit');
    if (res.ok) {
      setFeedback('Saved to browser localStorage.');
    } else {
      setFeedback(res.error ?? 'Could not save project.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="projects-dialog-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#14161B] border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 id="projects-dialog-title" className="text-base font-semibold text-white">
            Saved Projects
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close projects dialog"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[75vh] overflow-y-auto studio-scroll">
          {/* Auto-Save Toggle */}
          <div className="flex items-center justify-between gap-3 pb-4 border-b border-white/[0.08]">
            <div>
              <div className="text-xs font-medium text-zinc-100">Auto-Save Edits</div>
              <div className="text-[11px] text-zinc-400">
                Automatically save changes to browser storage
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={autoSaveEnabled}
              aria-label="Toggle auto-save edits"
              onClick={() => onToggleAutoSave(!autoSaveEnabled)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                autoSaveEnabled
                  ? 'bg-amber-500 text-zinc-950'
                  : 'bg-[#181A20] text-zinc-400 border border-white/10'
              }`}
            >
              {autoSaveEnabled ? 'On' : 'Off'}
            </button>
          </div>

          {hasActiveImage && (
            <form onSubmit={handleSave} className="space-y-2">
              <label htmlFor="project-name-input" className="text-xs font-medium text-zinc-400">
                Project Name
              </label>
              <div className="flex gap-2">
                <input
                  id="project-name-input"
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 rounded-lg bg-[#0B0C0F] border border-white/10 px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
                <button
                  type="submit"
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Save</span>
                </button>
              </div>
              {feedback && (
                <p className="text-[11px] text-emerald-400">{feedback}</p>
              )}
            </form>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-zinc-400">
              <span>Your Saved Photos</span>
              <span className="font-mono-num">{projects.length} saved</span>
            </div>

            {projects.length === 0 ? (
              <div className="p-6 rounded-lg bg-[#0B0C0F] border border-white/[0.06] text-center text-xs text-zinc-500">
                No saved edits yet. Import a photo to start editing and it will appear here automatically.
              </div>
            ) : (
              <ul className="space-y-2">
                {projects.map((proj) => (
                  <li
                    key={proj.id}
                    className="flex items-center gap-3 p-2 rounded-lg bg-[#181A20] border border-white/[0.08]"
                  >
                    <img
                      src={proj.thumbnailDataUrl}
                      alt={proj.name}
                      className="w-12 h-12 rounded object-cover bg-[#0B0C0F] shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-zinc-100 truncate">
                        {proj.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 font-mono-num">
                        {proj.layers.length} {proj.layers.length === 1 ? 'layer' : 'layers'} · {new Date(proj.updatedAt).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onLoadProject(proj);
                          onClose();
                        }}
                        aria-label={`Load project ${proj.name}`}
                        className="px-2.5 py-1.5 rounded-md bg-white/10 hover:bg-amber-500 hover:text-zinc-950 text-xs font-medium text-zinc-100 flex items-center gap-1 transition-colors"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProject(proj.id)}
                        aria-label={`Delete project ${proj.name}`}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-rose-400 hover:bg-white/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
