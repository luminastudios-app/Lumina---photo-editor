import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCurveLUT, buildCompositeCurveLUTs } from './curves';
import {
  applyColorSplashPixel,
  applyHslAndSplitTonePixel,
  applyReplaceColorPixel,
  applyToneAndColorPixel,
  applyToneExtendedPixel,
  hslToRgb,
  rgbToHsl,
  solveWhiteBalanceFromSample,
} from './colorMath';
import {
  applyFilterPresetPixel,
  FILTER_PRESETS,
  getAllFilterPresets,
  registerFilterPlugin,
  unregisterFilterPlugin,
} from './filters';
import { applyDetailEffectsBuffer } from './effectsEngine';
import {
  evaluateMaskAlpha,
  expandContractAlpha,
  floodFillMagicWandMask,
  rasterizePolygonMask,
} from './maskEngine';
import {
  clampTrimRange,
  computeEffectiveDuration,
  computeKeyframeOverlayState,
  mapPlaybackToSourceTime,
  pickSupportedVideoMimeType,
} from './videoEngine';
import {
  extractLargestEmbeddedJpeg,
  isRawFilename,
  parseTiffIfdHeader,
} from './rawDecoder';
import {
  commitLayers,
  createDefaultAdjustments,
  createDefaultCurves,
  createDefaultDetailEffects,
  createDefaultHsl,
  createDefaultLayerMask,
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
  undoStack,
} from './stackReducer';
import { applyAiInstagramEffectBuffer } from './pipeline';
import {
  buildPdfFromJpegBytes,
  computeFitDimensions,
  decodeStackFromUrlHash,
  encodeRgbaToTiffBytes,
  encodeStackToUrlHash,
  formatBatchFilename,
} from './exportUtils';
import {
  deleteProjectFromStorage,
  getAutoSaveEnabled,
  loadSavedProjects,
  saveProjectToStorage,
  setAutoSaveEnabled,
  type StorageBackend,
} from '../utils/storage';
import {
  applyOverlayEffectToPixels,
  canvasPointToOverlayLocal,
  computeBrushPreviewGradientStops,
  computeBrushPreviewRadiusCanvasPx,
  computeOverlaySnap,
  createDefaultOverlayBorder,
  extractAlphaContours,
  OVERLAY_EFFECT_CATALOG,
  pushOverlayHistory,
  redoOverlayHistory,
  undoOverlayHistory,
} from './overlayEffects';

test('buildCurveLUT produces identity LUT for default endpoints', () => {
  const lut = buildCurveLUT([
    { x: 0, y: 0 },
    { x: 255, y: 255 },
  ]);
  assert.equal(lut.length, 256);
  assert.equal(lut[0], 0);
  assert.equal(lut[128], 128);
  assert.equal(lut[255], 255);
});

test('buildCompositeCurveLUTs applies RGB master curve then individual channel curve', () => {
  const curves = createDefaultCurves();
  curves.rgb = [
    { x: 0, y: 20 },
    { x: 128, y: 160 },
    { x: 255, y: 255 },
  ];
  curves.r = [
    { x: 0, y: 0 },
    { x: 255, y: 220 },
  ];
  const luts = buildCompositeCurveLUTs(curves);
  assert.ok(luts.g[128] > 150);
  assert.ok(luts.r[255] <= 220);
  assert.equal(luts.g[255], 255);
});

test('rgbToHsl and hslToRgb roundtrip accurately for primary and midtone colors', () => {
  const samples: Array<[number, number, number]> = [
    [220, 60, 40],
    [45, 180, 120],
    [35, 90, 210],
    [128, 128, 128],
  ];
  for (const [r, g, b] of samples) {
    const [h, s, l] = rgbToHsl(r, g, b);
    const [rr, gg, bb] = hslToRgb(h, s, l);
    assert.ok(Math.abs(rr - r) <= 2, `R mismatch ${rr} vs ${r}`);
    assert.ok(Math.abs(gg - g) <= 2, `G mismatch ${gg} vs ${g}`);
    assert.ok(Math.abs(bb - b) <= 2, `B mismatch ${bb} vs ${b}`);
  }
});

