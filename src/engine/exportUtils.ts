import type { EditLayer } from '../types/editor';
import { renderEditStack } from './pipeline';

export type ExportFormat =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/avif'
  | 'image/tiff';

export type ExportColorProfile = 'srgb' | 'display-p3';

export interface ExportWatermarkOptions {
  enabled: boolean;
  text: string;
  opacity: number; // 0.05..1
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'center';
}

export interface InstagramExportPreset {
  id: string;
  label: string;
  width: number;
  height: number;
  subtitle: string;
}

export const INSTAGRAM_EXPORT_PRESETS: InstagramExportPreset[] = [
  { id: 'ig-square', label: 'Square Post', width: 1080, height: 1080, subtitle: '1080 × 1080 · 1:1' },
  { id: 'ig-portrait', label: 'Portrait Feed', width: 1080, height: 1350, subtitle: '1080 × 1350 · 4:5' },
  { id: 'ig-landscape-feed', label: 'Landscape Feed', width: 1080, height: 566, subtitle: '1080 × 566 · 1.91:1' },
  { id: 'ig-story', label: 'Story / Reel', width: 1080, height: 1920, subtitle: '1080 × 1920 · 9:16' },
  { id: 'ig-landscape', label: 'Landscape 16:9', width: 1920, height: 1080, subtitle: '1920 × 1080 · 16:9' },
];

export function computeFitDimensions(
  srcW: number,
  srcH: number,
  longEdge: number,
): { width: number; height: number } {
  if (longEdge <= 0 || srcW <= 0 || srcH <= 0) {
    return { width: Math.max(1, srcW), height: Math.max(1, srcH) };
  }
  if (srcW >= srcH) {
    return {
      width: longEdge,
      height: Math.max(1, Math.round((srcH / srcW) * longEdge)),
    };
  }
  return {
    width: Math.max(1, Math.round((srcW / srcH) * longEdge)),
    height: longEdge,
  };
}

export function resizeCanvasToTarget(
  source: HTMLCanvasElement,
  targetW: number,
  targetH: number,
  fitMode: 'cover' | 'contain' = 'cover',
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = targetW;
  out.height = targetH;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (fitMode === 'contain') {
    ctx.fillStyle = '#0B0C0F';
    ctx.fillRect(0, 0, targetW, targetH);
    const scale = Math.min(targetW / source.width, targetH / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    ctx.drawImage(source, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
  } else {
    const scale = Math.max(targetW / source.width, targetH / source.height);
    const dw = source.width * scale;
    const dh = source.height * scale;
    ctx.drawImage(source, (targetW - dw) / 2, (targetH - dh) / 2, dw, dh);
  }

  return out;
}

/**
 * Pure-TS uncompressed 32-bit RGBA baseline TIFF encoder (Little Endian II*).
 */
export function encodeRgbaToTiffBytes(
  rgba: Uint8ClampedArray,
  width: number,
  height: number,
): Uint8Array {
  const pixelBytes = width * height * 4;
  const headerSize = 8;
  const numEntries = 10;
  const ifdOffset = headerSize + pixelBytes;
  const ifdSize = 2 + numEntries * 12 + 4;
  const bpsOffset = ifdOffset + ifdSize; // 4 x uint16 = 8 bytes
  const totalSize = bpsOffset + 8;

  const buf = new ArrayBuffer(totalSize);
  const dv = new DataView(buf);
  const out = new Uint8Array(buf);

  // TIFF Header: II (0x4949), 42, IFD offset
  dv.setUint16(0, 0x4949, true);
  dv.setUint16(2, 42, true);
  dv.setUint32(4, ifdOffset, true);

  // Pixel payload right after header
  out.set(rgba.subarray(0, pixelBytes), headerSize);

  // BitsPerSample values [8, 8, 8, 8]
  dv.setUint16(bpsOffset, 8, true);
  dv.setUint16(bpsOffset + 2, 8, true);
  dv.setUint16(bpsOffset + 4, 8, true);
  dv.setUint16(bpsOffset + 6, 8, true);

  // Write IFD entries sorted by ascending tag ID
  let pos = ifdOffset;
  dv.setUint16(pos, numEntries, true);
  pos += 2;
  const writeEntry = (tag: number, type: number, count: number, valOrOffset: number) => {
    dv.setUint16(pos, tag, true);
    dv.setUint16(pos + 2, type, true);
    dv.setUint32(pos + 4, count, true);
    dv.setUint32(pos + 8, valOrOffset, true);
    pos += 12;
  };

  writeEntry(256, 4, 1, width); // ImageWidth
  writeEntry(257, 4, 1, height); // ImageLength
  writeEntry(258, 3, 4, bpsOffset); // BitsPerSample
  writeEntry(259, 3, 1, 1); // Compression = None
  writeEntry(262, 3, 1, 2); // PhotometricInterpretation = RGB
  writeEntry(273, 4, 1, headerSize); // StripOffsets
  writeEntry(277, 3, 1, 4); // SamplesPerPixel = 4
  writeEntry(278, 4, 1, height); // RowsPerStrip
  writeEntry(279, 4, 1, pixelBytes); // StripByteCounts
  writeEntry(338, 3, 1, 2); // ExtraSamples = Unassociated Alpha
  dv.setUint32(pos, 0, true); // Next IFD = 0

  return out;
}

export function encodeRgbaToTiffBlob(rgba: Uint8ClampedArray, width: number, height: number): Blob {
  const bytes = encodeRgbaToTiffBytes(rgba, width, height);
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'image/tiff' });
}

