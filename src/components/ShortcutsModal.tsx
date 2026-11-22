import React, { useEffect, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import type { ShortcutActionId, ShortcutMap } from '../types/editor';
import { DEFAULT_SHORTCUTS } from '../utils/workspaceStorage';

interface ShortcutsModalProps {
  shortcuts: ShortcutMap;
  onChangeShortcuts: (next: ShortcutMap) => void;
  onClose: () => void;
}

const ACTION_LABELS: Array<{ id: ShortcutActionId; desc: string }> = [
  { id: 'undo', desc: 'Undo last edit step' },
  { id: 'redo', desc: 'Redo edit step' },
  { id: 'save', desc: 'Save project to localStorage' },
  { id: 'compare', desc: 'Hold Before / After original preview' },
  { id: 'commandPalette', desc: 'Open Command Palette' },
  { id: 'toggleTheme', desc: 'Toggle Dark / Light theme' },
  { id: 'export', desc: 'Open Export dialog' },
];

function formatCombo(combo: string): string {
  return combo
    .split('+')
    .map((p) => {
      if (p === 'mod') return 'Ctrl / Cmd';
      if (p === 'shift') return 'Shift';
      if (p === 'alt') return 'Alt';
      return p.toUpperCase();
    })
    .join(' + ');
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  shortcuts,
  onChangeShortcuts,
  onClose,
}) => {
  const [capturing, setCapturing] = useState<ShortcutActionId | null>(null);

  useEffect(() => {
    if (!capturing) return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (['Control', 'Meta', 'Shift', 'Alt'].includes(e.key)) return;
      if (e.key === 'Escape') {
        setCapturing(null);
        return;
      }
      const parts: string[] = [];
      if (e.metaKey || e.ctrlKey) parts.push('mod');
      if (e.shiftKey) parts.push('shift');
      if (e.altKey) parts.push('alt');
      parts.push(e.key.toLowerCase());
      onChangeShortcuts({ ...shortcuts, [capturing]: parts.join('+') });
      setCapturing(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capturing, onChangeShortcuts, shortcuts]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="w-full max-w-md rounded-xl bg-[#14161B] border border-white/10 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.08]">
          <h2 id="shortcuts-title" className="text-sm font-semibold text-white">
            Remappable Keyboard Shortcuts
          </h2>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChangeShortcuts(DEFAULT_SHORTCUTS)}
              title="Reset shortcuts to defaults"
              className="px-2 py-1 rounded text-[11px] text-zinc-400 hover:text-white hover:bg-white/10 flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close shortcuts"
              className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <ul className="p-4 space-y-2">
          {ACTION_LABELS.map((item) => {
            const isCap = capturing === item.id;
            return (
              <li
                key={item.id}
                className="flex items-center justify-between gap-4 text-xs py-1"
              >
                <span className="text-zinc-300">{item.desc}</span>
                <button
                  type="button"
                  onClick={() => setCapturing(isCap ? null : item.id)}
                  aria-label={`Remap ${item.desc}`}
                  className={`px-2.5 py-1 rounded border font-mono-num text-[11px] whitespace-nowrap transition-colors ${
                    isCap
                      ? 'bg-amber-500 text-zinc-950 border-amber-500 font-semibold'
                      : 'bg-[#0B0C0F] border-white/10 text-amber-300 hover:border-amber-500/60'
                  }`}
                >
                  {isCap ? 'Press key combo…' : formatCombo(shortcuts[item.id])}
                </button>
              </li>
            );
          })}
          <li className="flex items-center justify-between gap-4 text-xs pt-2 border-t border-white/[0.06]">
            <span className="text-zinc-400">Switch tools</span>
            <kbd className="px-2 py-1 rounded bg-[#0B0C0F] border border-white/10 font-mono-num text-[11px] text-zinc-400">
              1 – 9
            </kbd>
          </li>
          <li className="flex items-center justify-between gap-4 text-xs">
            <span className="text-zinc-400">Paste image from clipboard</span>
            <kbd className="px-2 py-1 rounded bg-[#0B0C0F] border border-white/10 font-mono-num text-[11px] text-zinc-400">
              Ctrl / Cmd + V
            </kbd>
          </li>
        </ul>
      </div>
    </div>
  );
};