test('applyToneAndColorPixel clamps values and responds to exposure & temperature', () => {
  const adj = createDefaultAdjustments();
  adj.exposure = 50; // +1 EV
  const [r, g, b] = applyToneAndColorPixel(100, 100, 100, adj);
  assert.ok(r > 180 && g > 180 && b > 180);
  assert.ok(r <= 255 && g <= 255 && b <= 255);

  const warm = createDefaultAdjustments();
  warm.temperature = 60;
  const [wr, , wb] = applyToneAndColorPixel(140, 140, 140, warm);
  assert.ok(wr > wb);
});

test('applyToneExtendedPixel handles levels, gamma, hue rotation & solveWhiteBalanceFromSample calibrates', () => {
  const ext = createDefaultToneExtended();
  ext.inputBlack = 20;
  ext.inputWhite = 220;
  ext.gamma = 1.4;
  ext.brightness = 15;
  const [r, g, b] = applyToneExtendedPixel(120, 120, 120, ext);
  assert.ok(r > 120 && g > 120 && b > 120);
  assert.ok(r <= 255);

  const coolSampleWb = solveWhiteBalanceFromSample(110, 125, 165);
  assert.ok(coolSampleWb.temperature > 0, 'Cool blue sample should propose positive warm compensation');
});

test('applyHslAndSplitTonePixel shifts targeted hue band without mutating neutral gray', () => {
  const hsl = createDefaultHsl();
  hsl.bands.red.s = -100;
  const [nr, ng, nb] = applyHslAndSplitTonePixel(220, 40, 40, hsl);
  assert.ok(Math.abs(nr - ng) < 10 && Math.abs(ng - nb) < 10);

  const [gr, gg, gb] = applyHslAndSplitTonePixel(120, 120, 120, hsl);
  assert.equal(gr, 120);
  assert.equal(gg, 120);
  assert.equal(gb, 120);
});

test('filter library provides >= 40 unique presets and supports plugin registration', () => {
  assert.ok(FILTER_PRESETS.length >= 40, `Expected >=40 presets, got ${FILTER_PRESETS.length}`);
  const ids = new Set(FILTER_PRESETS.map((p) => p.id));
  assert.equal(ids.size, FILTER_PRESETS.length);

  for (const preset of FILTER_PRESETS) {
    const [r, g, b] = applyFilterPresetPixel(160, 110, 80, preset, 100);
    assert.ok(r >= 0 && r <= 255);
    assert.ok(g >= 0 && g <= 255);
    assert.ok(b >= 0 && b <= 255);
  }

  registerFilterPlugin({
    id: 'test_plugin_cyan',
    name: 'Test Plugin',
    adjustments: {},
    pluginPixelFn: (r, g, b) => [Math.max(0, r - 20), g, Math.min(255, b + 20)],
  });
  const withPlugin = getAllFilterPresets();
  assert.ok(withPlugin.some((p) => p.id === 'test_plugin_cyan'));
  const pluginPreset = withPlugin.find((p) => p.id === 'test_plugin_cyan')!;
  const [pr, , pb] = applyFilterPresetPixel(100, 100, 100, pluginPreset, 100);
  assert.equal(pr, 80);
  assert.equal(pb, 120);
  unregisterFilterPlugin('test_plugin_cyan');
});

test('non-destructive edit stack supports lock, duplicate, group, jumpToHistoryIndex, undo, redo', () => {
  let state = createInitialHistory([]);
  state = commitLayers(
    state,
    [
      { id: 'a', type: 'adjustments', name: 'Adjustments', enabled: true, params: createDefaultAdjustments() },
      { id: 'b', type: 'filter', name: 'Portra 400', enabled: true, params: { presetId: 'portra400', presetName: 'Portra 400', intensity: 80 } },
    ],
    true,
    'Add 2 Layers',
  );
  assert.equal(state.present.length, 2);

  state = commitLayers(state, duplicateLayer(state.present, 'a'), true, 'Duplicate Adj');
  assert.equal(state.present.length, 3);

  state = commitLayers(state, toggleLayerLock(state.present, 'b'), true, 'Lock Portra');
  assert.equal(removeLayer(state.present, 'b').length, 3, 'Locked layer must not be deleted');

  state = commitLayers(state, groupLayerWithBelow(state.present, 'b'), true, 'Group Layers');
  assert.ok(state.present.some((l) => l.type === 'group'));

  state = commitLayers(state, reorderLayer(state.present, 0, 1), true, 'Reorder');
  state = commitLayers(state, toggleLayer(state.present, 'a'), true, 'Toggle');

  state = undoStack(state);
  state = redoStack(state);
  const jumped = jumpToHistoryIndex(state, 1);
  assert.equal(jumped.present.length, 2);
});