/**
 * Pure-TS PDF 1.4 single-page print layout generator embedding JPEG image bytes directly (/DCTDecode).
 */
export function buildPdfFromJpegBytes(
  jpegBytes: Uint8Array,
  imgW: number,
  imgH: number,
  pageSize: 'a4' | 'letter' = 'a4',
): Uint8Array {
  const ptW = pageSize === 'a4' ? 595.28 : 612;
  const ptH = pageSize === 'a4' ? 841.89 : 792;
  const margin = 36; // 0.5 inch margin
  const maxW = ptW - margin * 2;
  const maxH = ptH - margin * 2;
  const scale = Math.min(maxW / Math.max(1, imgW), maxH / Math.max(1, imgH));
  const drawW = (imgW * scale).toFixed(2);
  const drawH = (imgH * scale).toFixed(2);
  const drawX = ((ptW - Number(drawW)) / 2).toFixed(2);
  const drawY = ((ptH - Number(drawH)) / 2).toFixed(2);

  const enc = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0];
  let byteLen = 0;

  const pushStr = (s: string) => {
    const b = enc.encode(s);
    chunks.push(b);
    byteLen += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLen += b.length;
  };
  const beginObj = (n: number) => {
    offsets[n] = byteLen;
    pushStr(`${n} 0 obj\n`);
  };

  pushStr('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');

  beginObj(1);
  pushStr('<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  beginObj(2);
  pushStr('<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');

  beginObj(3);
  pushStr(
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${ptW.toFixed(2)} ${ptH.toFixed(2)}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`,
  );

  beginObj(4);
  pushStr(
    `<< /Type /XObject /Subtype /Image /Width ${imgW} /Height ${imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpegBytes.length} >>\nstream\n`,
  );
  pushBytes(jpegBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${drawW} 0 0 ${drawH} ${drawX} ${drawY} cm\n/Im0 Do\nQ\n`;
  beginObj(5);
  pushStr(`<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  const xrefOffset = byteLen;
  pushStr(`xref\n0 6\n0000000000 65535 f \n`);
  for (let i = 1; i <= 5; i++) {
    pushStr(`${String(offsets[i]).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  const merged = new Uint8Array(byteLen);
  let cursor = 0;
  for (const c of chunks) {
    merged.set(c, cursor);
    cursor += c.length;
  }
  return merged;
}

export async function exportCanvasToPdfBlob(
  canvas: HTMLCanvasElement,
  pageSize: 'a4' | 'letter' = 'a4',
): Promise<Blob> {
  const jpegBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('PDF raster step failed'))),
      'image/jpeg',
      0.94,
    );
  });
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  const pdfBytes = buildPdfFromJpegBytes(jpegBytes, canvas.width, canvas.height, pageSize);
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

