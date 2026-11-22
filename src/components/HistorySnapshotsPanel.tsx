import React, { useState } from 'react';
import { Bookmark, Camera, ChevronDown, ChevronUp, History, Trash2 } from 'lucide-react';
import type { HistoryStepEntry, SnapshotCheckpoint } from '../types/editor';

interface HistorySnapshotsPanelProps {
  entries: HistoryStepEntry[];
  cursor: number;
  snapshots: SnapshotCheckpoint[];
  onJumpHistory: (index: number) => void;
  onCreateSnapshot: (name: string) => void;
  onLoadSnapshot: (snap: SnapshotCheckpoint) => void;
  onDeleteSnapshot: (id: string) => void;
  onSetCompareSnapshot: (snap: SnapshotCheckpoint) => void;
}

export const HistorySnapshotsPanel: React.FC<HistorySnapshotsPanelProps> = ({
  entries,
  cursor,
  snapshots,
  onJumpHistory,
  onCreateSnapshot,
  onLoadSnapshot,
  onDeleteSnapshot,
  onSetCompareSnapshot,
}) => {
  const [collapsed, setCollapsed] = useState(true);
  const [snapName, setSnapName] = useState('');

  return (
    <div className="flex flex-col border-t border-white/[0.08]">
      <div className="flex items-center justify-between px-3 py-2">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-expanded={!collapsed}
          className="flex items-center gap-1.5 text-xs font-medium text-zinc-300 hover:text-white"
        >
          <History className="w-3.5 h-3.5 text-zinc-400" />
          <span>History & Snapshots</span>
          <span className="font-mono-num text-[11px] text-zinc-500">
            ({entries.length}/{snapshots.length})
          </span>
          {collapsed ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-500" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-500" />
          )}
        </button>
      </div>

      {!collapsed && (
        <div className="px-2 pb-2.5 space-y-2.5">
          {/* Snapshot Checkpoints */}
          <div className="flex gap-1">
            <input
              type="text"
              value={snapName}
              onChange={(e) => setSnapName(e.target.value)}
              placeholder="Checkpoint name…"
              aria-label="Snapshot checkpoint name"
              className="flex-1 rounded bg-[#0B0C0F] border border-white/10 px-2 py-1 text-[11px] text-zinc-100"
            />
            <button
              type="button"
              onClick={() => {
                onCreateSnapshot(snapName.trim() || `Snapshot ${snapshots.length + 1}`);
                setSnapName('');
              }}
              aria-label="Create snapshot checkpoint"
              className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-zinc-950 text-[11px] font-medium flex items-center gap-1"
            >
              <Camera className="w-3 h-3" />
              <span>Save</span>
            </button>
          </div>

          {snapshots.length > 0 && (
            <div className="space-y-1">
              <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 px-1">
                Snapshots
              </span>
              {snapshots.map((sn) => (
                <div
                  key={sn.id}
                  className="flex items-center justify-between gap-1 px-2 py-1 rounded bg-[#181A20] border border-white/[0.06] text-[11px]"
                >
                  <button
                    type="button"
                    onClick={() => onLoadSnapshot(sn)}
                    className="flex items-center gap-1 text-zinc-200 hover:text-amber-300 truncate flex-1 text-left"
                  >
                    <Bookmark className="w-3 h-3 text-amber-400 shrink-0" />
                    <span className="truncate">{sn.name}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onSetCompareSnapshot(sn)}
                    className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10 text-[10px] text-zinc-300"
                    title="Compare side-by-side"
                  >
                    Compare
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteSnapshot(sn.id)}
                    aria-label={`Delete snapshot ${sn.name}`}
                    className="p-0.5 text-zinc-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Named History Steps */}
          <div className="space-y-1 max-h-32 overflow-y-auto studio-scroll">
            <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 px-1">
              History Steps
            </span>
            {[...entries].reverse().map((entry, revIdx) => {
              const actualIdx = entries.length - 1 - revIdx;
              const isCurrent = actualIdx === cursor;
              return (
                <button
                  key={`${actualIdx}-${entry.timestamp}`}
                  type="button"
                  onClick={() => onJumpHistory(actualIdx)}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded text-[11px] text-left transition-colors ${
                    isCurrent
                      ? 'bg-amber-500/20 text-amber-200 border border-amber-500/40'
                      : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                  }`}
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="font-mono-num text-[10px] opacity-70">#{actualIdx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