test('evaluateMaskAlpha evaluates linear, radial, luminosity, color-range, and invert accurately', () => {
  const w = 16;
  const h = 16;
  const pixels = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    pixels[i * 4] = x < 8 ? 30 : 230;
    pixels[i * 4 + 1] = x < 8 ? 30 : 60;
    pixels[i * 4 + 2] = x < 8 ? 30 : 60;
    pixels[i * 4 + 3] = 255;
  }

  const lumMask = createDefaultLayerMask('luminosity');
  lumMask.luminosity = { min: 120, max: 255, softness: 20 };
  lumMask.feather = 0;
  const lumAlpha = evaluateMaskAlpha(lumMask, pixels, w, h);
  assert.ok(lumAlpha[12] > lumAlpha[2], 'Bright pixels should have higher luminosity mask alpha');

  const crMask = createDefaultLayerMask('color-range');
  crMask.colorRange = { hex: '#E63C3C', tolerance: 35, softness: 10 };
  crMask.feather = 0;
  const crAlpha = evaluateMaskAlpha(crMask, pixels, w, h);
  assert.ok(crAlpha[12] > 0.7 && crAlpha[2] < 0.3);

  const linMask = createDefaultLayerMask('linear');
  linMask.feather = 0;
  linMask.inverted = true;
  const linAlpha = evaluateMaskAlpha(linMask, pixels, w, h);
  assert.ok(linAlpha[15 * w] > linAlpha[0], 'Inverted top-to-bottom linear mask should favor bottom');
});

test('applyDetailEffectsBuffer modifies pixel buffer for unsharp, texture, bloom, and noise reduction', () => {
  const w = 12;
  const h = 12;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    data[i * 4] = (i % 5) * 50;
    data[i * 4 + 1] = 110;
    data[i * 4 + 2] = 160;
    data[i * 4 + 3] = 255;
  }
  const before = new Uint8ClampedArray(data);
  const fx = createDefaultDetailEffects();
  fx.unsharpAmount = 80;
  fx.texture = 40;
  fx.bloomAmount = 30;
  fx.noiseLuma = 25;
  applyDetailEffectsBuffer(data, w, h, fx);

  let diffCount = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] !== before[i]) diffCount++;
    assert.ok(data[i] >= 0 && data[i] <= 255);
  }
  assert.ok(diffCount > 10);
});

test('RAW decoder detects extensions, TIFF headers, and extracts embedded JPEG preview', () => {
  assert.equal(isRawFilename('DSC_0412.NEF'), true);
  assert.equal(isRawFilename('IMG_001.CR2'), true);
  assert.equal(isRawFilename('photo.jpg'), false);

  const fakeTiff = new Uint8Array(4096);
  fakeTiff[0] = 0x49;
  fakeTiff[1] = 0x49;
  fakeTiff[2] = 42;
  fakeTiff[4] = 8;
  const header = parseTiffIfdHeader(fakeTiff);
  assert.ok(header && header.endian === 'II' && header.firstIfdOffset === 8);

  // Embed a >2KB mock JPEG SOI..EOI stream inside RAW bytes
  fakeTiff[100] = 0xff;
  fakeTiff[101] = 0xd8;
  fakeTiff[102] = 0xff;
  fakeTiff[3500] = 0xff;
  fakeTiff[3501] = 0xd9;
  const jpeg = extractLargestEmbeddedJpeg(fakeTiff);
  assert.ok(jpeg && jpeg.length === 3402);
});

