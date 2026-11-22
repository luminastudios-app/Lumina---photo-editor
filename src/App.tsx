import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  ClipboardCopy,
  ClipboardPaste,
  Command,
  Copy,
  Crop,
  Download,
  Droplet,
  Eye,
  Film,
  FolderOpen,
  Grid,
  ImagePlus,
  Keyboard,
  Layers,
  LayoutPanelLeft,
  Loader2,
  Moon,
  Palette,
  Redo2,
  Sliders,
  SquareStack,
  Sticker,
  Sun,
  TrendingUp,
  Type,
  Undo2,
  Wand2,
  Wrench,
  X,
} from 'lucide-react';
import { motion } from 'motion/react';
import type {
  BlendMode,
  CropParams,
  CustomPreset,
  DetailEffectsParams,
  DrawStroke,
  EditLayer,
  HistogramData,
  ImageLayerParams,
  LayerMask,
  MaskBrushStroke,
  OverlayEraseStroke,
  SavedMaskSelection,
  SavedProject,
  ShapeKind,
  ShortcutMap,
  SnapshotCheckpoint,
  TextParams,
  ToneExtendedParams,
  ToolId,
  WorkspaceLayout,
} from './types/editor';
import {
  commitLayers,
  createDefaultAdjustments,
  createDefaultBlur,
  createDefaultCrop,
  createDefaultCurves,
  createDefaultDetailEffects,
  createDefaultFrame,
  createDefaultHsl,
  createDefaultLayerMask,
  createDefaultShape,
  createDefaultText,
  createDefaultToneExtended,
  createInitialHistory,
  duplicateLayer,
  groupLayerWithBelow,
  jumpToHistoryIndex,
  redoStack,
  removeLayer,
  reorderLayer,
  toggleLayer,
  toggleLayerLock,
  uid,
  undoStack,
  updateLayerBase,
  upsertSingletonLayer,
  type StackHistoryState,
} from './engine/stackReducer';
import {
  attachLuminaPluginGlobal,
  getAllFilterPresets,
  registerFilterPlugin,
} from './engine/filters';
import { rgbToHexString, rgbToHsl, solveWhiteBalanceFromSample } from './engine/colorMath';
import { extractSelectionAsNewOverlay } from './engine/maskEngine';
import {
  generatePresetThumbnails,
  loadImageCached,
  renderEditStack,
} from './engine/pipeline';
import {
  cloneImageLayerParams,
  createDefaultOverlayBorder,
  createOverlayEffectItem,
  pushOverlayHistory,
  redoOverlayHistory,
  undoOverlayHistory,
  type OverlayHistoryEntry,
} from './engine/overlayEffects';
import { decodeStackFromUrlHash, triggerDownload } from './engine/exportUtils';
import {
  deleteProjectFromStorage,
  fileOrBlobToDataUrl,
  getAutoSaveEnabled,
  loadSavedProjects,
  saveProjectToStorage,
  setAutoSaveEnabled as persistAutoSavePref,
} from './utils/storage';
import {
  copyEditStackToClipboard,
  DEFAULT_WORKSPACE_LAYOUTS,
  loadActiveLayout,
  loadCustomPresets,
  loadEditStackClipboard,
  loadFavoritePresetIds,
  loadProjectSnapshots,
  loadRecentPresetIds,
  loadSavedMasks,
  loadShortcuts,
  loadTheme,
  matchesShortcut,
  pushRecentPresetId,
  saveActiveLayout,
  saveCustomPresets,
  saveFavoritePresetIds,
  saveMasksList,
  saveProjectSnapshots,
  saveShortcuts,
  saveTheme,
} from './utils/workspaceStorage';
import { HistogramView } from './components/HistogramView';
import { EditStackPanel, layerTypeToTool } from './components/EditStackPanel';
import { HistorySnapshotsPanel } from './components/HistorySnapshotsPanel';
import { AdjustmentsPanel } from './components/panels/AdjustmentsPanel';
import { ColorPanel } from './components/panels/ColorPanel';
import { CurvesPanel } from './components/panels/CurvesPanel';
import { EffectsPanel } from './components/panels/EffectsPanel';
import { FiltersPanel } from './components/panels/FiltersPanel';
import { MasksPanel, type MaskBrushState } from './components/panels/MasksPanel';
import { CropPanel } from './components/panels/CropPanel';
import { BlurPanel } from './components/panels/BlurPanel';
import { TextPanel } from './components/panels/TextPanel';
import { OverlaysPanel, type BrushConfig } from './components/panels/OverlaysPanel';
import { OverlayPanel, type OverlayBrushState } from './components/panels/OverlayPanel';
import { OverlayCutoutOverlay } from './components/OverlayCutoutOverlay';
import { OverlayStudioOverlay } from './components/OverlayStudioOverlay';
import { CanvasStage, type CompareViewMode } from './components/CanvasStage';
import { ExportModal } from './components/ExportModal';
import { ProjectsModal } from './components/ProjectsModal';
import { ShortcutsModal } from './components/ShortcutsModal';
import { ImportWelcome } from './components/ImportWelcome';
import { CommandPaletteModal, type CommandPaletteAction } from './components/CommandPaletteModal';
import { CollageModal } from './components/CollageModal';
import { BatchSyncModal } from './components/BatchSyncModal';
import { VideoStudioModal } from './components/VideoStudioModal';
import { OfflineIndicator, PWAInstallButton } from './components/PwaControls';

const TOOLS: Array<{
  id: ToolId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  keyHint: string;
}> = [
  { id: 'adjust', label: 'Adjust', icon: Sliders, keyHint: '1' },
  { id: 'color', label: 'Color', icon: Palette, keyHint: '2' },
  { id: 'curves', label: 'Curves', icon: TrendingUp, keyHint: '3' },
  { id: 'effects', label: 'Effects', icon: Wrench, keyHint: '4' },
  { id: 'filters', label: 'Presets', icon: Wand2, keyHint: '5' },
  { id: 'masks', label: 'Masks', icon: Layers, keyHint: '6' },
  { id: 'crop', label: 'Crop', icon: Crop, keyHint: '7' },
  { id: 'blur', label: 'Blur', icon: Droplet, keyHint: '8' },
  { id: 'text', label: 'Text', icon: Type, keyHint: '9' },
  { id: 'overlay', label: 'Overlay', icon: SquareStack, keyHint: '' },
  { id: 'overlays', label: 'Stickers', icon: Sticker, keyHint: '' },
];

