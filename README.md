# Lumina Studio — Browser-Native Photo & Collage Studio

A full-featured, Instagram-style creative studio built with **React 19 + TypeScript + Vite + Tailwind CSS v4**, **HTML5 Canvas / ImageData** pixel processing, and offline **PWA** support. Everything runs 100% client-side with zero backend or paid APIs required, and builds to static files (`dist/`).

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Start local dev server (http://localhost:3000)
npm run dev

# 3. Typecheck, run unit tests & build static production bundle (dist/)
npm run lint
npx tsx --test src/engine/engine.test.ts
npm run build
```

---

## Key Features & Module Architecture

- **Core & RAW Import (`src/utils/storage.ts`, `src/engine/rawDecoder.ts`)**: Import via drag-and-drop, file picker, or clipboard paste (`Ctrl+V`). Supports PNG, JPEG, WebP, HEIC (`heic2any`), and Camera RAW containers (`.CR2`, `.NEF`, `.ARW`, `.DNG`). Auto-saves projects to `localStorage`.
- **Non-Destructive Layer Stack & Masks (`src/engine/stackReducer.ts`, `src/engine/maskEngine.ts`)**:
  - Image, adjustment, text, shape, sticker, drawing, and group layers with 14+ blend modes (`multiply`, `screen`, `overlay`, `soft-light`, `hard-light`, `difference`, `color-dodge`, `color-burn`, `darken`, `lighten`, `hue`, `saturation`, `color`, `luminosity`), per-layer opacity, lock, duplicate, and drag-to-reorder.
  - Brush masks (`size`, `hardness`, `opacity`, `eraser`), linear & radial gradients, luminosity range, color-range eyedropper, invert/feather/refine-edge, and reusable saved selections.
- **Extended Tone, Color & Detail FX (`src/engine/colorMath.ts`, `src/engine/effectsEngine.ts`, `src/engine/curves.ts`)**:
  - Levels (input/output black & white points), gamma, brightness, white-balance eyedropper, 3-way color grading wheels (shadows/midtones/highlights), selective color hue targeting, global hue rotation, RGB/channel curves, and live color-blind-safe histogram overlay.
  - Unsharp mask (amount/radius/threshold), separate luminance & chroma noise reduction, texture, bloom/glow, chromatic aberration, film halation & light leaks, dust & scratches, lens distortion, and keystone perspective correction.
- **44+ Presets & Plugin API (`src/engine/filters.ts`)**: Live user-photo thumbnails across Signature, Film, Cinematic, B&W, Vintage, Mood, Warm, Cool, Punchy, Faded, Custom, and Plugin categories; intensity slider; favorites & recent presets; JSON import/export; and `window.LuminaStudio.registerFilter()`.
- **Typography, Shapes & Collage (`src/components/`)**:
  - Curved text along an arc path, neon glow, templates, vector shapes (fill, stroke, corner radius, rotation), custom stickers, snap-to-center guides, and Double/Polaroid/Film/Rounded borders.
  - **Collage Studio (`CollageModal.tsx`)**: 2/3/4/5/6/9 grid templates, freeform drag layout, per-cell aspect & border width, photo swapping.
- **Export, Print & Share (`src/engine/exportUtils.ts`, `ExportModal.tsx`)**: PNG, JPEG, WebP, AVIF, and uncompressed 32-bit TIFF; Instagram presets (`1080×1080`, `1080×1350`, `1080×566`, `1080×1920`, `1920×1080`); batch rename patterns & batch sync across photos; EXIF preserve/strip; sRGB & Display P3; watermark overlay; A4/Letter Print PDF export; and `#stack=` shareable URL hash links.
- **Workflow & Offline PWA (`src/components/PwaControls.tsx`, `vite.config.ts`)**: Command Palette (`Ctrl+K`), remappable shortcuts, named history steps & snapshot checkpoints, hold/split/side-by-side compare views, customizable workspace layouts, Dark & Light themes, pinch-to-zoom, and installable offline Service Worker (`vite-plugin-pwa`).