test('Export encoders produce valid TIFF, PDF 1.4, formatted batch names, and roundtrip URL hash', () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(180);
  const tiff = encodeRgbaToTiffBytes(rgba, 4, 4);
  assert.equal(tiff[0], 0x49);
  assert.equal(tiff[1], 0x49);
  assert.equal(tiff[2], 42);

  const pdf = buildPdfFromJpegBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), 800, 600, 'a4');
  const pdfHead = new TextDecoder().decode(pdf.subarray(0, 8));
  assert.equal(pdfHead, '%PDF-1.4');

  const name = formatBatchFilename('{name}-{preset}-{index}-{w}x{h}', {
    name: 'Sunset Walk',
    preset: 'ig-square',
    index: 0,
    width: 1080,
    height: 1080,
    ext: 'jpg',
  });
  assert.equal(name, 'Sunset-Walk-ig-square-01-1080x1080.jpg');

  const sampleLayers = [
    { id: 'adj_1', type: 'adjustments' as const, name: 'Adjust', enabled: true, params: createDefaultAdjustments() },
  ];
  const hash = encodeStackToUrlHash(sampleLayers);
  assert.ok(hash.startsWith('#stack='));
  const decoded = decodeStackFromUrlHash(hash);
  assert.ok(decoded && decoded.length === 1 && decoded[0].id === 'adj_1');
});

test('computeFitDimensions preserves aspect ratio against longEdge', () => {
  const landscape = computeFitDimensions(4000, 2000, 1600);
  assert.deepEqual(landscape, { width: 1600, height: 800 });
  const portrait = computeFitDimensions(1200, 2400, 1080);
  assert.deepEqual(portrait, { width: 540, height: 1080 });
});

test('auto-save preference and saved projects storage manage ordering, updates, and quota pruning', () => {
  const store = new Map<string, string>();
  let maxChars = 10000;
  const mockStorage: StorageBackend = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => {
      if (v.length > maxChars) throw new Error('QuotaExceededError');
      store.set(k, v);
    },
  };

  assert.equal(getAutoSaveEnabled(mockStorage), true);
  setAutoSaveEnabled(false, mockStorage);
  assert.equal(getAutoSaveEnabled(mockStorage), false);

  const p1 = {
    id: 'p1',
    name: 'First',
    updatedAt: 100,
    sourceDataUrl: 'data:image/png;base64,AAA',
    thumbnailDataUrl: 'data:image/jpeg;base64,BBB',
    width: 100,
    height: 100,
    layers: [],
  };
  const p2 = { ...p1, id: 'p2', name: 'Second', updatedAt: 200 };
  saveProjectToStorage(p1, mockStorage);
  saveProjectToStorage(p2, mockStorage);

  const loaded = loadSavedProjects(mockStorage);
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].id, 'p2');

  saveProjectToStorage({ ...p1, updatedAt: 300 }, mockStorage);
  const afterUpdate = loadSavedProjects(mockStorage);
  assert.equal(afterUpdate.length, 2);
  assert.equal(afterUpdate[0].id, 'p1');

  maxChars = 250;
  const p3 = { ...p1, id: 'p3', name: 'Third', updatedAt: 400 };
  const res = saveProjectToStorage(p3, mockStorage);
  assert.equal(res.ok, true);
  assert.equal(res.projects.length, 1);
  assert.equal(res.projects[0].id, 'p3');

  const remaining = deleteProjectFromStorage('p3', mockStorage);
  assert.equal(remaining.length, 0);
});

test('applyAiInstagramEffectBuffer illuminates beam center and darkens surround for Flashlight', () => {
  const w = 40;
  const h = 40;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 120;
    data[i + 1] = 120;
    data[i + 2] = 120;
    data[i + 3] = 255;
  }

  applyAiInstagramEffectBuffer(data, w, h, {
    effect: 'flashlight',
    intensity: 90,
    beamSize: 32,
    centerX: 0.5,
    centerY: 0.5,
    warmth: 10,
    ambientDarkness: 85,
  });

  const centerLum = data[(20 * w + 20) * 4];
  const cornerLum = data[0];
  assert.ok(centerLum > 140, `Expected illuminated flashlight core > 140, got ${centerLum}`);
  assert.ok(cornerLum < 60, `Expected darkened flashlight corner < 60, got ${cornerLum}`);
});