/**
 * Extracts EXIF APP1 (0xFF 0xE1) segment from a source JPEG DataURL if present,
 * and re-injects it into exported JPEG bytes when EXIF preservation is enabled.
 */
export function extractJpegExifApp1Segment(dataUrl: string): Uint8Array | null {
  if (!dataUrl.startsWith('data:image/jpeg')) return null;
  try {
    const b64 = dataUrl.split(',')[1];
    if (!b64) return null;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;

    let pos = 2;
    while (pos + 4 < bytes.length) {
      if (bytes[pos] !== 0xff) break;
      const marker = bytes[pos + 1];
      if (marker === 0xda) break; // SOS
      const segLen = (bytes[pos + 2] << 8) | bytes[pos + 3];
      if (marker === 0xe1) {
        return bytes.slice(pos, pos + 2 + segLen);
      }
      pos += 2 + segLen;
    }
  } catch {
    // ignore malformed base64
  }
  return null;
}

export function injectJpegExifApp1(jpegBytes: Uint8Array, app1: Uint8Array): Uint8Array {
  if (jpegBytes.length < 4 || jpegBytes[0] !== 0xff || jpegBytes[1] !== 0xd8) return jpegBytes;
  const merged = new Uint8Array(jpegBytes.length + app1.length);
  merged.set(jpegBytes.subarray(0, 2), 0);
  merged.set(app1, 2);
  merged.set(jpegBytes.subarray(2), 2 + app1.length);
  return merged;
}

function drawWatermarkOnCanvas(canvas: HTMLCanvasElement, wm: ExportWatermarkOptions) {
  if (!wm.enabled || !wm.text.trim()) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const pad = Math.max(18, Math.round(Math.min(canvas.width, canvas.height) * 0.032));
  const fontSize = Math.max(14, Math.round(Math.min(canvas.width, canvas.height) * 0.028));
  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(1, wm.opacity));
  ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 8;

  if (wm.position === 'center') {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(wm.text, canvas.width / 2, canvas.height / 2);
  } else if (wm.position === 'bottom-left') {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText(wm.text, pad, canvas.height - pad);
  } else if (wm.position === 'top-right') {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillText(wm.text, canvas.width - pad, pad);
  } else {
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    ctx.fillText(wm.text, canvas.width - pad, canvas.height - pad);
  }
  ctx.restore();
}

function applyDisplayP3ProfileShift(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  // Wide-gamut sRGB -> Display P3 gentle vibrancy expansion for browsers supporting P3 canvas
  for (let i = 0; i < d.length; i += 4) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const lum = 0.299 * r + 0.587 * g + 0.114 * b;
    d[i] = Math.max(0, Math.min(255, Math.round(lum + (r - lum) * 1.07)));
    d[i + 1] = Math.max(0, Math.min(255, Math.round(lum + (g - lum) * 1.06)));
    d[i + 2] = Math.max(0, Math.min(255, Math.round(lum + (b - lum) * 1.05)));
  }
  ctx.putImageData(imgData, 0, 0);
}

export function formatBatchFilename(
  pattern: string,
  vars: { name: string; preset: string; index: number; width: number; height: number; ext: string },
): string {
  const safeBase = (pattern.trim() || '{name}-{preset}')
    .replaceAll('{name}', vars.name.replace(/[^a-zA-Z0-9_-]+/g, '-'))
    .replaceAll('{preset}', vars.preset)
    .replaceAll('{index}', String(vars.index + 1).padStart(2, '0'))
    .replaceAll('{w}', String(vars.width))
    .replaceAll('{h}', String(vars.height));
  return `${safeBase}.${vars.ext}`;
}

