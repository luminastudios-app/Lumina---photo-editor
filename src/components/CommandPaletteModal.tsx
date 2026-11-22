import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Command, Search, X } from 'lucide-react';

export interface CommandPaletteAction {
  id: string;
  label: string;
  category: string;
  shortcut?: string;
  run: () => void;
}

interface CommandPaletteModalProps {
  actions: CommandPaletteAction[];
  onClose: () => void;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({ actions, onClose }) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return actions;
    return actions.filter(
      (a) =>
        a.label.toLowerCase().includes(q) ||
        a.category.toLowerCase().includes(q) ||
        (a.shortcut ?? '').toLowerCase().includes(q),
    );
  }, [actions, query]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(Math.max(0, filtered.length - 1), i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && filtered[selectedIdx]) {
      e.preventDefault();
      filtered[selectedIdx].run();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center pt-[12vh] p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-xl bg-[#14161B] border border-white/15 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.08]">
          <Search className="w-4 h-4 text-amber-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, tool, AI effect, or layout…"
            aria-label="Search commands"
            className="flex-1 bg-transparent text-sm text-white placeholder:text-zinc-500 focus:outline-none"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto studio-scroll p-2 space-y-1">
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching commands found.
            </div>
          ) : (
            filtered.map((act, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={act.id}
                  type="button"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => {
                    act.run();
                    onClose();
                  }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                    active
                      ? 'bg-amber-500/20 text-white border border-amber-500/40'
                      : 'text-zinc-300 hover:bg-white/[0.06] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Command className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{act.label}</div>
                      <div className="text-[10px] text-zinc-500">{act.category}</div>
                    </div>
                  </div>
                  {act.shortcut && (
                    <kbd className="px-1.5 py-0.5 rounded bg-[#0B0C0F] border border-white/10 text-[10px] font-mono-num text-amber-300 shrink-0">
                      {act.shortcut}
                    </kbd>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