test('OVERLAY_EFFECT_CATALOG includes >= 69 unique Picsart-style effects across all categories', () => {
  assert.ok(OVERLAY_EFFECT_CATALOG.length >= 69, `Expected >= 69 effects, got ${OVERLAY_EFFECT_CATALOG.length}`);
  const kinds = new Set(OVERLAY_EFFECT_CATALOG.map((e) => e.kind));
  assert.equal(kinds.size, OVERLAY_EFFECT_CATALOG.length);

  const categories = new Set(OVERLAY_EFFECT_CATALOG.map((e) => e.category));
  for (const cat of [
    'blur',
    'artistic',
    'retro',
    'distort',
    'light',
    'color',
    'texture',
    'face',
    'body',
    'cutout',
  ] as const) {
    assert.ok(categories.has(cat), `Missing effect category: ${cat}`);
  }

  const w = 16;
  const h = 16;
  for (const fx of OVERLAY_EFFECT_CATALOG) {
    const buf = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        buf[i] = x < 8 ? 30 : 210;
        buf[i + 1] = y < 8 ? 60 : 185;
        buf[i + 2] = (x + y) * 7;
        buf[i + 3] = x >= 2 && x < 14 && y >= 2 && y < 14 ? 255 : 0;
      }
    }
    applyOverlayEffectToPixels(buf, w, h, fx.kind, 80);
    for (let i = 0; i < buf.length; i++) {
      assert.ok(buf[i] >= 0 && buf[i] <= 255, `Out of range byte for ${fx.kind}`);
    }
  }
});

test('computeOverlaySnap snaps center, thirds, and canonical angles when enabled', () => {
  const snapped = computeOverlaySnap(0.51, 0.34, 43, true);
  assert.equal(snapped.x, 0.5);
  assert.equal(snapped.snapX, 0.5);
  assert.ok(Math.abs(snapped.y - 1 / 3) < 0.0001);
  assert.equal(snapped.rotation, 45);
  assert.equal(snapped.snapAngle, 45);

  const free = computeOverlaySnap(0.51, 0.34, 43, false);
  assert.equal(free.x, 0.51);
  assert.equal(free.rotation, 43);
  assert.equal(free.snapX, null);
  assert.equal(free.snapAngle, null);
});

test('canvasPointToOverlayLocal accurately maps rotated and flipped coordinates into 0..1 overlay space', () => {
  const local = canvasPointToOverlayLocal(0.5, 0.5, 1000, 1000, {
    src: 'x',
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 90,
    flipH: true,
    flipV: false,
  });
  assert.ok(Math.abs(local.x - 0.5) < 0.0001);
  assert.ok(Math.abs(local.y - 0.5) < 0.0001);

  const rightOfFlip = canvasPointToOverlayLocal(0.6, 0.5, 1000, 1000, {
    src: 'x',
    x: 0.5,
    y: 0.5,
    scale: 1,
    rotation: 0,
    flipH: true,
    flipV: false,
    aspectRatio: 1,
  });
  assert.ok(rightOfFlip.x < 0.5, 'Horizontally flipped right side maps to left side of source mask');
});

test('per-overlay history maintains isolated undo/redo stacks per overlay layer ID', () => {
  const baseA = {
    src: 'a',
    x: 0.5,
    y: 0.5,
    scale: 0.7,
    rotation: 0,
    border: createDefaultOverlayBorder(),
    eraseStrokes: [],
    effects: [],
  };
  const baseB = { ...baseA, src: 'b', scale: 0.9 };

  let hist = {};
  hist = pushOverlayHistory(hist, 'ov_a', baseA);
  const editedA = { ...baseA, rotation: 25 };

  // Undoing overlay B should do nothing
  assert.equal(undoOverlayHistory(hist, 'ov_b', baseB), null);

  // Undoing overlay A restores rotation 0 and supports Redo back to 25
  const undone = undoOverlayHistory(hist, 'ov_a', editedA);
  assert.ok(undone);
  assert.equal(undone.params.rotation, 0);

  const redone = redoOverlayHistory(undone.nextMap, 'ov_a', undone.params);
  assert.ok(redone);
  assert.equal(redone.params.rotation, 25);
});

