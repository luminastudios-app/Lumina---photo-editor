import type {
  CustomPreset,
  EditLayer,
  SavedMaskSelection,
  ShortcutMap,
  SnapshotCheckpoint,
  WorkspaceLayout,
} from '../types/editor';
import type { StorageBackend } from './storage';

const CUSTOM_PRESETS_KEY = 'lumina_custom_presets_v1';
const FAVORITE_PRESETS_KEY = 'lumina_fav_presets_v1';
const RECENT_PRESETS_KEY = 'lumina_recent_presets_v1';
const SAVED_MASKS_KEY = 'lumina_saved_masks_v1';
const SHORTCUTS_KEY = 'lumina_shortcuts_v1';
const WORKSPACE_LAYOUTS_KEY = 'lumina_workspace_layouts_v1';
const ACTIVE_LAYOUT_KEY = 'lumina_active_layout_v1';
const THEME_KEY = 'lumina_theme_v1';
const SNAPSHOTS_KEY_PREFIX = 'lumina_snapshots_v1_';
const EDIT_CLIPBOARD_KEY = 'lumina_edit_clipboard_v1';

function getStore(custom?: StorageBackend): StorageBackend | null {
  if (custom) return custom;
  if (typeof localStorage !== 'undefined') return localStorage;
  return null;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  undo: 'mod+z',
  redo: 'mod+shift+z',
  save: 'mod+s',
  compare: '\\',
  commandPalette: 'mod+k',
  toggleTheme: 't',
  export: 'mod+e',
};

export const DEFAULT_WORKSPACE_LAYOUTS: WorkspaceLayout[] = [
  {
    id: 'studio-default',
    name: 'Full Studio',
    showLeftRail: true,
    showRightPanel: true,
    showHistogram: true,
    showCanvasHistogramOverlay: false,
  },
  {
    id: 'focus-canvas',
    name: 'Zen Canvas',
    showLeftRail: false,
    showRightPanel: false,
    showHistogram: false,
    showCanvasHistogramOverlay: true,
  },
  {
    id: 'colorist',
    name: 'Colorist Scope',
    showLeftRail: true,
    showRightPanel: true,
    showHistogram: true,
    showCanvasHistogramOverlay: true,
  },
];

export function loadTheme(storage?: StorageBackend): 'dark' | 'light' {
  try {
    const val = getStore(storage)?.getItem(THEME_KEY);
    return val === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}

export function saveTheme(theme: 'dark' | 'light', storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(THEME_KEY, theme);
  } catch {
    // ignore
  }
}

export function loadCustomPresets(storage?: StorageBackend): CustomPreset[] {
  try {
    const raw = getStore(storage)?.getItem(CUSTOM_PRESETS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCustomPresets(presets: CustomPreset[], storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(CUSTOM_PRESETS_KEY, JSON.stringify(presets.slice(0, 60)));
  } catch {
    // ignore
  }
}

export function loadFavoritePresetIds(storage?: StorageBackend): string[] {
  try {
    const raw = getStore(storage)?.getItem(FAVORITE_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveFavoritePresetIds(ids: string[], storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(FAVORITE_PRESETS_KEY, JSON.stringify(ids));
  } catch {
    // ignore
  }
}

export function loadRecentPresetIds(storage?: StorageBackend): string[] {
  try {
    const raw = getStore(storage)?.getItem(RECENT_PRESETS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function pushRecentPresetId(id: string, storage?: StorageBackend): string[] {
  const prev = loadRecentPresetIds(storage).filter((x) => x !== id);
  const next = [id, ...prev].slice(0, 12);
  try {
    getStore(storage)?.setItem(RECENT_PRESETS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}

export function loadSavedMasks(storage?: StorageBackend): SavedMaskSelection[] {
  try {
    const raw = getStore(storage)?.getItem(SAVED_MASKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMasksList(masks: SavedMaskSelection[], storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(SAVED_MASKS_KEY, JSON.stringify(masks.slice(0, 30)));
  } catch {
    // ignore
  }
}

export function loadShortcuts(storage?: StorageBackend): ShortcutMap {
  try {
    const raw = getStore(storage)?.getItem(SHORTCUTS_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    return { ...DEFAULT_SHORTCUTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function saveShortcuts(map: ShortcutMap, storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(SHORTCUTS_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

export function loadWorkspaceLayouts(storage?: StorageBackend): WorkspaceLayout[] {
  try {
    const raw = getStore(storage)?.getItem(WORKSPACE_LAYOUTS_KEY);
    if (!raw) return DEFAULT_WORKSPACE_LAYOUTS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WORKSPACE_LAYOUTS;
  } catch {
    return DEFAULT_WORKSPACE_LAYOUTS;
  }
}

export function saveWorkspaceLayouts(layouts: WorkspaceLayout[], storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(WORKSPACE_LAYOUTS_KEY, JSON.stringify(layouts.slice(0, 12)));
  } catch {
    // ignore
  }
}

export function loadActiveLayout(storage?: StorageBackend): WorkspaceLayout {
  try {
    const raw = getStore(storage)?.getItem(ACTIVE_LAYOUT_KEY);
    if (raw) return { ...DEFAULT_WORKSPACE_LAYOUTS[0], ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_WORKSPACE_LAYOUTS[0];
}

export function saveActiveLayout(layout: WorkspaceLayout, storage?: StorageBackend): void {
  try {
    getStore(storage)?.setItem(ACTIVE_LAYOUT_KEY, JSON.stringify(layout));
  } catch {
    // ignore
  }
}

export function loadProjectSnapshots(projectId: string, storage?: StorageBackend): SnapshotCheckpoint[] {
  try {
    const raw = getStore(storage)?.getItem(`${SNAPSHOTS_KEY_PREFIX}${projectId}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveProjectSnapshots(
  projectId: string,
  snapshots: SnapshotCheckpoint[],
  storage?: StorageBackend,
): void {
  try {
    getStore(storage)?.setItem(
      `${SNAPSHOTS_KEY_PREFIX}${projectId}`,
      JSON.stringify(snapshots.slice(0, 20)),
    );
  } catch {
    // ignore
  }
}

export function copyEditStackToClipboard(layers: EditLayer[], storage?: StorageBackend): EditLayer[] {
  const portable = layers.filter(
    (l) => l.type !== 'crop' && l.type !== 'ai-eraser' && l.type !== 'ai-upscale' && l.type !== 'ai-outpaint',
  );
  const cloned = JSON.parse(JSON.stringify(portable)) as EditLayer[];
  try {
    getStore(storage)?.setItem(EDIT_CLIPBOARD_KEY, JSON.stringify(cloned));
  } catch {
    // ignore
  }
  return cloned;
}

export function loadEditStackClipboard(storage?: StorageBackend): EditLayer[] | null {
  try {
    const raw = getStore(storage)?.getItem(EDIT_CLIPBOARD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

export function matchesShortcut(e: KeyboardEvent, combo: string): boolean {
  const parts = combo.toLowerCase().split('+');
  const keyPart = parts[parts.length - 1];
  const needsMod = parts.includes('mod');
  const needsShift = parts.includes('shift');
  const needsAlt = parts.includes('alt');

  const hasMod = e.metaKey || e.ctrlKey;
  if (needsMod !== hasMod) return false;
  if (needsShift !== e.shiftKey) return false;
  if (needsAlt !== e.altKey) return false;
  return e.key.toLowerCase() === keyPart;
}