export default function App() {
  const [sourceSrc, setSourceSrc] = useState<string | null>(null);
  const [projectName, setProjectName] = useState<string>('Untitled Edit');
  const [projectId, setProjectId] = useState<string>(() => uid('proj'));
  const [sourceDims, setSourceDims] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  const [history, setHistory] = useState<StackHistoryState>(() => createInitialHistory([]));
  const [activeTool, setActiveTool] = useState<ToolId>('adjust');
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);

  const [renderedCanvas, setRenderedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [compareCanvas, setCompareCanvas] = useState<HTMLCanvasElement | null>(null);
  const [compareLabel, setCompareLabel] = useState<string>('Original');
  const [compareMode, setCompareMode] = useState<CompareViewMode>('off');
  const [compareSnapshotLayers, setCompareSnapshotLayers] = useState<EditLayer[] | null>(null);
  const [histogram, setHistogram] = useState<HistogramData | null>(null);
  const [isProxyDragging, setIsProxyDragging] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);

  const [presetThumbs, setPresetThumbs] = useState<Record<string, string>>({});
  const [presetRevision, setPresetRevision] = useState(0);
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>(() => loadSavedProjects());
  const [autoSaveEnabled, setAutoSaveEnabled] = useState<boolean>(() => getAutoSaveEnabled());
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  // Workspace, theme, shortcuts, presets & saved masks state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => loadTheme());
  const [layout, setLayout] = useState<WorkspaceLayout>(() => loadActiveLayout());
  const [shortcuts, setShortcuts] = useState<ShortcutMap>(() => loadShortcuts());
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => loadCustomPresets());
  const [favoritePresetIds, setFavoritePresetIds] = useState<string[]>(() => loadFavoritePresetIds());
  const [recentPresetIds, setRecentPresetIds] = useState<string[]>(() => loadRecentPresetIds());
  const [savedMasks, setSavedMasks] = useState<SavedMaskSelection[]>(() => loadSavedMasks());
  const [snapshots, setSnapshots] = useState<SnapshotCheckpoint[]>([]);
  const [clipboardLayers, setClipboardLayers] = useState<EditLayer[] | null>(() => loadEditStackClipboard());
  const [wbPickerActive, setWbPickerActive] = useState(false);
  const [splashPickActive, setSplashPickActive] = useState(false);
  const [replacePickActive, setReplacePickActive] = useState(false);
  const [copiedMaskSelection, setCopiedMaskSelection] = useState<LayerMask | null>(null);

  // Brush, Mask Brush & AI Magic Eraser interaction states
  const [brush, setBrush] = useState<BrushConfig>({
    active: false,
    tool: 'brush',
    neon: false,
    color: '#F59E0B',
    size: 12,
    opacity: 100,
  });
  const [maskBrush, setMaskBrush] = useState<MaskBrushState>({
    active: false,
    tool: 'paint',
    size: 16,
    hardness: 70,
    opacity: 100,
    colorPickActive: false,
  });
  const [overlayBrush, setOverlayBrush] = useState<OverlayBrushState>({
    active: false,
    mode: 'manual',
    tool: 'erase',
    lastPaintTool: 'erase',
    erase: { size: 84, opacity: 100, hardness: 70 },
    restore: { size: 64, opacity: 100, hardness: 75 },
  });
  const [brushSliderDragging, setBrushSliderDragging] = useState<boolean>(false);
  const [cutoutComparePreview, setCutoutComparePreview] = useState<boolean>(false);
  const [overlayStudioOpen, setOverlayStudioOpen] = useState<boolean>(false);
  const [overlayAutoSnap, setOverlayAutoSnap] = useState<boolean>(true);
  const [overlayHistoryMap, setOverlayHistoryMap] = useState<Record<string, OverlayHistoryEntry>>({});
  const overlayDragBaselineRef = useRef<{ layerId: string; params: ImageLayerParams } | null>(null);
  const cutoutSessionBaselineRef = useRef<{ layerId: string; params: ImageLayerParams } | null>(null);
  const overlayStudioSnapshotLayersRef = useRef<EditLayer[] | null>(null);

  // Modals & Mobile bottom sheet
  const [showExportModal, setShowExportModal] = useState(false);
  const [showProjectsModal, setShowProjectsModal] = useState(false);
  const [showShortcutsModal, setShowShortcutsModal] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showCollageModal, setShowCollageModal] = useState(false);
  const [showBatchSyncModal, setShowBatchSyncModal] = useState(false);
  const [showVideoStudioModal, setShowVideoStudioModal] = useState(false);
  const [mobileSheetExpanded, setMobileSheetExpanded] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [closingProjectName, setClosingProjectName] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const layers = history.present;
  const hasSharedStackInUrl = useMemo(
    () => typeof window !== 'undefined' && window.location.hash.startsWith('#stack='),
    [],
  );

  // Sync HTML theme attribute & attach third-party filter plugin API
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    saveTheme(theme);
  }, [theme]);

  useEffect(() => {
    attachLuminaPluginGlobal();
  }, []);

  useEffect(() => {
    setSnapshots(loadProjectSnapshots(projectId));
  }, [projectId]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((prev) => (prev === msg ? null : prev)), 2600);
  }, []);

  const loadPhotoSource = useCallback(
    async (src: string, name: string, initialLayers: EditLayer[] = [], existingId?: string) => {
      try {
        if (closeTimerRef.current) {
          clearTimeout(closeTimerRef.current);
          closeTimerRef.current = null;
        }
        setClosingProjectName(null);
        setImportError(null);
        const img = await loadImageCached(src);
        let startingLayers = initialLayers;
        if (startingLayers.length === 0 && typeof window !== 'undefined' && window.location.hash) {
          const fromHash = decodeStackFromUrlHash(window.location.hash);
          if (fromHash && fromHash.length > 0) {
            startingLayers = fromHash;
          }
        }
        setSourceSrc(src);
        setProjectName(name);
        setProjectId(existingId ?? uid('proj'));
        setSourceDims({ w: img.naturalWidth, h: img.naturalHeight });
        setHistory(createInitialHistory(startingLayers, 'Original Image'));
        setOverlayHistoryMap({});
        setOverlayBrush((b) => ({ ...b, active: false }));
        setOverlayStudioOpen(false);
        overlayStudioSnapshotLayersRef.current = null;
        setSelectedLayerId(null);
        setWbPickerActive(false);
        setCompareSnapshotLayers(null);
        setCompareLabel('Original');
        setAutoSaveStatus(existingId ? 'saved' : 'idle');
      } catch {
        setImportError('Could not decode that image format in this browser.');
      }
    },
    [],
  );

  // ?autostart=1 opens the most recent saved project if available
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('autostart') === '1' && !sourceSrc && savedProjects.length > 0) {
      const latest = savedProjects[0];
      loadPhotoSource(latest.sourceDataUrl, latest.name, latest.layers, latest.id);
    }
  }, [loadPhotoSource, savedProjects, sourceSrc]);

  const handleImportFile = useCallback(
    async (file: File) => {
      try {
        const dataUrl = await fileOrBlobToDataUrl(file);
        const cleanName = file.name.replace(/\.[^.]+$/, '') || 'Imported Photo';
        await loadPhotoSource(dataUrl, cleanName);
      } catch (err) {
        setImportError(
          err instanceof Error ? err.message : 'Unable to import image file.',
        );
      }
    },
    [loadPhotoSource],
  );

  const handleAddImageOverlay = useCallback(
    async (file: File | Blob, label?: string) => {
      try {
        const url = await fileOrBlobToDataUrl(file);
        const img = await loadImageCached(url);
        const aspectRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
        const nameSource = label ?? ('name' in file ? file.name : 'Overlay');
        const imgLayer: Extract<EditLayer, { type: 'image' }> = {
          id: uid('img'),
          type: 'image',
          name: nameSource.replace(/\.[^.]+$/, '').slice(0, 20) || 'Image Overlay',
          enabled: true,
          opacity: 100,
          blendMode: 'normal',
          params: {
            src: url,
            x: 0.5,
            y: 0.5,
            scale: 0.72,
            rotation: 0,
            aspectRatio,
            flipH: false,
            flipV: false,
            border: createDefaultOverlayBorder(),
            eraseStrokes: [],
            effects: [],
          },
        };
        if (!overlayStudioOpen) {
          overlayStudioSnapshotLayersRef.current = JSON.parse(JSON.stringify(history.present));
        }
        setHistory((prev) => commitLayers(prev, [...prev.present, imgLayer], true, 'Add Image Overlay'));
        setSelectedLayerId(imgLayer.id);
        setActiveTool('overlay');
        setMobileSheetExpanded(false);
        setOverlayBrush((b) => ({ ...b, active: false }));
        setOverlayStudioOpen(true);
        showToast(`Added overlay "${imgLayer.name}"`);
      } catch {
        showToast('Could not decode overlay image');
      }
    },
    [history.present, overlayStudioOpen, showToast],
  );

  const handleReplaceImageOverlay = useCallback(
    async (layerId: string, file: File | Blob) => {
      try {
        const url = await fileOrBlobToDataUrl(file);
        const img = await loadImageCached(url);
        const aspectRatio = img.naturalWidth / Math.max(1, img.naturalHeight);
        const cleanName =
          'name' in file ? file.name.replace(/\.[^.]+$/, '').slice(0, 20) : 'Replaced Overlay';
        const cur = history.present.find((l) => l.id === layerId && l.type === 'image');
        if (!cur || cur.type !== 'image' || cur.locked) return;
        setOverlayHistoryMap((m) => pushOverlayHistory(m, layerId, cur.params));
        const next = history.present.map((l) =>
          l.id === layerId && l.type === 'image'
            ? {
                ...l,
                name: cleanName || l.name,
                params: { ...l.params, src: url, aspectRatio },
              }
            : l,
        );
        setHistory((prev) => commitLayers(prev, next, true, 'Replace Overlay Image'));
        showToast('Replaced overlay image');
      } catch {
        showToast('Could not decode replacement image');
      }
    },
    [history.present, showToast],
  );

  // Clipboard paste support (Ctrl/Cmd+V) — adds overlay when Overlay tool is active on an open canvas
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            if (sourceSrc && activeTool === 'overlay') {
              handleAddImageOverlay(blob, 'Pasted Overlay');
            } else {
              fileOrBlobToDataUrl(blob)
                .then((url) => loadPhotoSource(url, 'Pasted Image'))
                .catch(() => setImportError('Failed to decode pasted image.'));
            }
            return;
          }
        }
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [activeTool, handleAddImageOverlay, loadPhotoSource, sourceSrc]);

  // Generate live filter thumbnails whenever source image or plugin presets change
  useEffect(() => {
    if (!sourceSrc) {
      setPresetThumbs({});
      return;
    }
    let cancelled = false;
    generatePresetThumbnails(sourceSrc, getAllFilterPresets(), 76)
      .then((thumbs) => {
        if (!cancelled) setPresetThumbs(thumbs);
      })
      .catch(() => {
        // ignore thumbnail errors
      });
    return () => {
      cancelled = true;
    };
  }, [sourceSrc, presetRevision]);

  // Render primary canvas pipeline
  useEffect(() => {
    if (!sourceSrc) {
      setRenderedCanvas(null);
      setHistogram(null);
      return;
    }
    let cancelled = false;
    const maxEdge = isProxyDragging ? 540 : 1440;

    renderEditStack(sourceSrc, layers, { maxEdge, showOriginal: showOriginal || cutoutComparePreview })
      .then(({ canvas, histogram: hist }) => {
        if (!cancelled) {
          setRenderedCanvas(canvas);
          setHistogram(hist);
        }
      })
      .catch(() => {
        // ignore aborted render
      });

    return () => {
      cancelled = true;
    };
  }, [cutoutComparePreview, sourceSrc, layers, isProxyDragging, showOriginal]);

  // Render comparison canvas when Split or Side-by-Side mode is active
  useEffect(() => {
    if (!sourceSrc || (compareMode !== 'split' && compareMode !== 'side-by-side')) {
      setCompareCanvas(null);
      return;
    }
    let cancelled = false;
    const targetLayers = compareSnapshotLayers ?? [];
    renderEditStack(sourceSrc, targetLayers, {
      maxEdge: isProxyDragging ? 540 : 1440,
      showOriginal: compareSnapshotLayers === null,
    })
      .then(({ canvas }) => {
        if (!cancelled) setCompareCanvas(canvas);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [compareMode, compareSnapshotLayers, isProxyDragging, sourceSrc]);

  // Helper to commit or live-preview layer updates with named history steps
  const snapshotBeforeDragRef = useRef<EditLayer[] | null>(null);

  const handleDragStart = useCallback(() => {
    if (!snapshotBeforeDragRef.current) {
      snapshotBeforeDragRef.current = history.present;
    }
    setIsProxyDragging(true);
  }, [history.present]);

  const handleDragEnd = useCallback((label = 'Adjust Parameters') => {
    setIsProxyDragging(false);
    if (snapshotBeforeDragRef.current) {
      const baseline = snapshotBeforeDragRef.current;
      snapshotBeforeDragRef.current = null;
      setHistory((prev) => {
        if (JSON.stringify(baseline) === JSON.stringify(prev.present)) return prev;
        const past = [...prev.past, baseline].slice(-60);
        const head = (prev.entries ?? []).slice(0, (prev.cursor ?? 0) + 1);
        const entries = [...head, { label, timestamp: Date.now(), layers: prev.present }].slice(-61);
        return {
          past,
          present: prev.present,
          future: [],
          entries,
          cursor: entries.length - 1,
        };
      });
    }
  }, []);

  const updateLayers = useCallback(
    (next: EditLayer[], recordHistory = true, label = 'Edit Layer') => {
      setHistory((prev) => commitLayers(prev, next, recordHistory, label));
    },
    [],
  );

  const handleUndo = useCallback(() => {
    setHistory((prev) => undoStack(prev));
  }, []);

  const handleRedo = useCallback(() => {
    setHistory((prev) => redoStack(prev));
  }, []);

  const updateImageOverlayParams = useCallback(
    (
      layerId: string,
      updater: (prev: ImageLayerParams) => ImageLayerParams,
      commit: boolean,
      label = 'Edit Overlay',
    ) => {
      const curLayer = history.present.find(
        (l): l is Extract<EditLayer, { type: 'image' }> => l.id === layerId && l.type === 'image',
      );
      if (!curLayer || curLayer.locked) return;

      const updatedParams = updater(curLayer.params);
      if (commit) {
        const baseline =
          overlayDragBaselineRef.current?.layerId === layerId
            ? overlayDragBaselineRef.current.params
            : curLayer.params;
        overlayDragBaselineRef.current = null;
        if (JSON.stringify(baseline) !== JSON.stringify(updatedParams)) {
          setOverlayHistoryMap((m) => pushOverlayHistory(m, layerId, baseline));
        }
      } else if (!overlayDragBaselineRef.current || overlayDragBaselineRef.current.layerId !== layerId) {
        overlayDragBaselineRef.current = {
          layerId,
          params: cloneImageLayerParams(curLayer.params),
        };
      }

      const next = history.present.map((l) =>
        l.id === layerId && l.type === 'image' ? { ...l, params: updatedParams } : l,
      );
      updateLayers(next, commit, label);
    },
    [history.present, updateLayers],
  );

  const handleDuplicateOverlay = useCallback(
    (id: string) => {
      const idx = layers.findIndex((l) => l.id === id && l.type === 'image');
      if (idx === -1) return;
      const src = layers[idx] as Extract<EditLayer, { type: 'image' }>;
      const clonedParams = cloneImageLayerParams(src.params);
      clonedParams.x = Math.min(0.92, clonedParams.x + 0.04);
      clonedParams.y = Math.min(0.92, clonedParams.y + 0.04);
      const copy: Extract<EditLayer, { type: 'image' }> = {
        ...JSON.parse(JSON.stringify(src)),
        id: uid('img'),
        name: `${src.name} copy`.slice(0, 22),
        locked: false,
        params: clonedParams,
      };
      const next = [...layers.slice(0, idx + 1), copy, ...layers.slice(idx + 1)];
      updateLayers(next, true, 'Duplicate Overlay');
      setSelectedLayerId(copy.id);
      showToast('Duplicated overlay');
    },
    [layers, showToast, updateLayers],
  );

  const handleDeleteOverlayLayer = useCallback(
    (id: string) => {
      const target = layers.find((l) => l.id === id);
      if (!target || target.locked) return;
      const next = removeLayer(layers, id);
      updateLayers(next, true, 'Delete Overlay');
      if (selectedLayerId === id) {
        const remainingImg = [...next].reverse().find((l) => l.type === 'image');
        setSelectedLayerId(remainingImg ? remainingImg.id : null);
        setOverlayBrush((b) => ({ ...b, active: false }));
      }
    },
    [layers, selectedLayerId, updateLayers],
  );

  const handleOverlaySliderDragEnd = useCallback(() => {
    if (overlayDragBaselineRef.current) {
      const { layerId, params: baseline } = overlayDragBaselineRef.current;
      overlayDragBaselineRef.current = null;
      const cur = history.present.find((l) => l.id === layerId && l.type === 'image');
      if (cur && cur.type === 'image' && JSON.stringify(baseline) !== JSON.stringify(cur.params)) {
        setOverlayHistoryMap((m) => pushOverlayHistory(m, layerId, baseline));
      }
    }
    handleDragEnd('Edit Overlay');
  }, [handleDragEnd, history.present]);

  const handleOpenCutoutStudio = useCallback(
    (tool: 'erase' | 'restore') => {
      const target =
        layers.find(
          (l): l is Extract<EditLayer, { type: 'image' }> =>
            l.id === selectedLayerId && l.type === 'image',
        ) ??
        [...layers]
          .reverse()
          .find((l): l is Extract<EditLayer, { type: 'image' }> => l.type === 'image');
      if (!target || target.locked) return;
      cutoutSessionBaselineRef.current = {
        layerId: target.id,
        params: cloneImageLayerParams(target.params),
      };
      setSelectedLayerId(target.id);
      setActiveTool('overlay');
      setCutoutComparePreview(false);
      setBrushSliderDragging(false);
      setOverlayBrush((b) => ({
        ...b,
        active: true,
        tool,
        lastPaintTool: tool,
      }));
    },
    [layers, selectedLayerId],
  );

  const handleConfirmCutout = useCallback(() => {
    cutoutSessionBaselineRef.current = null;
    setBrushSliderDragging(false);
    setCutoutComparePreview(false);
    setShowOriginal(false);
    setOverlayBrush((b) => ({ ...b, active: false }));
  }, []);

  const handleCancelCutout = useCallback(() => {
    const base = cutoutSessionBaselineRef.current;
    cutoutSessionBaselineRef.current = null;
    if (base) {
      const restored = history.present.map((l) =>
        l.id === base.layerId && l.type === 'image'
          ? { ...l, params: cloneImageLayerParams(base.params) }
          : l,
      );
      updateLayers(restored, false);
    }
    setBrushSliderDragging(false);
    setCutoutComparePreview(false);
    setShowOriginal(false);
    setOverlayBrush((b) => ({ ...b, active: false }));
  }, [history.present, updateLayers]);

  const handleOpenOverlayStudio = useCallback(() => {
    const target =
      layers.find(
        (l): l is Extract<EditLayer, { type: 'image' }> =>
          l.id === selectedLayerId && l.type === 'image',
      ) ??
      [...layers]
        .reverse()
        .find((l): l is Extract<EditLayer, { type: 'image' }> => l.type === 'image');
    if (!target) return;
    overlayStudioSnapshotLayersRef.current = JSON.parse(JSON.stringify(layers));
    setSelectedLayerId(target.id);
    setActiveTool('overlay');
    setMobileSheetExpanded(false);
    setOverlayBrush((b) => ({ ...b, active: false }));
    setOverlayStudioOpen(true);
  }, [layers, selectedLayerId]);

  const handleApplyOverlayStudio = useCallback(() => {
    overlayStudioSnapshotLayersRef.current = null;
    setOverlayStudioOpen(false);
    setOverlayBrush((b) => ({ ...b, active: false }));
  }, []);

  const handleCancelOverlayStudio = useCallback(() => {
    const snap = overlayStudioSnapshotLayersRef.current;
    overlayStudioSnapshotLayersRef.current = null;
    if (snap) {
      updateLayers(snap, false);
      const fallbackImg = [...snap].reverse().find((l) => l.type === 'image');
      setSelectedLayerId(fallbackImg ? fallbackImg.id : null);
    }
    setOverlayBrush((b) => ({ ...b, active: false }));
    setOverlayStudioOpen(false);
  }, [updateLayers]);

  const handleToggleOverlayBgRemove = useCallback(
    (layerId: string) => {
      updateImageOverlayParams(
        layerId,
        (prev) => {
          const existing = prev.effects ?? [];
          const hasBg = existing.some((fx) => fx.kind === 'bg-remove' && fx.enabled);
          if (hasBg) {
            return { ...prev, effects: existing.filter((fx) => fx.kind !== 'bg-remove') };
          }
          return { ...prev, effects: [...existing, createOverlayEffectItem('bg-remove')] };
        },
        true,
        'Remove Overlay Background',
      );
    },
    [updateImageOverlayParams],
  );

  const handleResetImageOverlay = useCallback(
    (id: string) => {
      updateImageOverlayParams(
        id,
        (prev) => ({
          ...prev,
          effects: [],
          eraseStrokes: [],
          cutoutShape: 'none',
          cutoutInverted: false,
        }),
        true,
        'Reset Overlay',
      );
      setOverlayBrush((b) => ({ ...b, active: false }));
      showToast('Reset overlay effects & erasing');
    },
    [showToast, updateImageOverlayParams],
  );

  const handleUndoOverlay = useCallback(
    (id: string) => {
      const target = layers.find(
        (l): l is Extract<EditLayer, { type: 'image' }> => l.id === id && l.type === 'image',
      );
      if (!target || target.locked) return;
      const res = undoOverlayHistory(overlayHistoryMap, id, target.params);
      if (!res) return;
      setOverlayHistoryMap(res.nextMap);
      updateLayers(
        layers.map((l) => (l.id === id && l.type === 'image' ? { ...l, params: res.params } : l)),
        true,
        'Undo Overlay Edit',
      );
    },
    [layers, overlayHistoryMap, updateLayers],
  );

  const handleRedoOverlay = useCallback(
    (id: string) => {
      const target = layers.find(
        (l): l is Extract<EditLayer, { type: 'image' }> => l.id === id && l.type === 'image',
      );
      if (!target || target.locked) return;
      const res = redoOverlayHistory(overlayHistoryMap, id, target.params);
      if (!res) return;
      setOverlayHistoryMap(res.nextMap);
      updateLayers(
        layers.map((l) => (l.id === id && l.type === 'image' ? { ...l, params: res.params } : l)),
        true,
        'Redo Overlay Edit',
      );
    },
    [layers, overlayHistoryMap, updateLayers],
  );

  const buildProjectSnapshot = useCallback(
    (name: string): SavedProject | null => {
      if (!sourceSrc || !renderedCanvas) return null;
      const thumbCanvas = document.createElement('canvas');
      thumbCanvas.width = 240;
      thumbCanvas.height = Math.max(
        135,
        Math.round((renderedCanvas.height / Math.max(1, renderedCanvas.width)) * 240),
      );
      const tCtx = thumbCanvas.getContext('2d');
      tCtx?.drawImage(renderedCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);

      return {
        id: projectId,
        name,
        updatedAt: Date.now(),
        sourceDataUrl: sourceSrc,
        thumbnailDataUrl: thumbCanvas.toDataURL('image/jpeg', 0.8),
        width: sourceDims.w,
        height: sourceDims.h,
        layers,
      };
    },
    [layers, projectId, renderedCanvas, sourceDims.h, sourceDims.w, sourceSrc],
  );

  const handleSaveCurrent = useCallback(
    (name: string): { ok: boolean; error?: string } => {
      const proj = buildProjectSnapshot(name);
      if (!proj) {
        return { ok: false, error: 'No active photo to save.' };
      }
      const res = saveProjectToStorage(proj);
      if (res.ok) {
        setProjectName(name);
        setSavedProjects(res.projects);
        setAutoSaveStatus('saved');
        showToast(`Saved "${name}"`);
      } else {
        setAutoSaveStatus('error');
      }
      return res;
    },
    [buildProjectSnapshot, showToast],
  );

  // Automatic debounced save to localStorage whenever edits settle
  useEffect(() => {
    if (!autoSaveEnabled || !sourceSrc || !renderedCanvas || isProxyDragging) {
      return;
    }
    setAutoSaveStatus('saving');
    const timer = setTimeout(() => {
      const proj = buildProjectSnapshot(projectName);
      if (!proj) return;
      const res = saveProjectToStorage(proj);
      if (res.ok) {
        setSavedProjects(res.projects);
        setAutoSaveStatus('saved');
      } else {
        setAutoSaveStatus('error');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [autoSaveEnabled, buildProjectSnapshot, isProxyDragging, layers, projectName, renderedCanvas, sourceSrc]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const handleCloseProject = useCallback(() => {
    if (!sourceSrc || closingProjectName !== null) return;
    if (autoSaveEnabled && renderedCanvas) {
      const proj = buildProjectSnapshot(projectName);
      if (proj) {
        const res = saveProjectToStorage(proj);
        if (res.ok) setSavedProjects(res.projects);
      }
    }
    setClosingProjectName(projectName);
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    closeTimerRef.current = setTimeout(() => {
      closeTimerRef.current = null;
      setSourceSrc(null);
      setClosingProjectName(null);
    }, 750);
  }, [
    autoSaveEnabled,
    buildProjectSnapshot,
    closingProjectName,
    projectName,
    renderedCanvas,
    sourceSrc,
  ]);

  // Copy & Paste Edits
  const handleCopyEdits = useCallback(() => {
    const copied = copyEditStackToClipboard(layers);
    setClipboardLayers(copied);
    showToast(`Copied ${copied.length} edit layers`);
  }, [layers, showToast]);

  const handlePasteEdits = useCallback(() => {
    const copied = clipboardLayers ?? loadEditStackClipboard();
    if (!copied || copied.length === 0) {
      showToast('Edit clipboard is empty');
      return;
    }
    const fresh = copied.map((l) => ({ ...JSON.parse(JSON.stringify(l)), id: uid(l.type) })) as EditLayer[];
    updateLayers([...layers, ...fresh], true, 'Paste Edits');
    showToast(`Pasted ${fresh.length} edit layers`);
  }, [clipboardLayers, layers, showToast, updateLayers]);

  // Remappable Keyboard shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');

      if (matchesShortcut(e, shortcuts.commandPalette)) {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }

      if (matchesShortcut(e, shortcuts.undo)) {
        e.preventDefault();
        handleUndo();
        return;
      }

      if (matchesShortcut(e, shortcuts.redo)) {
        e.preventDefault();
        handleRedo();
        return;
      }

      if (matchesShortcut(e, shortcuts.save)) {
        e.preventDefault();
        if (sourceSrc) handleSaveCurrent(projectName);
        return;
      }

      if (matchesShortcut(e, shortcuts.export)) {
        e.preventDefault();
        if (sourceSrc) setShowExportModal(true);
        return;
      }

      if (isTyping) return;

      if (matchesShortcut(e, shortcuts.toggleTheme)) {
        e.preventDefault();
        setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
        return;
      }

      if (matchesShortcut(e, shortcuts.compare) && sourceSrc) {
        setShowOriginal(true);
        return;
      }

      const numIdx = Number(e.key) - 1;
      if (!e.metaKey && !e.ctrlKey && !e.altKey && numIdx >= 0 && numIdx < 9 && TOOLS[numIdx] && sourceSrc) {
        setActiveTool(TOOLS[numIdx].id);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === shortcuts.compare.toLowerCase()) setShowOriginal(false);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [handleRedo, handleSaveCurrent, handleUndo, projectName, shortcuts, sourceSrc]);

  // Active layer parameter helpers
  const adjLayer = layers.find((l) => l.type === 'adjustments') as
    | Extract<EditLayer, { type: 'adjustments' }>
    | undefined;
  const toneExtLayer = layers.find((l) => l.type === 'tone-extended') as
    | Extract<EditLayer, { type: 'tone-extended' }>
    | undefined;
  const detailLayer = layers.find((l) => l.type === 'detail-effects') as
    | Extract<EditLayer, { type: 'detail-effects' }>
    | undefined;
  const hslLayer = layers.find((l) => l.type === 'hsl') as
    | Extract<EditLayer, { type: 'hsl' }>
    | undefined;
  const curvesLayer = layers.find((l) => l.type === 'curves') as
    | Extract<EditLayer, { type: 'curves' }>
    | undefined;
  const filterLayer = layers.find((l) => l.type === 'filter') as
    | Extract<EditLayer, { type: 'filter' }>
    | undefined;
  const cropLayer = layers.find((l) => l.type === 'crop') as
    | Extract<EditLayer, { type: 'crop' }>
    | undefined;
  const blurLayer = layers.find((l) => l.type === 'blur') as
    | Extract<EditLayer, { type: 'blur' }>
    | undefined;
  const frameLayer = layers.find((l) => l.type === 'frame') as
    | Extract<EditLayer, { type: 'frame' }>
    | undefined;
  const drawLayer = layers.find((l) => l.type === 'draw') as
    | Extract<EditLayer, { type: 'draw' }>
    | undefined;
  const textLayers = layers.filter((l) => l.type === 'text') as Array<
    Extract<EditLayer, { type: 'text' }>
  >;
  const shapeLayers = layers.filter((l) => l.type === 'shape') as Array<
    Extract<EditLayer, { type: 'shape' }>
  >;

  const updateToneExtended = (nextParams: ToneExtendedParams) => {
    const next = upsertSingletonLayer(
      layers,
      'tone-extended',
      () => ({
        id: uid('tone'),
        type: 'tone-extended',
        name: 'Levels & Grading',
        enabled: true,
        params: createDefaultToneExtended(),
      }),
      (ex) => ({ ...ex, enabled: true, params: nextParams }),
    );
    updateLayers(next, false);
  };

  const handlePickCanvasRgb = (r: number, g: number, b: number) => {
    if (wbPickerActive) {
      const solved = solveWhiteBalanceFromSample(r, g, b);
      const base = adjLayer?.params ?? createDefaultAdjustments();
      const next = upsertSingletonLayer(
        layers,
        'adjustments',
        () => ({
          id: uid('adj'),
          type: 'adjustments',
          name: 'Adjustments',
          enabled: true,
          params: createDefaultAdjustments(),
        }),
        (ex) => ({
          ...ex,
          enabled: true,
          params: {
            ...base,
            temperature: solved.temperature,
            tint: solved.tint,
          },
        }),
      );
      updateLayers(next, true, 'WB Eyedropper');
      setWbPickerActive(false);
      showToast(`White balance calibrated (Temp ${solved.temperature}, Tint ${solved.tint})`);
      return;
    }

    if (splashPickActive) {
      const [h] = rgbToHsl(r, g, b);
      const hex = rgbToHexString(r, g, b);
      const base = toneExtLayer?.params ?? createDefaultToneExtended();
      updateToneExtended({
        ...base,
        colorSplash: {
          ...(base.colorSplash ?? { enabled: true, targetHue: 20, targetHex: hex, tolerance: 28 }),
          enabled: true,
          targetHue: Math.round(h),
          targetHex: hex,
        },
      });
      setSplashPickActive(false);
      showToast(`Colour Splash hue set to ${Math.round(h)}°`);
      return;
    }

    if (replacePickActive) {
      const hex = rgbToHexString(r, g, b);
      const base = toneExtLayer?.params ?? createDefaultToneExtended();
      updateToneExtended({
        ...base,
        replaceColor: {
          ...(base.replaceColor ?? {
            enabled: true,
            sourceHex: hex,
            targetHex: '#EC489D',
            tolerance: 34,
            softness: 30,
          }),
          enabled: true,
          sourceHex: hex,
        },
      });
      setReplacePickActive(false);
      showToast(`Replace source colour set to ${hex}`);
      return;
    }

    if (activeTool === 'masks' && maskBrush.colorPickActive) {
      const hex = `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
      const target =
        layers.find((l) => l.id === selectedLayerId && l.mask?.kind === 'color-range') ??
        layers.find((l) => l.mask?.kind === 'color-range');
      if (target && target.mask) {
        const next = layers.map((l) =>
          l.id === target.id && l.mask
            ? {
                ...l,
                mask: {
                  ...l.mask,
                  colorRange: {
                    ...(l.mask.colorRange ?? { hex, tolerance: 35, softness: 20 }),
                    hex,
                  },
                },
              }
            : l,
        );
        updateLayers(next, true, 'Sample Color-Range Mask');
      }
      setMaskBrush((prev) => ({ ...prev, colorPickActive: false }));
      showToast(`Mask color sampled: ${hex.toUpperCase()}`);
    }
  };

  const handleCopySelectionMask = useCallback(
    (mask: LayerMask) => {
      setCopiedMaskSelection(JSON.parse(JSON.stringify(mask)));
      showToast('Copied selection to clipboard');
    },
    [showToast],
  );

  const handlePasteSelectionAsNewLayer = useCallback(
    (maskOverride?: LayerMask) => {
      const targetMask = maskOverride ?? copiedMaskSelection;
      if (!targetMask || !renderedCanvas) {
        showToast('No active selection to extract');
        return;
      }
      const cutout = extractSelectionAsNewOverlay(renderedCanvas, targetMask);
      if (!cutout) {
        showToast('Selection area is empty — draw or tap a region first');
        return;
      }
      const cutoutLayer: Extract<EditLayer, { type: 'image' }> = {
        id: uid('img'),
        type: 'image',
        name: `Cutout · ${targetMask.kind}`.slice(0, 22),
        enabled: true,
        opacity: 100,
        blendMode: 'normal',
        params: {
          src: cutout.dataUrl,
          x: cutout.x,
          y: cutout.y,
          scale: cutout.scale,
          rotation: 0,
          aspectRatio: cutout.aspectRatio,
          flipH: false,
          flipV: false,
          border: createDefaultOverlayBorder(),
          eraseStrokes: [],
          effects: [],
        },
      };
      updateLayers([...layers, cutoutLayer], true, 'Paste Selection as Layer');
      setSelectedLayerId(cutoutLayer.id);
      setActiveTool('overlay');
      showToast('Selection pasted as a new overlay layer');
    },
    [copiedMaskSelection, layers, renderedCanvas, showToast, updateLayers],
  );

  // Command Palette action catalog
  const commandActions: CommandPaletteAction[] = useMemo(() => {
    const toolCmds: CommandPaletteAction[] = TOOLS.map((t) => ({
      id: `tool_${t.id}`,
      label: `Switch to ${t.label} Tool`,
      category: 'Tools',
      shortcut: t.keyHint || undefined,
      run: () => setActiveTool(t.id),
    }));

    const layoutCmds: CommandPaletteAction[] = DEFAULT_WORKSPACE_LAYOUTS.map((wl) => ({
      id: `layout_${wl.id}`,
      label: `Workspace: ${wl.name}`,
      category: 'Workspace',
      run: () => {
        setLayout(wl);
        saveActiveLayout(wl);
      },
    }));

    return [
      ...toolCmds,
      ...layoutCmds,
      {
        id: 'cmd_theme',
        label: `Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Theme`,
        category: 'Appearance',
        shortcut: shortcuts.toggleTheme.toUpperCase(),
        run: () => setTheme((t) => (t === 'dark' ? 'light' : 'dark')),
      },
      {
        id: 'cmd_collage',
        label: 'Open Collage Studio',
        category: 'Studios',
        run: () => setShowCollageModal(true),
      },
      {
        id: 'cmd_video_studio',
        label: 'Open Video Studio (Trim, FX, Audio, Export MP4/WebM)',
        category: 'Studios',
        run: () => setShowVideoStudioModal(true),
      },
      {
        id: 'cmd_color_splash',
        label: 'Colour Splash & Replace Colour',
        category: 'Tools',
        run: () => setActiveTool('color'),
      },
      {
        id: 'cmd_fx_library',
        label: 'Creative Effects Library (Blur, Artistic, Retro, Distort, Face, Body)',
        category: 'Tools',
        run: () => setActiveTool('effects'),
      },
      {
        id: 'cmd_cutout_sel',
        label: 'Cutout Selection (Magic Wand, Lasso, Polygon)',
        category: 'Tools',
        run: () => setActiveTool('masks'),
      },
      {
        id: 'cmd_batch_sync',
        label: 'Batch Sync Edits to Multiple Photos',
        category: 'Workflow',
        run: () => setShowBatchSyncModal(true),
      },
      {
        id: 'cmd_copy_edits',
        label: 'Copy Edit Stack to Clipboard',
        category: 'Workflow',
        run: handleCopyEdits,
      },
      {
        id: 'cmd_paste_edits',
        label: 'Paste Edit Stack from Clipboard',
        category: 'Workflow',
        run: handlePasteEdits,
      },
      {
        id: 'cmd_split_compare',
        label: 'Toggle Split-Screen Before / After',
        category: 'Compare',
        run: () => setCompareMode((m) => (m === 'split' ? 'off' : 'split')),
      },
      {
        id: 'cmd_export',
        label: 'Open Export / Print PDF / Share URL',
        category: 'Export',
        shortcut: 'Ctrl+E',
        run: () => {
          if (sourceSrc) setShowExportModal(true);
        },
      },
    ];
  }, [
    handleCopyEdits,
    handlePasteEdits,
    shortcuts.toggleTheme,
    sourceSrc,
    theme,
  ]);

  const renderToolPanel = () => {
    switch (activeTool) {
      case 'adjust':
        return (
          <AdjustmentsPanel
            params={adjLayer?.params ?? createDefaultAdjustments()}
            toneExtended={toneExtLayer?.params ?? createDefaultToneExtended()}
            wbPickerActive={wbPickerActive}
            onToggleWbPicker={setWbPickerActive}
            onChange={(nextParams, commit) => {
              const next = upsertSingletonLayer(
                layers,
                'adjustments',
                () => ({
                  id: uid('adj'),
                  type: 'adjustments',
                  name: 'Adjustments',
                  enabled: true,
                  params: createDefaultAdjustments(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, commit);
            }}
            onChangeToneExtended={updateToneExtended}
            onReset={() => {
              let next = adjLayer ? removeLayer(layers, adjLayer.id) : layers;
              if (toneExtLayer) next = removeLayer(next, toneExtLayer.id);
              updateLayers(next, true, 'Reset Adjustments');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Adjust Tone & Levels')}
          />
        );

      case 'color':
        return (
          <ColorPanel
            params={hslLayer?.params ?? createDefaultHsl()}
            toneExtended={toneExtLayer?.params ?? createDefaultToneExtended()}
            splashPickActive={splashPickActive}
            replacePickActive={replacePickActive}
            onToggleSplashPick={() => {
              setReplacePickActive(false);
              setWbPickerActive(false);
              setSplashPickActive((v) => !v);
            }}
            onToggleReplacePick={() => {
              setSplashPickActive(false);
              setWbPickerActive(false);
              setReplacePickActive((v) => !v);
            }}
            onChange={(nextParams) => {
              const next = upsertSingletonLayer(
                layers,
                'hsl',
                () => ({
                  id: uid('hsl'),
                  type: 'hsl',
                  name: 'Color & Split-Tone',
                  enabled: true,
                  params: createDefaultHsl(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, false);
            }}
            onChangeToneExtended={updateToneExtended}
            onReset={() => {
              let next = hslLayer ? removeLayer(layers, hslLayer.id) : layers;
              if (toneExtLayer) next = removeLayer(next, toneExtLayer.id);
              updateLayers(next, true, 'Reset Color Grading');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Color Grading')}
          />
        );

      case 'curves':
        return (
          <CurvesPanel
            params={curvesLayer?.params ?? createDefaultCurves()}
            onChange={(nextParams) => {
              const next = upsertSingletonLayer(
                layers,
                'curves',
                () => ({
                  id: uid('curves'),
                  type: 'curves',
                  name: 'Tone Curves',
                  enabled: true,
                  params: createDefaultCurves(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, false);
            }}
            onReset={() => {
              if (curvesLayer) updateLayers(removeLayer(layers, curvesLayer.id), true, 'Reset Curves');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Tone Curves')}
          />
        );

      case 'effects':
        return (
          <EffectsPanel
            sourceSrc={sourceSrc ?? ''}
            params={detailLayer?.params ?? createDefaultDetailEffects()}
            onChange={(nextParams: DetailEffectsParams, recordHistory = false) => {
              const next = upsertSingletonLayer(
                layers,
                'detail-effects',
                () => ({
                  id: uid('fx'),
                  type: 'detail-effects',
                  name: 'Effects & Optics FX',
                  enabled: true,
                  params: createDefaultDetailEffects(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, recordHistory, recordHistory ? 'Creative Effect' : 'Edit Layer');
            }}
            onReset={() => {
              if (detailLayer) updateLayers(removeLayer(layers, detailLayer.id), true, 'Reset Optics FX');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Effects & Optics FX')}
          />
        );

      case 'filters':
        return (
          <FiltersPanel
            activeFilter={filterLayer?.params ?? null}
            thumbnails={presetThumbs}
            customPresets={customPresets}
            favoriteIds={favoritePresetIds}
            recentIds={recentPresetIds}
            onSelectPreset={(presetId, presetName) => {
              const nextRecent = pushRecentPresetId(presetId);
              setRecentPresetIds(nextRecent);
              const next = upsertSingletonLayer(
                layers,
                'filter',
                () => ({
                  id: uid('filter'),
                  type: 'filter',
                  name: `Filter · ${presetName}`,
                  enabled: true,
                  params: { presetId, presetName, intensity: 100 },
                }),
                (ex) => ({
                  ...ex,
                  name: `Filter · ${presetName}`,
                  enabled: true,
                  params: {
                    presetId,
                    presetName,
                    intensity: ex.params.intensity || 100,
                  },
                }),
              );
              updateLayers(next, true, `Preset: ${presetName}`);
            }}
            onSelectCustomPreset={(cp) => {
              const cloned = cp.layers.map((l) => ({
                ...JSON.parse(JSON.stringify(l)),
                id: uid(l.type),
              })) as EditLayer[];
              updateLayers(cloned, true, `Custom Preset: ${cp.name}`);
              showToast(`Applied custom preset "${cp.name}"`);
            }}
            onToggleFavorite={(presetId) => {
              const nextFav = favoritePresetIds.includes(presetId)
                ? favoritePresetIds.filter((x) => x !== presetId)
                : [...favoritePresetIds, presetId];
              setFavoritePresetIds(nextFav);
              saveFavoritePresetIds(nextFav);
            }}
            onSaveCustomPreset={(name) => {
              const newCp: CustomPreset = {
                id: uid('cp'),
                name,
                category: 'Custom',
                createdAt: Date.now(),
                layers: JSON.parse(JSON.stringify(layers)),
              };
              const nextList = [newCp, ...customPresets];
              setCustomPresets(nextList);
              saveCustomPresets(nextList);
              showToast(`Saved custom preset "${name}"`);
            }}
            onDeleteCustomPreset={(id) => {
              const nextList = customPresets.filter((c) => c.id !== id);
              setCustomPresets(nextList);
              saveCustomPresets(nextList);
            }}
            onExportCustomPresets={() => {
              const blob = new Blob([JSON.stringify(customPresets, null, 2)], {
                type: 'application/json',
              });
              triggerDownload(blob, 'lumina-custom-presets.json');
            }}
            onImportPresetsFile={async (file) => {
              try {
                const txt = await file.text();
                const parsed = JSON.parse(txt);
                const list = Array.isArray(parsed) ? parsed : [parsed];
                const merged = [...list, ...customPresets].slice(0, 60);
                setCustomPresets(merged);
                saveCustomPresets(merged);
                showToast(`Imported ${list.length} preset(s)`);
              } catch {
                showToast('Invalid preset JSON file');
              }
            }}
            onRegisterPluginPreset={() => {
              const pluginId = `plugin_amber_noir_${Date.now().toString().slice(-4)}`;
              registerFilterPlugin({
                id: pluginId,
                name: 'Studio Amber Noir',
                adjustments: { contrast: 28, saturation: -30, temperature: 16, fade: 14 },
                highlightTint: [255, 224, 178],
                shadowTint: [18, 22, 32],
              });
              setPresetRevision((r) => r + 1);
              showToast('Registered demo plugin filter via LuminaStudio.registerFilter()');
            }}
            onChangeIntensity={(intensity) => {
              if (!filterLayer) return;
              const next = layers.map((l) =>
                l.id === filterLayer.id && l.type === 'filter'
                  ? { ...l, params: { ...l.params, intensity } }
                  : l,
              );
              updateLayers(next, false);
            }}
            onClearFilter={() => {
              if (filterLayer) updateLayers(removeLayer(layers, filterLayer.id), true, 'Clear Preset');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Preset Intensity')}
          />
        );

      case 'masks':
        return (
          <MasksPanel
            layers={layers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            maskBrush={maskBrush}
            onChangeMaskBrush={setMaskBrush}
            savedMasks={savedMasks}
            hasCopiedSelection={Boolean(copiedMaskSelection)}
            onCopySelection={handleCopySelectionMask}
            onPasteSelectionLayer={handlePasteSelectionAsNewLayer}
            onUpdateLayerMask={(layerId, mask) => {
              const next = layers.map((l) => (l.id === layerId ? { ...l, mask } : l));
              updateLayers(next, false);
            }}
            onSaveSelection={(name, mask) => {
              const item: SavedMaskSelection = {
                id: uid('msel'),
                name,
                createdAt: Date.now(),
                mask: JSON.parse(JSON.stringify(mask)),
              };
              const next = [item, ...savedMasks];
              setSavedMasks(next);
              saveMasksList(next);
              showToast(`Saved selection "${name}"`);
            }}
            onDeleteSavedSelection={(id) => {
              const next = savedMasks.filter((s) => s.id !== id);
              setSavedMasks(next);
              saveMasksList(next);
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Refine Layer Mask')}
          />
        );

      case 'crop':
        return (
          <CropPanel
            params={cropLayer?.params ?? createDefaultCrop()}
            imageAspect={sourceDims.w / Math.max(1, sourceDims.h)}
            onChange={(nextParams: CropParams) => {
              const next = upsertSingletonLayer(
                layers,
                'crop',
                () => ({
                  id: uid('crop'),
                  type: 'crop',
                  name: 'Crop & Transform',
                  enabled: true,
                  params: createDefaultCrop(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, false);
            }}
            onReset={() => {
              if (cropLayer) updateLayers(removeLayer(layers, cropLayer.id), true, 'Reset Crop');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Crop & Transform')}
          />
        );

      case 'blur':
        return (
          <BlurPanel
            params={blurLayer?.params ?? createDefaultBlur()}
            onChange={(nextParams) => {
              const next = upsertSingletonLayer(
                layers,
                'blur',
                () => ({
                  id: uid('blur'),
                  type: 'blur',
                  name: 'Blur & Focus',
                  enabled: true,
                  params: createDefaultBlur(),
                }),
                (ex) => ({ ...ex, enabled: true, params: nextParams }),
              );
              updateLayers(next, false);
            }}
            onReset={() => {
              if (blurLayer) updateLayers(removeLayer(layers, blurLayer.id), true, 'Reset Blur');
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Blur & Bokeh')}
          />
        );

      case 'text':
        return (
          <TextPanel
            textLayers={textLayers}
            selectedLayerId={selectedLayerId}
            onSelectLayer={setSelectedLayerId}
            onAddText={(tpl, label) => {
              const merged = { ...createDefaultText('Golden Hour'), ...tpl };
              const newLayer: Extract<EditLayer, { type: 'text' }> = {
                id: uid('txt'),
                type: 'text',
                name: label ?? (merged.text.slice(0, 18) || 'Text Layer'),
                enabled: true,
                params: merged,
              };
              updateLayers([...layers, newLayer], true, 'Add Text Layer');
              setSelectedLayerId(newLayer.id);
            }}
            onUpdateText={(id, nextParams: TextParams) => {
              const next = layers.map((l) =>
                l.id === id && l.type === 'text'
                  ? {
                      ...l,
                      name: nextParams.text.trim().slice(0, 18) || 'Text Layer',
                      params: nextParams,
                    }
                  : l,
              );
              updateLayers(next, false);
            }}
            onDeleteText={(id) => updateLayers(removeLayer(layers, id), true, 'Delete Text Layer')}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Edit Text')}
          />
        );

      case 'overlay':
        return (
          <OverlayPanel
            allLayers={layers}
            selectedLayerId={selectedLayerId}
            overlayBrush={overlayBrush}
            autoSnapEnabled={overlayAutoSnap}
            canUndoOverlay={(id) => (overlayHistoryMap[id]?.past.length ?? 0) > 0}
            canRedoOverlay={(id) => (overlayHistoryMap[id]?.future.length ?? 0) > 0}
            onOpenOverlayStudio={handleOpenOverlayStudio}
            onOpenCutoutStudio={handleOpenCutoutStudio}
            onToggleAutoSnap={setOverlayAutoSnap}
            onAddImageOverlay={(file) => handleAddImageOverlay(file)}
            onSelectOverlay={(id) => setSelectedLayerId(id)}
            onToggleVisibility={(id) => updateLayers(toggleLayer(layers, id), true, 'Toggle Overlay')}
            onToggleLock={(id) => updateLayers(toggleLayerLock(layers, id), true, 'Lock Overlay')}
            onDuplicateOverlay={handleDuplicateOverlay}
            onDeleteOverlay={handleDeleteOverlayLayer}
            onMoveOverlayOrder={(from, to) =>
              updateLayers(reorderLayer(layers, from, to), true, 'Reorder Overlay')
            }
            onUpdateOverlayBase={(id, opacity, blendMode, commit) => {
              const target = layers.find((l) => l.id === id);
              if (!target || target.locked) return;
              updateLayers(updateLayerBase(layers, id, { opacity, blendMode }), commit, 'Blend Overlay');
            }}
            onUpdateOverlayParams={(id, updater, commit) =>
              updateImageOverlayParams(id, updater, commit)
            }
            onUndoOverlay={handleUndoOverlay}
            onRedoOverlay={handleRedoOverlay}
            onResetOverlay={handleResetImageOverlay}
            onDragStart={handleDragStart}
            onDragEnd={handleOverlaySliderDragEnd}
          />
        );

      case 'overlays':
        return (
          <OverlaysPanel
            frame={frameLayer?.params ?? createDefaultFrame()}
            brush={brush}
            strokeCount={drawLayer?.params.strokes.length ?? 0}
            shapeLayers={shapeLayers}
            selectedShapeId={selectedLayerId}
            onSelectShape={setSelectedLayerId}
            onAddShape={(kind: ShapeKind) => {
              const shLayer: Extract<EditLayer, { type: 'shape' }> = {
                id: uid('shp'),
                type: 'shape',
                name: `Shape · ${kind}`,
                enabled: true,
                params: createDefaultShape(kind),
              };
              updateLayers([...layers, shLayer], true, `Add ${kind} Shape`);
              setSelectedLayerId(shLayer.id);
            }}
            onUpdateShape={(id, nextParams) => {
              const next = layers.map((l) =>
                l.id === id && l.type === 'shape' ? { ...l, params: nextParams } : l,
              );
              updateLayers(next, false);
            }}
            onChangeFrame={(nextParams) => {
              if (nextParams.style === 'none') {
                if (frameLayer) updateLayers(removeLayer(layers, frameLayer.id), true, 'Remove Frame');
                return;
              }
              const next = upsertSingletonLayer(
                layers,
                'frame',
                () => ({
                  id: uid('frame'),
                  type: 'frame',
                  name: `Frame · ${nextParams.style}`,
                  enabled: true,
                  params: createDefaultFrame(),
                }),
                (ex) => ({
                  ...ex,
                  name: `Frame · ${nextParams.style}`,
                  enabled: true,
                  params: nextParams,
                }),
              );
              updateLayers(next, false);
            }}
            onChangeBrush={setBrush}
            onUndoStroke={() => {
              if (!drawLayer) return;
              const remaining = drawLayer.params.strokes.slice(0, -1);
              if (remaining.length === 0) {
                updateLayers(removeLayer(layers, drawLayer.id), true, 'Clear Brush');
              } else {
                updateLayers(
                  layers.map((l) =>
                    l.id === drawLayer.id && l.type === 'draw'
                      ? { ...l, params: { strokes: remaining } }
                      : l,
                  ),
                  true,
                  'Undo Brush Stroke',
                );
              }
            }}
            onClearStrokes={() => {
              if (drawLayer) updateLayers(removeLayer(layers, drawLayer.id), true, 'Clear Brush');
            }}
            onAddSticker={(kind, value, color = '#FFFFFF', src) => {
              const stLayer: Extract<EditLayer, { type: 'sticker' }> = {
                id: uid('stk'),
                type: 'sticker',
                name: kind === 'emoji' ? `Sticker ${value}` : `Sticker · ${value}`,
                enabled: true,
                params: {
                  kind,
                  value,
                  src,
                  color,
                  size: 0.16,
                  rotation: 0,
                  opacity: 1,
                  x: 0.5,
                  y: 0.5,
                },
              };
              updateLayers([...layers, stLayer], true, 'Add Sticker');
              setSelectedLayerId(stLayer.id);
            }}
            onUploadCustomSticker={async (file) => {
              try {
                const url = await fileOrBlobToDataUrl(file);
                const stLayer: Extract<EditLayer, { type: 'sticker' }> = {
                  id: uid('stk'),
                  type: 'sticker',
                  name: file.name.slice(0, 16) || 'Custom Sticker',
                  enabled: true,
                  params: {
                    kind: 'image',
                    value: file.name,
                    src: url,
                    color: '#FFFFFF',
                    size: 0.22,
                    rotation: 0,
                    opacity: 1,
                    x: 0.5,
                    y: 0.5,
                  },
                };
                updateLayers([...layers, stLayer], true, 'Custom Sticker');
                setSelectedLayerId(stLayer.id);
              } catch {
                showToast('Could not load custom sticker');
              }
            }}
            onDragStart={handleDragStart}
            onDragEnd={() => handleDragEnd('Overlays & Borders')}
          />
        );
    }
  };

  const selectedImageLayer = useMemo(() => {
    if (!selectedLayerId) return null;
    return (
      layers.find(
        (l): l is Extract<EditLayer, { type: 'image' }> =>
          l.id === selectedLayerId && l.type === 'image',
      ) ?? null
    );
  }, [layers, selectedLayerId]);

  const selectedOverlayLayer = useMemo(() => {
    if (!selectedImageLayer || !selectedImageLayer.enabled || selectedImageLayer.locked) return null;
    return selectedImageLayer;
  }, [selectedImageLayer]);

  const isOverlayCutoutOpen = Boolean(
    sourceSrc &&
      closingProjectName === null &&
      activeTool === 'overlay' &&
      overlayBrush.active &&
      selectedOverlayLayer,
  );

  const isOverlayStudioOpen = Boolean(
    sourceSrc &&
      closingProjectName === null &&
      overlayStudioOpen &&
      selectedImageLayer &&
      !isOverlayCutoutOpen,
  );

  return (
    <div
      className="lumina-shell h-screen w-screen flex flex-col bg-[#0B0C0F] text-[#F1F3F5] overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        if (!sourceSrc) return;
        e.preventDefault();
        const f = e.dataTransfer.files?.[0];
        if (!f) return;
        if (activeTool === 'overlay') {
          handleAddImageOverlay(f);
        } else {
          handleImportFile(f);
        }
      }}
    >
      {/* Hidden file input for topbar Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif,.cr2,.nef,.arw,.dng"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleImportFile(f);
        }}
      />

      {/* Top Studio Header Bar (hidden in Overlay Studio / Cutout Studio) */}
      {!isOverlayCutoutOpen && !isOverlayStudioOpen && (
      <header className="h-12 md:h-13 shrink-0 px-2.5 md:px-4 border-b border-white/[0.08] bg-[#101216] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {sourceSrc && closingProjectName === null && (
            <button
              type="button"
              onClick={handleCloseProject}
              aria-label="Close project"
              title="Close project"
              className="p-1.5 -ml-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            type="button"
            onClick={handleCloseProject}
            disabled={closingProjectName !== null}
            aria-label="Lumina Studio"
            className="font-display text-sm md:text-base font-bold tracking-tight text-white whitespace-nowrap shrink-0 hover:text-amber-400 disabled:opacity-80 transition-colors"
          >
            {!sourceSrc || closingProjectName !== null ? (
              <>
                <span className="sm:hidden">Lumina</span>
                <span className="hidden sm:inline">Lumina Studio</span>
              </>
            ) : (
              <>
                <span className="hidden min-[440px]:inline sm:hidden">Lumina</span>
                <span className="hidden sm:inline">Lumina Studio</span>
              </>
            )}
          </button>
          {sourceSrc && closingProjectName === null && (
            <span className="hidden lg:inline text-xs text-zinc-400 truncate max-w-[200px]">
              · {projectName}
              {autoSaveEnabled && autoSaveStatus === 'saving' && (
                <span className="text-zinc-500"> · Saving…</span>
              )}
              {autoSaveEnabled && autoSaveStatus === 'saved' && (
                <span className="text-zinc-500"> · Auto-saved</span>
              )}
              {autoSaveEnabled && autoSaveStatus === 'error' && (
                <span className="text-amber-400"> · Storage full</span>
              )}
            </span>
          )}
        </div>

        {/* Center studio controls */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          <button
            type="button"
            disabled={closingProjectName !== null}
            onClick={() => fileInputRef.current?.click()}
            aria-label="Open photo file"
            className="p-1.5 sm:px-2 sm:py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
          >
            <ImagePlus className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
            <span className="hidden xl:inline">Open</span>
          </button>

          {sourceSrc && closingProjectName === null && (
            <>
              <button
                type="button"
                onClick={handleUndo}
                disabled={history.past.length === 0}
                aria-label="Undo"
                title="Undo"
                className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30"
              >
                <Undo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={handleRedo}
                disabled={history.future.length === 0}
                aria-label="Redo"
                title="Redo"
                className="p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30"
              >
                <Redo2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onPointerDown={() => setShowOriginal(true)}
                onPointerUp={() => setShowOriginal(false)}
                onPointerLeave={() => setShowOriginal(false)}
                aria-label="Hold to compare before and after"
                title="Hold to see original"
                className={`px-2 py-1.5 rounded-md text-xs font-medium flex items-center gap-1 border transition-colors whitespace-nowrap ${
                  showOriginal
                    ? 'bg-amber-500 text-zinc-950 border-amber-500'
                    : 'bg-[#181A20] text-zinc-200 border-white/10 hover:bg-white/10'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span className="hidden xl:inline">Hold B/A</span>
              </button>

              <button
                type="button"
                onClick={handleCopyEdits}
                aria-label="Copy edit stack"
                title="Copy Edits"
                className="hidden sm:inline-flex p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/10"
              >
                <ClipboardCopy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handlePasteEdits}
                disabled={!clipboardLayers}
                aria-label="Paste edit stack"
                title="Paste Edits"
                className="hidden sm:inline-flex p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-30"
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setShowBatchSyncModal(true)}
                aria-label="Batch sync edits"
                title="Batch Sync Edits"
                className="hidden lg:inline-flex p-1.5 rounded-md text-zinc-300 hover:text-white hover:bg-white/10"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowCollageModal(true)}
            aria-label="Open Collage Studio"
            title="Collage Studio"
            className="hidden sm:inline-flex px-2 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 items-center gap-1 whitespace-nowrap"
          >
            <Grid className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Collage</span>
          </button>

          <button
            type="button"
            onClick={() => setShowVideoStudioModal(true)}
            aria-label="Open Video Studio"
            title="Video Studio"
            className="px-2 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 flex items-center gap-1 whitespace-nowrap"
          >
            <Film className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden xl:inline">Video</span>
          </button>

          <button
            type="button"
            disabled={closingProjectName !== null}
            onClick={() => setShowProjectsModal(true)}
            aria-label="Projects and save"
            className="px-2 py-1.5 rounded-md text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/10 disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">Projects</span>
          </button>

          {sourceSrc && (
            <button
              type="button"
              onClick={() => {
                const idx = DEFAULT_WORKSPACE_LAYOUTS.findIndex((l) => l.id === layout.id);
                const next = DEFAULT_WORKSPACE_LAYOUTS[(idx + 1) % DEFAULT_WORKSPACE_LAYOUTS.length];
                setLayout(next);
                saveActiveLayout(next);
                showToast(`Layout: ${next.name}`);
              }}
              aria-label={`Switch workspace layout (${layout.name})`}
              title={`Workspace Layout: ${layout.name}`}
              className="hidden md:inline-flex p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
            >
              <LayoutPanelLeft className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowCommandPalette(true)}
            aria-label="Command palette (Ctrl+K)"
            title="Command Palette (Ctrl+K)"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <Command className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title="Toggle Dark / Light Theme"
            className="p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={() => setShowShortcutsModal(true)}
            aria-label="Keyboard shortcuts"
            title="Keyboard Shortcuts"
            className="hidden sm:inline-flex p-1.5 rounded-md text-zinc-400 hover:text-white hover:bg-white/10"
          >
            <Keyboard className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Export CTA */}
        <div className="flex items-center gap-1.5 shrink-0">
          <PWAInstallButton className="hidden lg:flex" />
          <button
            type="button"
            disabled={!sourceSrc || closingProjectName !== null}
            onClick={() => setShowExportModal(true)}
            className="px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export</span>
          </button>
        </div>
      </header>
      )}

      {/* Main Studio Workspace */}
      {closingProjectName !== null ? (
        <div
          role="status"
          aria-live="polite"
          aria-label="Closing project"
          className="flex-1 min-h-0 flex items-center justify-center bg-[#0B0C0F] px-6"
        >
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-xs rounded-2xl bg-[#14161B] border border-white/[0.08] p-6 shadow-2xl flex flex-col items-center text-center gap-4"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
            <div className="space-y-1">
              <p className="font-display text-sm font-semibold text-white">
                {autoSaveEnabled ? 'Saving & closing project…' : 'Closing project…'}
              </p>
              <p className="text-xs text-zinc-400 truncate max-w-[220px]">
                {closingProjectName}
              </p>
            </div>
            <div className="w-full h-1 rounded-full bg-white/[0.08] overflow-hidden">
              <motion.div
                initial={{ width: '0%' }}
                animate={{ width: '100%' }}
                transition={{ duration: 0.7, ease: 'easeOut' }}
                className="h-full bg-amber-500 rounded-full"
              />
            </div>
          </motion.div>
        </div>
      ) : !sourceSrc ? (
        <ImportWelcome
          savedProjects={savedProjects}
          autoSaveEnabled={autoSaveEnabled}
          hasSharedStackInUrl={hasSharedStackInUrl}
          onImportFile={handleImportFile}
          onLoadProject={(proj) => {
            loadPhotoSource(proj.sourceDataUrl, proj.name, proj.layers, proj.id);
          }}
          onDeleteProject={(id) => setSavedProjects(deleteProjectFromStorage(id))}
          onOpenCollage={() => setShowCollageModal(true)}
          onOpenVideoStudio={() => setShowVideoStudioModal(true)}
          errorMsg={importError}
        />
      ) : (
        <main className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          {/* Desktop Left Tool Rail */}
          {layout.showLeftRail && !isOverlayCutoutOpen && !isOverlayStudioOpen && (
            <nav
              aria-label="Editor tools"
              className="hidden md:flex w-[72px] shrink-0 flex-col items-center py-2 gap-1 bg-[#101216] border-r border-white/[0.08] overflow-y-auto studio-scroll"
            >
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveTool(tool.id)}
                    aria-label={`${tool.label} tool${tool.keyHint ? ` (shortcut ${tool.keyHint})` : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-14 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-colors ${
                      isActive
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/40'
                        : 'text-zinc-400 hover:text-zinc-100 hover:bg-white/[0.06] border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="text-[10px] font-medium whitespace-nowrap">
                      {tool.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}

          {/* Center Canvas Viewport */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col relative">
            <CanvasStage
              renderedCanvas={renderedCanvas}
              compareCanvas={compareCanvas}
              compareLabel={compareLabel}
              compareMode={compareMode}
              onChangeCompareMode={(m) => {
                if (m === 'off') setCompareSnapshotLayers(null);
                setCompareMode(m);
              }}
              histogram={histogram}
              showCanvasHistogramOverlay={layout.showCanvasHistogramOverlay}
              sourceWidth={sourceDims.w}
              sourceHeight={sourceDims.h}
              layers={layers}
              activeTool={activeTool}
              selectedLayerId={selectedLayerId}
              showOriginal={showOriginal}
              isProxy={isProxyDragging}
              brush={brush}
              maskBrush={maskBrush}
              overlayBrush={overlayBrush}
              brushSliderDragging={brushSliderDragging}
              autoSnapEnabled={overlayAutoSnap}
              wbPickerActive={wbPickerActive}
              splashPickActive={splashPickActive}
              replacePickActive={replacePickActive}
              isOverlayStudioOpen={isOverlayStudioOpen}
              onAddDrawStroke={(stroke: DrawStroke) => {
                const next = upsertSingletonLayer(
                  layers,
                  'draw',
                  () => ({
                    id: uid('draw'),
                    type: 'draw',
                    name: 'Brush Drawing',
                    enabled: true,
                    params: { strokes: [] },
                  }),
                  (ex) => ({
                    ...ex,
                    enabled: true,
                    params: { strokes: [...ex.params.strokes, stroke] },
                  }),
                );
                updateLayers(next, true, 'Brush Stroke');
              }}
              onAddMaskBrushStroke={(stroke: MaskBrushStroke) => {
                const target =
                  layers.find((l) => l.id === selectedLayerId && l.mask?.kind === 'brush') ??
                  layers.find((l) => l.mask?.kind === 'brush');
                if (!target || !target.mask) return;
                const next = layers.map((l) =>
                  l.id === target.id && l.mask
                    ? {
                        ...l,
                        mask: {
                          ...l.mask,
                          brushStrokes: [...(l.mask.brushStrokes ?? []), stroke],
                        },
                      }
                    : l,
                );
                updateLayers(next, true, 'Paint Layer Mask');
              }}
              onPaintOverlayEraseStroke={(layerId: string, stroke: OverlayEraseStroke) => {
                updateImageOverlayParams(
                  layerId,
                  (prev) => ({ ...prev, eraseStrokes: [...(prev.eraseStrokes ?? []), stroke] }),
                  true,
                  stroke.tool === 'erase' ? 'Erase Overlay' : 'Restore Overlay',
                );
              }}
              onPickCanvasRgb={handlePickCanvasRgb}
              onUpdateMaskWandSeed={(xNorm, yNorm) => {
                const target =
                  layers.find((l) => l.id === selectedLayerId && l.mask?.kind === 'magic-wand') ??
                  layers.find((l) => l.mask?.kind === 'magic-wand');
                if (!target || !target.mask) return;
                const next = layers.map((l) =>
                  l.id === target.id && l.mask
                    ? {
                        ...l,
                        mask: {
                          ...l.mask,
                          wand: {
                            ...(l.mask.wand ?? {
                              seedX: 0.5,
                              seedY: 0.5,
                              tolerance: 32,
                              contiguous: true,
                            }),
                            seedX: xNorm,
                            seedY: yNorm,
                          },
                        },
                      }
                    : l,
                );
                updateLayers(next, true, 'Magic Wand Selection');
              }}
              onUpdateMaskPolygonPoints={(points, commit) => {
                const target =
                  layers.find(
                    (l) =>
                      l.id === selectedLayerId &&
                      (l.mask?.kind === 'lasso' || l.mask?.kind === 'polygon'),
                  ) ??
                  layers.find((l) => l.mask?.kind === 'lasso' || l.mask?.kind === 'polygon');
                if (!target || !target.mask) return;
                const next = layers.map((l) =>
                  l.id === target.id && l.mask
                    ? { ...l, mask: { ...l.mask, polygonPoints: points } }
                    : l,
                );
                updateLayers(next, commit, 'Selection Path');
              }}
              onMoveOverlayLayer={(id, x, y, commit) => {
                const cur = layers.find((l) => l.id === id);
                if (!cur) return;
                if (cur.type === 'image') {
                  updateImageOverlayParams(id, (prev) => ({ ...prev, x, y }), commit, 'Move Overlay');
                  return;
                }
                const next = layers.map((l) => {
                  if (l.id !== id) return l;
                  if (l.type === 'text' || l.type === 'sticker' || l.type === 'shape') {
                    return { ...l, params: { ...l.params, x, y } } as EditLayer;
                  }
                  return l;
                });
                updateLayers(next, commit, 'Move Overlay');
              }}
              onTransformOverlayLayer={(id, patch, commit) => {
                const cur = layers.find((l) => l.id === id);
                if (cur?.type === 'image') {
                  updateImageOverlayParams(
                    id,
                    (prev) => ({
                      ...prev,
                      ...(patch.scale !== undefined ? { scale: patch.scale } : {}),
                      ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
                    }),
                    commit,
                    'Transform Overlay',
                  );
                  return;
                }
                const hasPatch = Object.keys(patch).length > 0;
                const next = hasPatch
                  ? layers.map((l) => {
                      if (l.id !== id) return l;
                      if (l.type === 'text') {
                        return {
                          ...l,
                          params: {
                            ...l.params,
                            ...(patch.fontSize !== undefined ? { fontSize: patch.fontSize } : {}),
                            ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
                          },
                        };
                      }
                      if (l.type === 'sticker' || l.type === 'shape') {
                        return {
                          ...l,
                          params: {
                            ...l.params,
                            ...(patch.size !== undefined ? { size: patch.size } : {}),
                            ...(patch.rotation !== undefined ? { rotation: patch.rotation } : {}),
                          },
                        } as EditLayer;
                      }
                      return l;
                    })
                  : layers;
                updateLayers(next, commit, 'Transform Overlay');
              }}
              onDeleteOverlayLayer={handleDeleteOverlayLayer}
              onMoveBlurCenter={(cx, cy, commit) => {
                if (!blurLayer) return;
                const next = layers.map((l) =>
                  l.id === blurLayer.id && l.type === 'blur'
                    ? { ...l, params: { ...l.params, centerX: cx, centerY: cy } }
                    : l,
                );
                updateLayers(next, commit, 'Reposition Blur Center');
              }}
              onSelectLayerId={setSelectedLayerId}
            />

            {isOverlayCutoutOpen && selectedOverlayLayer && (
              <OverlayCutoutOverlay
                overlayBrush={overlayBrush}
                cutoutShape={selectedOverlayLayer.params.cutoutShape ?? 'none'}
                cutoutInverted={Boolean(selectedOverlayLayer.params.cutoutInverted)}
                subjectSelected={Boolean(
                  selectedOverlayLayer.params.effects?.some(
                    (fx) => fx.kind === 'bg-remove' && fx.enabled,
                  ),
                )}
                canUndo={(overlayHistoryMap[selectedOverlayLayer.id]?.past.length ?? 0) > 0}
                canRedo={(overlayHistoryMap[selectedOverlayLayer.id]?.future.length ?? 0) > 0}
                comparePreview={cutoutComparePreview}
                onUndo={() => handleUndoOverlay(selectedOverlayLayer.id)}
                onRedo={() => handleRedoOverlay(selectedOverlayLayer.id)}
                onToggleCompare={setCutoutComparePreview}
                onCancel={handleCancelCutout}
                onConfirm={handleConfirmCutout}
                onChangeBrush={setOverlayBrush}
                onBrushSliderDragChange={setBrushSliderDragging}
                onApplySelectSubject={() => {
                  handleToggleOverlayBgRemove(selectedOverlayLayer.id);
                }}
                onSelectShape={(shape) => {
                  updateImageOverlayParams(
                    selectedOverlayLayer.id,
                    (prev) => ({ ...prev, cutoutShape: shape }),
                    true,
                    'Cutout Shape',
                  );
                }}
                onToggleInvert={() => {
                  updateImageOverlayParams(
                    selectedOverlayLayer.id,
                    (prev) => ({ ...prev, cutoutInverted: !prev.cutoutInverted }),
                    true,
                    'Invert Cutout',
                  );
                }}
              />
            )}

            {isOverlayStudioOpen && selectedImageLayer && (
              <OverlayStudioOverlay
                allLayers={layers}
                selectedLayer={selectedImageLayer}
                autoSnapEnabled={overlayAutoSnap}
                canUndo={(overlayHistoryMap[selectedImageLayer.id]?.past.length ?? 0) > 0}
                canRedo={(overlayHistoryMap[selectedImageLayer.id]?.future.length ?? 0) > 0}
                onCancel={handleCancelOverlayStudio}
                onApply={handleApplyOverlayStudio}
                onUndo={() => handleUndoOverlay(selectedImageLayer.id)}
                onRedo={() => handleRedoOverlay(selectedImageLayer.id)}
                onOpenEraser={() => handleOpenCutoutStudio('erase')}
                onAddOverlayFile={(file) => handleAddImageOverlay(file)}
                onReplaceOverlayFile={handleReplaceImageOverlay}
                onDuplicateOverlay={handleDuplicateOverlay}
                onToggleBgRemove={handleToggleOverlayBgRemove}
                onToggleAutoSnap={setOverlayAutoSnap}
                onSelectOverlay={setSelectedLayerId}
                onToggleVisibility={(id) => updateLayers(toggleLayer(layers, id), true, 'Toggle Overlay')}
                onToggleLock={(id) => updateLayers(toggleLayerLock(layers, id), true, 'Lock Overlay')}
                onDeleteOverlay={handleDeleteOverlayLayer}
                onMoveOverlayOrder={(from, to) =>
                  updateLayers(reorderLayer(layers, from, to), true, 'Reorder Overlay')
                }
                onUpdateBase={(id, opacity, blendMode, commit) => {
                  const target = layers.find((l) => l.id === id);
                  if (!target || target.locked) return;
                  updateLayers(
                    updateLayerBase(layers, id, { opacity, blendMode }),
                    commit,
                    'Blend Overlay',
                  );
                }}
                onUpdateParams={(id, updater, commit) => updateImageOverlayParams(id, updater, commit)}
                onResetOverlay={handleResetImageOverlay}
                onDragStart={handleDragStart}
                onDragEnd={handleOverlaySliderDragEnd}
              />
            )}

            {toastMsg && (
              <div
                role="status"
                aria-live="polite"
                className={`absolute top-14 z-50 px-3 py-1.5 rounded-lg bg-[#181A20]/95 border border-white/15 text-xs text-zinc-100 shadow-lg pointer-events-none ${
                  isOverlayStudioOpen || isOverlayCutoutOpen
                    ? 'left-1/2 -translate-x-1/2'
                    : 'right-3'
                }`}
              >
                {toastMsg}
              </div>
            )}
          </div>

          {/* Desktop Right Contextual Controls + Histogram + Edit Stack + History */}
          {layout.showRightPanel && !isOverlayCutoutOpen && !isOverlayStudioOpen && (
            <aside
              aria-label="Tool properties and edit stack"
              className="hidden md:flex w-[328px] shrink-0 flex-col bg-[#121419] border-l border-white/[0.08] min-h-0"
            >
              {layout.showHistogram && <HistogramView histogram={histogram} />}

              <div className="flex-1 min-h-0 overflow-y-auto studio-scroll p-3.5">
                {renderToolPanel()}
              </div>

              <EditStackPanel
                layers={layers}
                selectedLayerId={selectedLayerId}
                onSelectLayer={(layer) => {
                  setSelectedLayerId(layer.id);
                  setActiveTool(layerTypeToTool(layer.type));
                }}
                onToggleLayer={(id) => updateLayers(toggleLayer(layers, id), true, 'Toggle Layer')}
                onToggleLock={(id) => updateLayers(toggleLayerLock(layers, id), true, 'Toggle Lock')}
                onDuplicateLayer={(id) => updateLayers(duplicateLayer(layers, id), true, 'Duplicate Layer')}
                onGroupLayer={(id) => updateLayers(groupLayerWithBelow(layers, id), true, 'Group Layers')}
                onUpdateLayerBase={(id, patch) => updateLayers(updateLayerBase(layers, id, patch), false)}
                onMoveLayer={(from, to) => updateLayers(reorderLayer(layers, from, to), true, 'Reorder Layer')}
                onRemoveLayer={(id) => updateLayers(removeLayer(layers, id), true, 'Remove Layer')}
                onClearAll={() => updateLayers([], true, 'Clear Edit Stack')}
              />

              <HistorySnapshotsPanel
                entries={history.entries}
                cursor={history.cursor}
                snapshots={snapshots}
                onJumpHistory={(idx) => setHistory((prev) => jumpToHistoryIndex(prev, idx))}
                onCreateSnapshot={(name) => {
                  const snap: SnapshotCheckpoint = {
                    id: uid('snap'),
                    name,
                    createdAt: Date.now(),
                    layers: JSON.parse(JSON.stringify(layers)),
                  };
                  const next = [snap, ...snapshots];
                  setSnapshots(next);
                  saveProjectSnapshots(projectId, next);
                  showToast(`Saved snapshot "${name}"`);
                }}
                onLoadSnapshot={(snap) => {
                  const cloned = JSON.parse(JSON.stringify(snap.layers)) as EditLayer[];
                  updateLayers(cloned, true, `Snapshot: ${snap.name}`);
                  showToast(`Restored "${snap.name}"`);
                }}
                onDeleteSnapshot={(id) => {
                  const next = snapshots.filter((s) => s.id !== id);
                  setSnapshots(next);
                  saveProjectSnapshots(projectId, next);
                }}
                onSetCompareSnapshot={(snap) => {
                  setCompareSnapshotLayers(snap.layers);
                  setCompareLabel(snap.name);
                  setCompareMode('side-by-side');
                }}
              />
            </aside>
          )}

          {/* Mobile Bottom Sheet Controls + Tool Strip */}
          {!isOverlayCutoutOpen && !isOverlayStudioOpen && (
          <div className="md:hidden flex flex-col bg-[#121419] border-t border-white/[0.08] shrink-0">
            <button
              type="button"
              onClick={() => setMobileSheetExpanded((v) => !v)}
              aria-expanded={mobileSheetExpanded}
              className="flex items-center justify-between px-4 py-1.5 text-xs text-zinc-300 border-b border-white/[0.06]"
            >
              <span className="font-medium">
                {TOOLS.find((t) => t.id === activeTool)?.label ?? activeTool} · {layers.length}{' '}
                {layers.length === 1 ? 'layer' : 'layers'}
              </span>
              {mobileSheetExpanded ? (
                <ChevronDown className="w-4 h-4 text-zinc-400" />
              ) : (
                <ChevronUp className="w-4 h-4 text-zinc-400" />
              )}
            </button>

            {mobileSheetExpanded && (
              <div className="max-h-[38vh] overflow-y-auto studio-scroll p-3.5 space-y-4">
                {renderToolPanel()}
                <EditStackPanel
                  layers={layers}
                  selectedLayerId={selectedLayerId}
                  onSelectLayer={(layer) => {
                    setSelectedLayerId(layer.id);
                    setActiveTool(layerTypeToTool(layer.type));
                  }}
                  onToggleLayer={(id) => updateLayers(toggleLayer(layers, id), true, 'Toggle Layer')}
                  onToggleLock={(id) => updateLayers(toggleLayerLock(layers, id), true, 'Toggle Lock')}
                  onDuplicateLayer={(id) => updateLayers(duplicateLayer(layers, id), true, 'Duplicate Layer')}
                  onGroupLayer={(id) => updateLayers(groupLayerWithBelow(layers, id), true, 'Group Layers')}
                  onUpdateLayerBase={(id, patch) => updateLayers(updateLayerBase(layers, id, patch), false)}
                  onMoveLayer={(from, to) => updateLayers(reorderLayer(layers, from, to), true, 'Reorder Layer')}
                  onRemoveLayer={(id) => updateLayers(removeLayer(layers, id), true, 'Remove Layer')}
                  onClearAll={() => updateLayers([], true, 'Clear Stack')}
                />
              </div>
            )}

            <nav
              aria-label="Mobile editor tools"
              className="flex items-center gap-1 px-2 py-1.5 overflow-x-auto bg-[#101216] border-t border-white/[0.06]"
            >
              {TOOLS.map((tool) => {
                const Icon = tool.icon;
                const isActive = activeTool === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => {
                      setActiveTool(tool.id);
                      setMobileSheetExpanded(true);
                    }}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-amber-500 text-zinc-950'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{tool.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          )}
        </main>
      )}

      {/* Modals */}
      {showExportModal && sourceSrc && (
        <ExportModal
          sourceSrc={sourceSrc}
          projectName={projectName}
          layers={layers}
          onClose={() => setShowExportModal(false)}
        />
      )}

      {showProjectsModal && (
        <ProjectsModal
          projects={savedProjects}
          currentName={projectName}
          hasActiveImage={Boolean(sourceSrc)}
          autoSaveEnabled={autoSaveEnabled}
          onToggleAutoSave={(enabled) => {
            setAutoSaveEnabled(enabled);
            persistAutoSavePref(enabled);
            showToast(enabled ? 'Auto-save enabled' : 'Auto-save paused');
          }}
          onSaveCurrent={handleSaveCurrent}
          onLoadProject={(proj) => {
            loadPhotoSource(proj.sourceDataUrl, proj.name, proj.layers, proj.id);
            showToast(`Loaded "${proj.name}"`);
          }}
          onDeleteProject={(id) => setSavedProjects(deleteProjectFromStorage(id))}
          onClose={() => setShowProjectsModal(false)}
        />
      )}

      {showShortcutsModal && (
        <ShortcutsModal
          shortcuts={shortcuts}
          onChangeShortcuts={(next) => {
            setShortcuts(next);
            saveShortcuts(next);
          }}
          onClose={() => setShowShortcutsModal(false)}
        />
      )}

      {showCommandPalette && (
        <CommandPaletteModal
          actions={commandActions}
          onClose={() => setShowCommandPalette(false)}
        />
      )}

      {showCollageModal && (
        <CollageModal
          savedProjects={savedProjects}
          currentPhotoSrc={sourceSrc}
          onOpenInEditor={(dataUrl, name) => loadPhotoSource(dataUrl, name)}
          onClose={() => setShowCollageModal(false)}
        />
      )}

      {showBatchSyncModal && (
        <BatchSyncModal
          sourceLayers={layers}
          savedProjects={savedProjects}
          onClose={() => setShowBatchSyncModal(false)}
        />
      )}

      {showVideoStudioModal && (
        <VideoStudioModal
          initialLayers={layers}
          onClose={() => setShowVideoStudioModal(false)}
        />
      )}

      <OfflineIndicator />
    </div>
  );
}