test('computeBrushPreviewRadiusCanvasPx scales brush diameter cleanly relative to canvas short edge', () => {
  const rSmall = computeBrushPreviewRadiusCanvasPx(21, 840, 1200);
  const rLarge = computeBrushPreviewRadiusCanvasPx(84, 840, 1200);
  assert.equal(rSmall, 21);
  assert.equal(rLarge, 84);
  assert.ok(computeBrushPreviewRadiusCanvasPx(120, 1080, 1920) > rLarge);
});

test('computeBrushPreviewGradientStops reflects Opacity and Hardness feathering live', () => {
  const softStops = computeBrushPreviewGradientStops(0, 100);
  assert.equal(softStops[0].alpha, 1);
  assert.equal(softStops[softStops.length - 1].alpha, 0);
  assert.ok(softStops[1].offset < 0.5 && softStops[1].alpha < 0.7, 'Hardness 0 should feather softly across entire radius');

  const hardStops = computeBrushPreviewGradientStops(100, 100);
  assert.ok(hardStops[1].offset >= 0.9 && hardStops[1].alpha >= 0.95, 'Hardness 100 should keep tight solid core to near rim');

  const faintStops = computeBrushPreviewGradientStops(70, 30);
  assert.ok(Math.abs(faintStops[0].alpha - 0.3) < 0.001, 'Opacity 30 should scale peak core alpha to 0.3');
});

test('extractAlphaContours outlines erased notches and interior cutouts instead of only the outer rectangle', () => {
  const w = 24;
  const h = 24;

  // 1. Solid opaque square padded inside 24x24 buffer (x: 4..19, y: 4..19)
  const alphaSolid = new Uint8Array(w * h);
  for (let y = 4; y < 20; y++) {
    for (let x = 4; x < 20; x++) {
      alphaSolid[y * w + x] = 255;
    }
  }
  const solidLoops = extractAlphaContours(alphaSolid, w, h, 128);
  assert.equal(solidLoops.length, 1);

  // 2. Carve an erased notch deep into the right side (x: 12..19, y: 9..14)
  const alphaNotch = new Uint8Array(alphaSolid);
  for (let y = 9; y < 15; y++) {
    for (let x = 12; x < 20; x++) {
      alphaNotch[y * w + x] = 0;
    }
  }
  const notchLoops = extractAlphaContours(alphaNotch, w, h, 128);
  assert.equal(notchLoops.length, 1);
  const notchHasInteriorRightEdge = notchLoops[0].some(
    (pt) => pt.x >= 11 && pt.x <= 13.5 && pt.y >= 10 && pt.y <= 14,
  );
  assert.ok(
    notchHasInteriorRightEdge,
    'Border contour must hug inward along the erased notch rather than staying at x=20',
  );

  // 3. Punch an interior erased hole (x: 9..14, y: 9..14) -> produces outer loop + inner hole loop
  const alphaHole = new Uint8Array(alphaSolid);
  for (let y = 9; y < 15; y++) {
    for (let x = 9; x < 15; x++) {
      alphaHole[y * w + x] = 0;
    }
  }
  const holeLoops = extractAlphaContours(alphaHole, w, h, 128);
  assert.equal(holeLoops.length, 2, 'Erasing an interior hole must produce both outer and inner contours');
});

test('applyColorSplashPixel keeps target hue vivid and desaturates non-matching colours', () => {
  const [rr, rg, rb] = applyColorSplashPixel(220, 30, 30, 0, 25);
  assert.ok(rr > rg + 100 && rr > rb + 100, 'Red pixel should stay saturated on red hue splash');

  const [br, bg, bb] = applyColorSplashPixel(30, 80, 220, 0, 25);
  assert.ok(Math.abs(br - bg) < 6 && Math.abs(bg - bb) < 6, 'Blue pixel should desaturate to grayscale');
});