export async function exportSingleImage(
  sourceSrc: string,
  layers: EditLayer[],
  options: {
    format: ExportFormat;
    quality: number; // 0.1..1
    longEdge?: number;
    exactPreset?: InstagramExportPreset | null;
    fitMode?: 'cover' | 'contain';
    colorProfile?: ExportColorProfile;
    exifMode?: 'strip' | 'preserve';
    watermark?: ExportWatermarkOptions;
    filenamePattern?: string;
    baseName?: string;
    batchIndex?: number;
  },
): Promise<{ blob: Blob; filename: string; width: number; height: number; canvas: HTMLCanvasElement }> {
  const { canvas } = await renderEditStack(sourceSrc, layers, { maxEdge: 0 });

  let finalCanvas = canvas;
  if (options.exactPreset) {
    finalCanvas = resizeCanvasToTarget(
      canvas,
      options.exactPreset.width,
      options.exactPreset.height,
      options.fitMode ?? 'cover',
    );
  } else if (options.longEdge && options.longEdge > 0) {
    const dims = computeFitDimensions(canvas.width, canvas.height, options.longEdge);
    finalCanvas = resizeCanvasToTarget(canvas, dims.width, dims.height, 'contain');
  }

  if (options.colorProfile === 'display-p3') {
    applyDisplayP3ProfileShift(finalCanvas);
  }

  if (options.watermark?.enabled) {
    drawWatermarkOnCanvas(finalCanvas, options.watermark);
  }

  let blob: Blob;
  let ext = 'jpg';

  if (options.format === 'image/tiff') {
    const ctx = finalCanvas.getContext('2d', { willReadFrequently: true })!;
    const imgData = ctx.getImageData(0, 0, finalCanvas.width, finalCanvas.height);
    blob = encodeRgbaToTiffBlob(imgData.data, finalCanvas.width, finalCanvas.height);
    ext = 'tiff';
  } else {
    const encoded = await new Promise<Blob | null>((resolve) => {
      finalCanvas.toBlob(
        (b) => resolve(b),
        options.format,
        options.format === 'image/png' ? undefined : options.quality,
      );
    });
    if (!encoded) {
      // Graceful fallback for browsers without native AVIF encoder -> WebP
      blob = await new Promise<Blob>((resolve, reject) => {
        finalCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode export image'))),
          'image/webp',
          options.quality,
        );
      });
      ext = 'webp';
    } else {
      blob = encoded;
      ext =
        options.format === 'image/png'
          ? 'png'
          : options.format === 'image/webp'
            ? 'webp'
            : options.format === 'image/avif'
              ? 'avif'
              : 'jpg';
    }

    if (options.format === 'image/jpeg' && options.exifMode === 'preserve') {
      const app1 = extractJpegExifApp1Segment(sourceSrc);
      if (app1) {
        const rawBytes = new Uint8Array(await blob.arrayBuffer());
        const withExif = injectJpegExifApp1(rawBytes, app1);
        blob = new Blob([withExif.buffer as ArrayBuffer], { type: 'image/jpeg' });
      }
    }
  }

  const presetLabel = options.exactPreset
    ? options.exactPreset.id
    : `${finalCanvas.width}x${finalCanvas.height}`;
  const filename = options.filenamePattern
    ? formatBatchFilename(options.filenamePattern, {
        name: options.baseName || 'lumina',
        preset: presetLabel,
        index: options.batchIndex ?? 0,
        width: finalCanvas.width,
        height: finalCanvas.height,
        ext,
      })
    : `lumina-${presetLabel}.${ext}`;

  return {
    blob,
    filename,
    width: finalCanvas.width,
    height: finalCanvas.height,
    canvas: finalCanvas,
  };
}

/**
 * Shareable Edit Stack URL hash encoding (#stack=<base64url JSON of portable layers>).
 */
export function encodeStackToUrlHash(layers: EditLayer[]): string {
  const portable = layers.filter(
    (l) => l.type !== 'ai-eraser' && l.type !== 'ai-upscale' && l.type !== 'ai-outpaint' && l.type !== 'image',
  );
  const json = JSON.stringify(portable);
  const bytes = new TextEncoder().encode(json);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  const b64 = btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `#stack=${b64}`;
}

export function decodeStackFromUrlHash(hash: string): EditLayer[] | null {
  const clean = hash.replace(/^#/, '');
  if (!clean.startsWith('stack=')) return null;
  try {
    let b64 = clean.slice(6).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4 !== 0) b64 += '=';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const json = new TextDecoder().decode(bytes);
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? (parsed as EditLayer[]) : null;
  } catch {
    return null;
  }
}

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