test('applyReplaceColorPixel swaps matched pixels toward target hue while preserving luminance', () => {
  const [nr, ng, nb] = applyReplaceColorPixel(35, 95, 225, '#235FE1', '#22C55E', 45, 25);
  assert.ok(ng > nb && ng > nr, `Expected blue shifted to green dominant, got rgb(${nr},${ng},${nb})`);
});

test('floodFillMagicWandMask, rasterizePolygonMask, and expandContractAlpha produce accurate cutout masks', () => {
  const w = 16;
  const h = 16;
  const img = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inSquare = x >= 4 && x <= 11 && y >= 4 && y <= 11;
      img[i] = inSquare ? 220 : 20;
      img[i + 1] = inSquare ? 190 : 30;
      img[i + 2] = inSquare ? 80 : 120;
      img[i + 3] = 255;
    }
  }

  const wandAlpha = floodFillMagicWandMask(img, w, h, 0.5, 0.5, 25, true);
  assert.ok(wandAlpha[7 * w + 7] > 0.9, 'Center of target region selected by magic wand');
  assert.equal(wandAlpha[0], 0, 'Outside region excluded by contiguous magic wand');

  const polyAlpha = rasterizePolygonMask(
    [
      { x: 0.25, y: 0.25 },
      { x: 0.75, y: 0.25 },
      { x: 0.75, y: 0.75 },
      { x: 0.25, y: 0.75 },
    ],
    w,
    h,
  );
  assert.equal(polyAlpha[8 * w + 8], 1, 'Polygon center pixel selected');
  assert.equal(polyAlpha[0], 0, 'Polygon corner excluded');

  const expanded = expandContractAlpha(polyAlpha, w, h, 2);
  assert.equal(expanded[2 * w + 8], 1, 'Expanded mask grows outward by 2px');

  const polyMask = createDefaultLayerMask('polygon');
  polyMask.feather = 0;
  polyMask.polygonPoints = [
    { x: 0.25, y: 0.25 },
    { x: 0.75, y: 0.25 },
    { x: 0.75, y: 0.75 },
    { x: 0.25, y: 0.75 },
  ];
  const evalPoly = evaluateMaskAlpha(polyMask, img, w, h);
  assert.ok(evalPoly[8 * w + 8] > 0.9);
});

test('videoEngine math handles trim clamping, speed/reverse/loop mapping, keyframes, and MIME negotiation', () => {
  const clamped = clampTrimRange(4.8, 3.0, 5.0);
  assert.ok(clamped.trimEnd >= clamped.trimStart + 0.1);
  assert.equal(computeEffectiveDuration(1, 5, 2), 2);

  const forwardT = mapPlaybackToSourceTime(1, 1, 5, 1, false, false);
  assert.equal(forwardT, 2);
  const reverseT = mapPlaybackToSourceTime(1, 1, 5, 1, true, false);
  assert.equal(reverseT, 4);
  const loopT = mapPlaybackToSourceTime(5, 1, 5, 1, false, true);
  assert.equal(loopT, 2);

  const hiddenState = computeKeyframeOverlayState(
    {
      id: 'k1',
      kind: 'text',
      text: 'Hello World',
      color: '#FFFFFF',
      fontSize: 32,
      x: 0.5,
      y: 0.5,
      startTime: 1,
      endTime: 3,
      animation: 'typewriter',
    },
    0.5,
    360,
  );
  assert.equal(hiddenState.visible, false);

  const activeState = computeKeyframeOverlayState(
    {
      id: 'k1',
      kind: 'text',
      text: 'Hello World',
      color: '#FFFFFF',
      fontSize: 32,
      x: 0.5,
      y: 0.5,
      startTime: 1,
      endTime: 3,
      animation: 'typewriter',
    },
    1.5,
    360,
  );
  assert.equal(activeState.visible, true);
  assert.ok(activeState.displayText.length > 0 && activeState.displayText.length < 'Hello World'.length);

  const mp4Pick = pickSupportedVideoMimeType('mp4', (m) => m === 'video/mp4');
  assert.equal(mp4Pick.actualExt, 'mp4');
  const fallbackPick = pickSupportedVideoMimeType('mp4', (m) => m === 'video/webm');
  assert.equal(fallbackPick.actualExt, 'webm');
});




